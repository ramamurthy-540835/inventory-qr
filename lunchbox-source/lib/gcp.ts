import { BigQuery } from "@google-cloud/bigquery";
import { Storage } from "@google-cloud/storage";
import { createHmac } from "node:crypto";
import { FREE_MEALS_DAILY_CAP, type FreeMealType, type PriceTier } from "@/lib/pricing";

export type FreeMealItem = {
  meal_id: string;
  meal_name: string;
  service_date: string;
  free_meal_type: FreeMealType;
  quantity: number;
  subsidy_unit_inr: number;
};

export type OrderRecord = {
  order_id: string;
  parent_uid: string | null;
  student_id: string | null;
  allergies_json: string | null;
  school_id: string;
  kitchen_id: string;
  payment_status: string;
  price_tier: PriceTier;
  created_at: string;
  student_name: string;
  school_name: string;
  parent_phone: string;
  city: string;
  grade_band: string;
  items_json: string;
  free_meals_json: string;
  total_inr: number;
  status: string;
  receipt_uri: string | null;
};

const projectId = process.env.GCP_PROJECT_ID;
const datasetId = process.env.BIGQUERY_DATASET || "school_lunch";
const tableId = process.env.BIGQUERY_ORDERS_TABLE || "orders_v2";
const bucketName = process.env.GCS_BUCKET;
const analyticsHashSalt = process.env.ANALYTICS_HASH_SALT;

type AnalyticsItem = {
  meal_id: string;
  meal_name: string;
  service_date: string;
  quantity: number;
  unit_price_inr: number;
};

function analyticsRef(value: string | null) {
  if (!value || !analyticsHashSalt) return null;
  return createHmac("sha256", analyticsHashSalt).update(value).digest("hex");
}

function cityId(city: string) {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function analyticsOrder(order: OrderRecord, receiptUri: string) {
  const items = JSON.parse(order.items_json) as AnalyticsItem[];
  const freeMeals = JSON.parse(order.free_meals_json) as FreeMealItem[];
  const serviceDates = items.map((item) => item.service_date).sort();
  return {
    order_id: order.order_id,
    created_at: order.created_at,
    updated_at: order.created_at,
    first_service_date: serviceDates[0] || null,
    last_service_date: serviceDates.at(-1) || null,
    parent_ref: analyticsRef(order.parent_uid || order.parent_phone),
    student_ref: analyticsRef(order.student_id || `${order.school_id}:${order.student_name}`),
    school_id: order.school_id,
    school_name: order.school_name,
    kitchen_id: order.kitchen_id,
    city_id: cityId(order.city),
    grade_band: order.grade_band,
    price_tier: order.price_tier,
    items: items.map((item) => ({
      ...item,
      line_total_inr: item.quantity * item.unit_price_inr,
    })),
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    free_meals: freeMeals.map((item) => ({ ...item, subsidy_total_inr: item.quantity * item.subsidy_unit_inr })),
    free_meal_count: freeMeals.reduce((sum, item) => sum + item.quantity, 0),
    free_meal_daily_cap: FREE_MEALS_DAILY_CAP,
    total_inr: order.total_inr,
    currency: "INR",
    order_status: order.status,
    payment_status: order.payment_status,
    receipt_uri: receiptUri,
    schema_version: 3,
  };
}

export function isGcpConfigured() {
  return Boolean(projectId && bucketName);
}

export async function persistOrder(order: OrderRecord) {
  if (!projectId || !bucketName) return { mode: "demo" as const, receiptUri: null };

  const storage = new Storage({ projectId });
  const bigquery = new BigQuery({ projectId });
  const objectName = `order-packets/${order.created_at.slice(0, 10)}/${order.order_id}.json`;
  const receiptUri = `gs://${bucketName}/${objectName}`;
  const storedOrder = { ...order, receipt_uri: receiptUri };
  const analyticsRow = analyticsOrder(order, receiptUri);

  let createdObject = false;
  try {
    await storage.bucket(bucketName).file(objectName).save(JSON.stringify(storedOrder, null, 2), {
      contentType: "application/json",
      resumable: false,
      metadata: { cacheControl: "no-store" },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    createdObject = true;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 412) throw error;
  }

  try {
    await bigquery.dataset(datasetId).table(tableId).insert(
      [{ insertId: order.order_id, json: analyticsRow }],
      { raw: true },
    );
  } catch (error) {
    if (createdObject) {
      await storage.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true }).catch(() => undefined);
    }
    throw error;
  }

  return { mode: "gcp" as const, receiptUri };
}

export async function storeDeliveryProof(serviceDate: string, routeId: string, schoolId: string, file: File) {
  if (!projectId || !bucketName) throw new Error("GCS delivery-proof storage is not configured.");
  if (file.size < 1 || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Proof must be a JPG, PNG or WebP image under 5 MB.");
  }
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const objectName = `delivery-proofs/${serviceDate}/${routeId}/${schoolId}-${crypto.randomUUID()}.${extension}`;
  await new Storage({ projectId }).bucket(bucketName).file(objectName).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    resumable: false,
    metadata: { cacheControl: "private, no-store" },
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  return `gs://${bucketName}/${objectName}`;
}
