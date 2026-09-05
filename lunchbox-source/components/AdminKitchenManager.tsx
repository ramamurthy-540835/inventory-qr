"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";

type Kitchen = {
  id: string;
  city_id: string;
  kitchen_name: string;
  daily_capacity: number;
  order_cutoff: string;
  direct_cost_per_meal?: number;
  monthly_fixed_cost?: number;
  active: boolean;
};
type PaymentOrder = { id: string; status: string; totalInr: number; razorpayOrderId: string | null; paymentId: string | null; refundId: string | null; analyticsStatus: string };

export default function AdminKitchenManager() {
  const [phone, setPhone] = useState<string | null>(null);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [message, setMessage] = useState("");
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);

  const load = useCallback(async () => {
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    if (!token) return;
    const response = await fetch("/api/admin/kitchens", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load kitchens.");
    setKitchens(data.kitchens);
    setMessage("");
  }, []);

  async function loadPayments() {
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    const response = await fetch("/api/admin/payments", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load payment reconciliation.");
    setPaymentOrders(data.orders);
  }

  async function refund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    const response = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ orderId: form.get("refundOrderId"), reason: form.get("refundReason") }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to initiate refund.");
    setMessage(`Refund ${data.refundId} is ${data.status}.`);
    await loadPayments();
  }

  const authenticationChanged = useCallback((nextPhone: string | null) => {
    setPhone(nextPhone);
    if (nextPhone) void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    const response = await fetch("/api/admin/kitchens", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        kitchenId: form.get("kitchenId"),
        kitchenName: form.get("kitchenName"),
        cityId: form.get("cityId"),
        dailyCapacity: form.get("dailyCapacity"),
        orderCutoff: form.get("orderCutoff"),
        directCostPerMeal: form.get("directCostPerMeal"),
        monthlyFixedCost: form.get("monthlyFixedCost"),
        active: form.get("active") === "on",
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to save kitchen.");
    setMessage("Kitchen settings saved.");
    event.currentTarget.reset();
    await load();
  }

  async function saveCatalog(event: FormEvent<HTMLFormElement>, entity: "school" | "meal" | "holiday") {
    event.preventDefault();
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entity, ...values }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to save catalogue record.");
    setMessage(`${entity[0].toUpperCase()}${entity.slice(1)} saved.`);
    event.currentTarget.reset();
  }

  return <section className="menu-section">
    <div className="section-heading"><div><span className="kicker">ADMIN</span><h1>Kitchen operations</h1></div><p>Manage launch capacity and order cutoffs. Access requires the Firebase <code>admin</code> custom claim.</p></div>
    <nav className="ops-filter" aria-label="Admin sections"><Link href="/admin/registrations">Partner registrations</Link><Link href="/admin/franchise-applications">Franchise applications</Link></nav>
    <ParentAuth onChange={authenticationChanged} />
    {phone && <>
      <form className="checkout-modal" onSubmit={save}>
        <label>Kitchen ID<input name="kitchenId" required pattern="[a-z0-9-]{3,50}" placeholder="chn-kitchen-01" /></label>
        <label>Kitchen name<input name="kitchenName" required minLength={3} /></label>
        <label>City<select name="cityId"><option value="chennai">Chennai</option><option value="madurai">Madurai</option><option value="trichy">Trichy</option><option value="coimbatore">Coimbatore</option></select></label>
        <label>Daily capacity<input name="dailyCapacity" required type="number" min="1" max="100000" /></label>
        <label>Order cutoff (IST)<input name="orderCutoff" required type="time" defaultValue="09:00" /></label>
        <label>Direct food cost per meal (₹)<input name="directCostPerMeal" required type="number" min="0" step="0.01" defaultValue="27" /></label>
        <label>Monthly fixed cost (₹)<input name="monthlyFixedCost" required type="number" min="0" step="1" defaultValue="124000" /></label>
        <label><input name="active" type="checkbox" defaultChecked /> Active</label>
        <button className="checkout-button">Save kitchen</button>
      </form>
      <div className="cart-list">{kitchens.map((kitchen) => <article className="cart-row" key={kitchen.id}><div><b>{kitchen.kitchen_name}</b><small>{kitchen.city_id} · {kitchen.daily_capacity} meals · cutoff {kitchen.order_cutoff} IST · food ₹{kitchen.direct_cost_per_meal ?? 27} · fixed ₹{kitchen.monthly_fixed_cost ?? 124000} · {kitchen.active ? "active" : "inactive"}</small></div></article>)}</div>
      <div className="section-heading"><div><span className="kicker">SERVICEABILITY</span><h2>Schools</h2></div></div>
      <form className="checkout-modal" onSubmit={(event) => void saveCatalog(event, "school")}>
        <label>School ID<input name="schoolId" required pattern="[a-z0-9-]{3,60}" /></label>
        <label>School name<input name="schoolName" required minLength={3} /></label>
        <label>Area<input name="area" required /></label>
        <label>City<select name="cityId"><option value="chennai">Chennai</option><option value="madurai">Madurai</option><option value="trichy">Trichy</option><option value="coimbatore">Coimbatore</option></select></label>
        <label>Kitchen ID<input name="kitchenId" required /></label>
        <label>Price tier<select name="priceTier"><option value="market">Market · ₹49</option><option value="sponsored">Sponsored · ₹39</option></select></label>
        <button className="checkout-button">Save school</button>
      </form>
      <div className="section-heading"><div><span className="kicker">MENU</span><h2>Meal packages</h2></div></div>
      <form className="checkout-modal" onSubmit={(event) => void saveCatalog(event, "meal")}>
        <label>Meal ID<input name="mealId" required pattern="[a-z0-9-]{3,80}" /></label>
        <label>Service date<input name="serviceDate" required type="date" /></label>
        <label>Meal name<input name="mealName" required /></label>
        <label>Description<input name="description" required /></label>
        <label>Protein (g)<input name="protein" type="number" min="0" /></label>
        <label>Calories<input name="calories" type="number" min="0" /></label>
        <button className="checkout-button">Save meal</button>
      </form>
      <div className="section-heading"><div><span className="kicker">CALENDAR</span><h2>School holidays</h2></div></div>
      <form className="checkout-modal" onSubmit={(event) => void saveCatalog(event, "holiday")}>
        <label>School ID<input name="schoolId" required /></label>
        <label>Closed date<input name="serviceDate" required type="date" /></label>
        <label>Reason<input name="reason" required defaultValue="School closed" /></label>
        <button className="checkout-button">Close delivery date</button>
      </form>
      <div className="section-heading"><div><span className="kicker">PAYMENTS</span><h2>Reconciliation and refunds</h2></div></div>
      <button type="button" onClick={() => void loadPayments()}>Refresh payment orders</button>
      <form className="checkout-modal" onSubmit={refund}>
        <label>Order ID<input name="refundOrderId" required placeholder="LB-…" /></label>
        <label>Refund reason<input name="refundReason" required minLength={3} /></label>
        <button className="checkout-button">Issue full refund</button>
      </form>
      <div className="cart-list">{paymentOrders.map((order) => <article className="cart-row" key={order.id}><div><b>{order.id}</b><small>{order.status} · ₹{order.totalInr} · payment {order.paymentId || "missing"} · refund {order.refundId || "none"} · analytics {order.analyticsStatus}</small></div></article>)}</div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
