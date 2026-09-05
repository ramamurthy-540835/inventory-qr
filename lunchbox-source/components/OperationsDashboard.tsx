"use client";

import { FormEvent, useState } from "react";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";

type Role = "admin" | "kitchen" | "coordinator" | "driver";

export default function OperationsDashboard() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("");

  async function authenticated(phone: string | null) {
    if (!phone) return setRoles([]);
    const claims = (await firebaseAuth()?.currentUser?.getIdTokenResult(true))?.claims;
    const assigned = Array.isArray(claims?.roles) ? claims.roles.filter((role): role is Role => typeof role === "string") : [];
    setRoles(claims?.admin === true ? ["admin", "kitchen", "coordinator", "driver"] : assigned);
  }

  async function load(event: FormEvent<HTMLFormElement>, endpoint: string) {
    event.preventDefault();
    const values = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => values.set(key, String(value)));
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const response = await fetch(`${endpoint}?${values}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load operations data.");
    setResult(data);
    setMessage("");
  }

  async function deliver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const response = await fetch("/api/operations/delivery", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: new FormData(event.currentTarget) });
    const data = await response.json();
    setMessage(response.ok ? "Delivery confirmed and proof stored privately." : data.error || "Unable to confirm delivery.");
  }

  return <section className="menu-section">
    <div className="section-heading"><div><span className="kicker">OPERATIONS</span><h1>Daily fulfilment</h1></div><p>Role-scoped production, school manifest and delivery tools.</p></div>
    <ParentAuth onChange={(phone) => void authenticated(phone)} />
    {(roles.includes("kitchen") || roles.includes("admin")) && <form className="checkout-modal" onSubmit={(event) => void load(event, "/api/operations/kitchen")}>
      <h2>Kitchen production</h2><label>Kitchen ID<input name="kitchenId" required /></label><label>Service date<input name="serviceDate" type="date" required /></label><button className="checkout-button">Load production totals</button>
    </form>}
    {(roles.includes("coordinator") || roles.includes("admin")) && <form className="checkout-modal" onSubmit={(event) => void load(event, "/api/operations/school")}>
      <h2>School manifest</h2><label>School ID<input name="schoolId" required /></label><label>Service date<input name="serviceDate" type="date" required /></label><button className="checkout-button">Load student manifest</button>
    </form>}
    {(roles.includes("driver") || roles.includes("admin")) && <>
      <form className="checkout-modal" onSubmit={(event) => void load(event, "/api/operations/delivery")}><h2>Delivery route</h2><label>Route ID<input name="routeId" required /></label><label>Service date<input name="serviceDate" type="date" required /></label><button className="checkout-button">Load route</button></form>
      <form className="checkout-modal" onSubmit={deliver}><h2>Confirm delivery</h2><label>Route ID<input name="routeId" required /></label><label>School ID<input name="schoolId" required /></label><label>Service date<input name="serviceDate" type="date" required /></label><label>Delivery photo<input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="checkout-button">Confirm and upload proof</button></form>
    </>}
    {message && <p role="status">{message}</p>}
    {result !== null && <pre>{JSON.stringify(result, null, 2)}</pre>}
  </section>;
}
