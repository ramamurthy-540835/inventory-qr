"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";
import type { DailyExpenseAmounts, OperationsPlan } from "@/lib/operations-costs";

type Kitchen = { id: string; kitchen_name: string };
type CostResponse = {
  plan: OperationsPlan;
  monthlyPayrollInr: number;
  dailyExpense: { serviceDate: string; amounts: DailyExpenseAmounts; totalInr: number; notes: string };
  monthToDateExpenseInr: number;
};

const expenseLabels: Record<keyof DailyExpenseAmounts, string> = {
  gas: "Gas / fuel", water: "Water", cleaning: "Cleaning supplies", transport: "Transport", utilities: "Utilities", repairs: "Repairs", other: "Other",
};

function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }

export default function OperationsCostManager() {
  const [authorized, setAuthorized] = useState(false);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [costs, setCosts] = useState<CostResponse | null>(null);
  const [selection, setSelection] = useState({ kitchenId: "", serviceDate: new Date().toISOString().slice(0, 10) });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const authenticated = useCallback(async (phone: string | null) => {
    if (!phone) return setAuthorized(false);
    const tokenResult = await firebaseAuth()?.currentUser?.getIdTokenResult(true);
    const roles = Array.isArray(tokenResult?.claims.roles) ? tokenResult.claims.roles : [];
    if (tokenResult?.claims.admin !== true && !roles.includes("admin")) {
      setMessage("Administrator access is required.");
      return setAuthorized(false);
    }
    setAuthorized(true);
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const response = await fetch("/api/admin/kitchens", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load kitchens.");
    setKitchens(data.kitchens);
    setSelection((current) => ({ ...current, kitchenId: current.kitchenId || data.kitchens[0]?.id || "" }));
    setMessage("");
  }, []);

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!selection.kitchenId) return setMessage("Select a kitchen.");
    setMessage("Loading operating plan…");
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const query = new URLSearchParams(selection);
    const response = await fetch(`/api/ops/costs?${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load operating costs.");
    setCosts(data);
    setMessage("");
  }

  async function saveExpenses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const amounts = Object.fromEntries(Object.keys(expenseLabels).map((key) => [key, Number(form.get(key) || 0)]));
      const token = await firebaseAuth()?.currentUser?.getIdToken(true);
      const response = await fetch("/api/ops/costs", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...selection, amounts, notes: form.get("notes") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save daily expenses.");
      setMessage(`Daily expenses saved: ${money(data.totalInr)}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save daily expenses.");
    } finally { setSaving(false); }
  }

  return <main className="cost-page">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">L</span><span>Lunch<span>Box</span></span></Link><Link className="cost-back" href="/ops">← Control room</Link></header>
    <section className="menu-section cost-dashboard">
      <div className="section-heading"><div><span className="kicker">COST &amp; MATERIAL CONTROL</span><h1>Daily operations ledger</h1></div><p>Staff commitments, planned food quantities, and actual daily maintenance expenses. Administrator access only.</p></div>
      <ParentAuth onChange={(phone) => void authenticated(phone)} />
      {authorized && <>
        <form className="ops-filter" onSubmit={(event) => void load(event)}>
          <label>Kitchen<select value={selection.kitchenId} onChange={(event) => setSelection({ ...selection, kitchenId: event.target.value })} required><option value="">Select kitchen</option>{kitchens.map((kitchen) => <option value={kitchen.id} key={kitchen.id}>{kitchen.kitchen_name}</option>)}</select></label>
          <label>Operating date<input type="date" value={selection.serviceDate} onChange={(event) => setSelection({ ...selection, serviceDate: event.target.value })} required /></label>
          <button className="checkout-button">Load plan</button>
        </form>

        {costs && <>
          <div className="cost-metrics"><article><small>Monthly payroll</small><b>{money(costs.monthlyPayrollInr)}</b><span>{costs.plan.staff.length} team members</span></article><article><small>Daily maintenance</small><b>{money(costs.dailyExpense.totalInr)}</b><span>{costs.dailyExpense.serviceDate}</span></article><article><small>Month-to-date maintenance</small><b>{money(costs.monthToDateExpenseInr)}</b><span>Recorded through selected date</span></article></div>

          <section className="cost-panel"><div className="cost-panel-heading"><div><span className="kicker">STAFF PLAN</span><h2>Monthly salary commitments</h2></div><span className="source-note">Source: handwritten plan</span></div><div className="cost-table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Base</th><th>Allowance</th><th>Total</th><th>Data status</th></tr></thead><tbody>{costs.plan.staff.map((member) => <tr key={member.id}><td><b>{member.name}</b></td><td>{member.role}</td><td>{money(member.baseSalaryInr)}</td><td>{money(member.allowanceInr)}</td><td><b>{money(member.monthlyTotalInr)}</b></td><td>{member.needsConfirmation ? <span className="needs-confirmation">Confirm</span> : <span className="confirmed-data">Recorded</span>}</td></tr>)}</tbody><tfoot><tr><td colSpan={4}>Total monthly payroll</td><td>{money(costs.monthlyPayrollInr)}</td><td /></tr></tfoot></table></div></section>

          <section className="cost-panel"><div className="cost-panel-heading"><div><span className="kicker">LUNCH</span><h2>General material plan</h2></div><span className="source-note">Quantities, not purchase costs</span></div><div className="material-grid">{costs.plan.lunchMaterials.map((material) => <article key={material.item}><span>{material.item}</span><b>{material.quantity} <small>{material.unit}</small></b></article>)}</div></section>

          <section className="cost-panel"><div className="cost-panel-heading"><div><span className="kicker">MORNING PRODUCTION</span><h2>Breakfast preparation plan</h2></div><span className="needs-confirmation">Four values require confirmation</span></div><div className="production-plan-grid">{costs.plan.morningProduction.map((item) => <article key={item.id}><header><div><h3>{item.name}</h3>{item.plannedOutputMin !== null && <b>{item.plannedOutputMin === item.plannedOutputMax ? item.plannedOutputMin : `${item.plannedOutputMin}–${item.plannedOutputMax}`} <small>{item.outputUnit}</small></b>}</div>{item.needsConfirmation && <span className="needs-confirmation">Confirm</span>}</header><ul>{item.ingredients.map((ingredient) => <li key={`${item.id}-${ingredient.item}`}><span>{ingredient.item}</span><b>{ingredient.quantity} {ingredient.unit}{ingredient.needsConfirmation ? " *" : ""}</b></li>)}</ul>{item.note && <p>{item.note}</p>}</article>)}</div></section>

          <section className="cost-panel"><div className="cost-panel-heading"><div><span className="kicker">ACTUAL EXPENSES</span><h2>Daily maintenance entry</h2></div><b>{selection.serviceDate}</b></div><form className="expense-form" onSubmit={saveExpenses}>{Object.entries(expenseLabels).map(([key, label]) => <label key={key}>{label} (₹)<input name={key} type="number" min="0" max="1000000" step="0.01" defaultValue={costs.dailyExpense.amounts[key as keyof DailyExpenseAmounts]} /></label>)}<label className="expense-notes">Notes<textarea name="notes" maxLength={500} defaultValue={costs.dailyExpense.notes} placeholder="Invoice references, repairs, or exceptional costs" /></label><button className="checkout-button" disabled={saving}>{saving ? "Saving…" : "Save daily expenses"}</button></form></section>
        </>}
      </>}
      {message && <p className="ops-warning" role="status">{message}</p>}
    </section>
  </main>;
}
