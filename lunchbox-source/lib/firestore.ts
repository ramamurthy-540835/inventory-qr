import { Firestore, FieldValue, Timestamp } from "@google-cloud/firestore";
import type { OrderRecord } from "@/lib/gcp";
import { FREE_MEALS_DAILY_CAP, canReserveDailyFreeMeals } from "@/lib/pricing";

export type CapacityReservation = {
  serviceDate: string;
  meals: number;
  freeMeals: number;
};

type StoredOrder = OrderRecord & {
  idempotency_key: string;
  school_id: string;
  kitchen_id: string;
  analytics_status: "PENDING" | "SYNCED";
  reservations: CapacityReservation[];
  razorpay_order_id?: string;
  payment_expires_at?: Timestamp;
};

const projectId = process.env.GCP_PROJECT_ID;
const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
const defaultCapacity = Number(process.env.DEFAULT_DAILY_CAPACITY || 500);
const cutoffTime = process.env.ORDER_CUTOFF_IST || "09:00";

export class OrderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderConflictError";
  }
}

export class FreeMealCapError extends OrderConflictError {
  constructor(public readonly kitchenId: string, public readonly serviceDate: string) {
    super(`Today’s sponsored free-meal allocation is full for ${serviceDate}. Please choose another delivery date or contact the school coordinator.`);
    this.name = "FreeMealCapError";
  }
}

export function firestoreClient() {
  if (!projectId) throw new Error("GCP_PROJECT_ID is required for transactional orders.");
  return new Firestore({ projectId, databaseId });
}

function cutoffAt(serviceDate: string, configuredCutoff = cutoffTime) {
  const match = /^(\d{2}):(\d{2})$/.exec(configuredCutoff);
  if (!match) throw new Error("ORDER_CUTOFF_IST must use HH:mm format.");
  const [, hour, minute] = match;
  // Asia/Kolkata is UTC+05:30 and has no daylight-saving changes.
  return new Date(`${serviceDate}T${hour}:${minute}:00+05:30`);
}

export function isFirestoreConfigured() {
  return Boolean(projectId);
}

export async function reserveOrder(
  order: OrderRecord,
  idempotencyKey: string,
  schoolId: string,
  kitchenId: string,
  reservations: CapacityReservation[],
) {
  const firestore = firestoreClient();
  const idempotencyRef = firestore.collection("order_idempotency").doc(idempotencyKey);
  const orderRef = firestore.collection("orders").doc(order.order_id);

  return firestore.runTransaction(async (transaction) => {
    const idempotencySnapshot = await transaction.get(idempotencyRef);
    if (idempotencySnapshot.exists) {
      const existingOrderId = idempotencySnapshot.get("order_id") as string;
      const existingSnapshot = await transaction.get(firestore.collection("orders").doc(existingOrderId));
      if (!existingSnapshot.exists) throw new Error("The previous order could not be recovered.");
      return { created: false, order: existingSnapshot.data() as StoredOrder };
    }

    const capacityRefs = reservations.map(({ serviceDate }) => firestore.collection("kitchen_capacity_daily").doc(kitchenId + "_" + serviceDate));
    const holidayRefs = reservations.map(({ serviceDate }) => firestore.collection("school_holidays").doc(schoolId + "_" + serviceDate));
    const freeMealCapRefs = reservations.map(({ serviceDate }) => firestore.collection("free_meal_cap_usage").doc(kitchenId + "_" + serviceDate));
    const kitchenRef = firestore.collection("kitchens").doc(kitchenId);
    const [kitchenSnapshot, capacitySnapshots, holidaySnapshots, freeMealCapSnapshots] = await Promise.all([
      transaction.get(kitchenRef),
      Promise.all(capacityRefs.map((ref) => transaction.get(ref))),
      Promise.all(holidayRefs.map((ref) => transaction.get(ref))),
      Promise.all(freeMealCapRefs.map((ref) => transaction.get(ref))),
    ]);
    if (kitchenSnapshot.exists && kitchenSnapshot.get("active") === false) {
      throw new OrderConflictError("The selected kitchen is not accepting orders.");
    }
    const managedCapacity = kitchenSnapshot.exists ? Number(kitchenSnapshot.get("daily_capacity")) : defaultCapacity;
    const managedCutoff = kitchenSnapshot.exists ? String(kitchenSnapshot.get("order_cutoff")) : cutoffTime;
    const now = new Date();

    reservations.forEach((reservation, index) => {
      if (holidaySnapshots[index].exists && holidaySnapshots[index].get("active") !== false) {
        throw new OrderConflictError(`School delivery is unavailable on ${reservation.serviceDate}.`);
      }
      const cutoff = cutoffAt(reservation.serviceDate, managedCutoff);
      if (now >= cutoff) throw new OrderConflictError(`Ordering has closed for ${reservation.serviceDate}.`);

      const snapshot = capacitySnapshots[index];
      const capacity = snapshot.exists ? Number(snapshot.get("capacity_meals")) : managedCapacity;
      const confirmed = snapshot.exists ? Number(snapshot.get("confirmed_meals")) : 0;
      const pending = snapshot.exists ? Number(snapshot.get("pending_meals") || 0) : 0;
      if (!Number.isInteger(capacity) || capacity < 1 || confirmed + pending + reservation.meals > capacity) {
        throw new OrderConflictError(`Kitchen capacity is unavailable for ${reservation.serviceDate}.`);
      }
      const freeCapSnapshot = freeMealCapSnapshots[index];
      const freeMealsUsed = freeCapSnapshot.exists ? Number(freeCapSnapshot.get("reserved_meals") || 0) : 0;
      if (!canReserveDailyFreeMeals(freeMealsUsed, reservation.freeMeals)) throw new FreeMealCapError(kitchenId, reservation.serviceDate);
      if (reservation.freeMeals > 0) transaction.set(freeMealCapRefs[index], {
        kitchen_id: kitchenId,
        service_date: reservation.serviceDate,
        reserved_meals: freeMealsUsed + reservation.freeMeals,
        daily_cap: FREE_MEALS_DAILY_CAP,
        remaining_meals: FREE_MEALS_DAILY_CAP - freeMealsUsed - reservation.freeMeals,
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.set(capacityRefs[index], {
        service_date: reservation.serviceDate,
        kitchen_id: kitchenId,
        capacity_meals: capacity,
        confirmed_meals: order.status === "CONFIRMED" ? confirmed + reservation.meals : confirmed,
        pending_meals: order.status === "PENDING_PAYMENT" ? pending + reservation.meals : pending,
        cutoff_at: cutoff.toISOString(),
        status: confirmed + pending + reservation.meals === capacity ? "FULL" : "OPEN",
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    const storedOrder: StoredOrder = {
      ...order,
      idempotency_key: idempotencyKey,
      school_id: schoolId,
      kitchen_id: kitchenId,
      analytics_status: "PENDING",
      reservations,
      ...(order.status === "PENDING_PAYMENT" ? { payment_expires_at: Timestamp.fromMillis(Date.now() + Number(process.env.PAYMENT_HOLD_MINUTES || 15) * 60_000) } : {}),
    };
    transaction.create(orderRef, storedOrder);
    transaction.create(idempotencyRef, {
      order_id: order.order_id,
      created_at: FieldValue.serverTimestamp(),
    });
    return { created: true, order: storedOrder };
  });
}

export async function attachPaymentOrder(orderId: string, razorpayOrderId: string) {
  await firestoreClient().collection("orders").doc(orderId).update({
    razorpay_order_id: razorpayOrderId,
    payment_updated_at: FieldValue.serverTimestamp(),
  });
}

export async function confirmCapturedPayment(razorpayOrderId: string, paymentId: string, amountPaise: number, parentUid?: string) {
  const firestore = firestoreClient();
  const match = await firestore.collection("orders").where("razorpay_order_id", "==", razorpayOrderId).limit(1).get();
  if (match.empty) throw new Error("Payment order was not found.");
  const orderRef = match.docs[0].ref;
  const paymentRef = firestore.collection("payment_events").doc(paymentId);

  return firestore.runTransaction(async (transaction) => {
    const [orderSnapshot, paymentSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(paymentRef)]);
    if (paymentSnapshot.exists) return { orderId: orderRef.id, duplicate: true };
    if (parentUid && orderSnapshot.get("parent_uid") !== parentUid) throw new Error("Payment does not belong to this parent.");
    if (Math.round(Number(orderSnapshot.get("total_inr")) * 100) !== amountPaise) throw new Error("Payment amount does not match the order.");
    if (orderSnapshot.get("status") === "CONFIRMED") return { orderId: orderRef.id, duplicate: true };
    if (orderSnapshot.get("status") !== "PENDING_PAYMENT") throw new OrderConflictError("This payment reservation has expired or is unavailable.");

    const kitchenId = String(orderSnapshot.get("kitchen_id"));
    const reservations = orderSnapshot.get("reservations") as CapacityReservation[];
    const capacityRefs = reservations.map(({ serviceDate }) => firestore.collection("kitchen_capacity_daily").doc(`${kitchenId}_${serviceDate}`));
    const capacitySnapshots = await Promise.all(capacityRefs.map((reference) => transaction.get(reference)));
    reservations.forEach((reservation, index) => {
      const snapshot = capacitySnapshots[index];
      const pending = Number(snapshot.get("pending_meals") || 0);
      const confirmed = Number(snapshot.get("confirmed_meals") || 0);
      transaction.update(capacityRefs[index], {
        pending_meals: Math.max(0, pending - reservation.meals),
        confirmed_meals: confirmed + reservation.meals,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
    transaction.update(orderRef, { status: "CONFIRMED", razorpay_payment_id: paymentId, paid_at: FieldValue.serverTimestamp() });
    transaction.create(paymentRef, { order_id: orderRef.id, razorpay_order_id: razorpayOrderId, processed_at: FieldValue.serverTimestamp() });
    return { orderId: orderRef.id, duplicate: false };
  });
}

export async function expirePendingPayments(limit = 100) {
  const firestore = firestoreClient();
  const snapshot = await firestore.collection("orders")
    .where("status", "==", "PENDING_PAYMENT")
    .where("payment_expires_at", "<=", Timestamp.now())
    .limit(limit)
    .get();
  let expired = 0;
  for (const document of snapshot.docs) {
    const changed = await firestore.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(document.ref);
      if (orderSnapshot.get("status") !== "PENDING_PAYMENT") return false;
      const reservations = orderSnapshot.get("reservations") as CapacityReservation[];
      const kitchenId = String(orderSnapshot.get("kitchen_id"));
      const refs = reservations.map(({ serviceDate }) => firestore.collection("kitchen_capacity_daily").doc(kitchenId + "_" + serviceDate));
      const freeRefs = reservations.map(({ serviceDate }) => firestore.collection("free_meal_cap_usage").doc(kitchenId + "_" + serviceDate));
      const [capacities, freeCaps] = await Promise.all([
        Promise.all(refs.map((reference) => transaction.get(reference))),
        Promise.all(freeRefs.map((reference) => transaction.get(reference))),
      ]);
      reservations.forEach((reservation, index) => {
        const pending = Number(capacities[index].get("pending_meals") || 0);
        transaction.update(refs[index], { pending_meals: Math.max(0, pending - reservation.meals), updated_at: FieldValue.serverTimestamp() });
        const freeMeals = Number(reservation.freeMeals || 0);
        if (freeMeals > 0 && freeCaps[index].exists) {
          const next = Math.max(0, Number(freeCaps[index].get("reserved_meals") || 0) - freeMeals);
          transaction.update(freeRefs[index], { reserved_meals: next, remaining_meals: FREE_MEALS_DAILY_CAP - next, updated_at: FieldValue.serverTimestamp() });
        }
      });
      transaction.update(document.ref, { status: "PAYMENT_EXPIRED", expired_at: FieldValue.serverTimestamp() });
      return true;
    });
    if (changed) expired += 1;
  }
  return { scanned: snapshot.size, expired };
}

export async function prepareFullRefund(orderId: string, idempotencyKey: string, staffUid: string, reason: string) {
  const firestore = firestoreClient();
  const orderRef = firestore.collection("orders").doc(orderId);
  return firestore.runTransaction(async (transaction) => {
    const order = await transaction.get(orderRef);
    if (!order.exists) throw new Error("Order was not found.");
    if (order.get("status") === "REFUND_REQUESTED" && order.get("refund_idempotency_key") === idempotencyKey) {
      return { paymentId: String(order.get("razorpay_payment_id")), amountPaise: Math.round(Number(order.get("total_inr")) * 100) };
    }
    if (order.get("status") !== "CONFIRMED" || !order.get("razorpay_payment_id")) throw new OrderConflictError("Only a captured confirmed order can be refunded.");
    const reservations = order.get("reservations") as CapacityReservation[];
    const kitchenId = String(order.get("kitchen_id"));
    const refs = reservations.map(({ serviceDate }) => firestore.collection("kitchen_capacity_daily").doc(kitchenId + "_" + serviceDate));
    const freeRefs = reservations.map(({ serviceDate }) => firestore.collection("free_meal_cap_usage").doc(kitchenId + "_" + serviceDate));
    const [capacities, freeCaps] = await Promise.all([
      Promise.all(refs.map((reference) => transaction.get(reference))),
      Promise.all(freeRefs.map((reference) => transaction.get(reference))),
    ]);
    if (capacities.some((capacity) => new Date(String(capacity.get("cutoff_at"))) <= new Date())) {
      throw new OrderConflictError("Automatic full refund is closed after a meal cutoff; escalate for manual review.");
    }
    reservations.forEach((reservation, index) => {
      transaction.update(refs[index], { confirmed_meals: Math.max(0, Number(capacities[index].get("confirmed_meals") || 0) - reservation.meals), updated_at: FieldValue.serverTimestamp() });
      const freeMeals = Number(reservation.freeMeals || 0);
      if (freeMeals > 0 && freeCaps[index].exists) {
        const next = Math.max(0, Number(freeCaps[index].get("reserved_meals") || 0) - freeMeals);
        transaction.update(freeRefs[index], { reserved_meals: next, remaining_meals: FREE_MEALS_DAILY_CAP - next, updated_at: FieldValue.serverTimestamp() });
      }
    });
    transaction.update(orderRef, {
      status: "REFUND_REQUESTED",
      refund_idempotency_key: idempotencyKey,
      refund_reason: reason,
      refund_requested_by: staffUid,
      refund_requested_at: FieldValue.serverTimestamp(),
    });
    return { paymentId: String(order.get("razorpay_payment_id")), amountPaise: Math.round(Number(order.get("total_inr")) * 100) };
  });
}

export async function recordRefund(orderId: string, refund: { id: string; status: string; amount: number }) {
  await firestoreClient().collection("orders").doc(orderId).update({
    status: refund.status === "processed" ? "REFUNDED" : "REFUND_PENDING",
    razorpay_refund_id: refund.id,
    refund_status: refund.status,
    refund_amount_paise: refund.amount,
    refund_updated_at: FieldValue.serverTimestamp(),
  });
}

export async function updateRefundStatus(refundId: string, status: string) {
  const firestore = firestoreClient();
  const match = await firestore.collection("orders").where("razorpay_refund_id", "==", refundId).limit(1).get();
  if (match.empty) throw new Error("Refund order was not found.");
  await match.docs[0].ref.update({
    status: status === "processed" ? "REFUNDED" : status === "failed" ? "REFUND_FAILED" : "REFUND_PENDING",
    refund_status: status,
    refund_updated_at: FieldValue.serverTimestamp(),
  });
}

export async function markOrderSynced(orderId: string, receiptUri: string | null) {
  await firestoreClient().collection("orders").doc(orderId).update({
    analytics_status: "SYNCED",
    receipt_uri: receiptUri,
    analytics_synced_at: FieldValue.serverTimestamp(),
  });
}

export async function getOwnedStudent(parentUid: string, studentId: string) {
  const snapshot = await firestoreClient().collection("students").doc(studentId).get();
  if (!snapshot.exists || snapshot.get("parent_uid") !== parentUid) return null;
  return { id: snapshot.id, ...snapshot.data() } as {
    id: string;
    parent_uid: string;
    student_name: string;
    school_id: string;
    school_name?: string;
    city?: string;
    grade_band: string;
    section?: string;
    roll_number?: string;
    relationship?: "mother" | "father" | "guardian";
    home_address?: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      pincode: string;
      landmark: string;
    };
    allergy_acknowledged: boolean;
    allergies: string[];
  };
}
