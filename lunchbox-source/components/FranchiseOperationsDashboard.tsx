"use client";

import { FormEvent, useCallback, useState } from "react";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";

type Kitchen = { id: string; kitchen_name: string };
type Breakdown = { schoolId: string; schoolName: string; gradeBand: string; paidMeals: number; freeMeals: number; producedMeals: number };
type Meeting = { id: string; school_name: string; contact_person: string; date_time: string; purpose: string; status: string };
type Dashboard = {
  kitchenName: string;
  serviceDate: string;
  config: { directCostPerMeal: number; monthlyFixedCost: number };
  daily: { paidMeals: number; freeMeals: number; producedMeals: number; revenue: number; foodValue: number; contribution: number; breakdown: Breakdown[]; productionSheet: Record<string, number> };
  monthToDate: { serviceMonth: string; revenue: number; foodValue: number; freeMealSubsidyCost: number; contributionBeforeFixed: number; monthlyFixedCost: number; contributionAfterFixed: number; indicator: "on-track" | "loss" };
  upcomingMeetings: Meeting[];
};

function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }

export default function FranchiseOperationsDashboard() {
  const [authorized, setAuthorized] = useState(false);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");

  const authenticated = useCallback(async (phone: string | null) => {
    if (!phone) return setAuthorized(false);
    const tokenResult = await firebaseAuth()?.currentUser?.getIdTokenResult(true);
    if (tokenResult?.claims.admin !== true) {
      setMessage("Administrator access is required.");
      return setAuthorized(false);
    }
    setAuthorized(true);
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const response = await fetch("/api/admin/kitchens", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (response.ok) setKitchens(data.kitchens);
    else setMessage(data.error || "Unable to load kitchens.");
  }, []);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams({ kitchenId: String(form.get("kitchenId")), serviceDate: String(form.get("serviceDate")) });
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const response = await fetch(`/api/ops/dashboard?${query}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load operations dashboard.");
    setDashboard(data);
    setMessage("");
  }

  return <section className="menu-section ops-dashboard">
    <div className="section-heading"><div><span className="kicker">FRANCHISE OPERATIONS</span><h1>Kitchen control room</h1></div><p>Production, contribution, free-meal subsidy and school appointment visibility.</p></div>
    <ParentAuth onChange={(phone) => void authenticated(phone)} />
    {authorized && <>
      <form className="ops-filter no-print" onSubmit={load}>
        <label>Kitchen<select name="kitchenId" required>{kitchens.map((kitchen) => <option key={kitchen.id} value={kitchen.id}>{kitchen.kitchen_name}</option>)}</select></label>
        <label>Production date<input name="serviceDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <button className="checkout-button">Load dashboard</button>
        <a href="/ops/appointments">Appointments</a>
      </form>
      {dashboard && <>
        <div className="ops-metrics">
          <article><small>Meals to produce</small><b>{dashboard.daily.producedMeals}</b><span>{dashboard.daily.paidMeals} paid · {dashboard.daily.freeMeals} free</span></article>
          <article><small>Daily revenue</small><b>{money(dashboard.daily.revenue)}</b><span>Food value {money(dashboard.daily.foodValue)}</span></article>
          <article><small>Daily contribution</small><b>{money(dashboard.daily.contribution)}</b><span>Direct cost {money(dashboard.config.directCostPerMeal)} / meal</span></article>
          <article className={dashboard.monthToDate.indicator}><small>MTD after fixed cost</small><b>{money(dashboard.monthToDate.contributionAfterFixed)}</b><span>{dashboard.monthToDate.indicator === "on-track" ? "On track" : "Loss"}</span></article>
        </div>
        <section className="ops-panel">
          <h2>Month to date · {dashboard.monthToDate.serviceMonth}</h2>
          <div className="ops-finance"><span>Revenue <b>{money(dashboard.monthToDate.revenue)}</b></span><span>Food value <b>{money(dashboard.monthToDate.foodValue)}</b></span><span>Free-meal subsidy <b>{money(dashboard.monthToDate.freeMealSubsidyCost)}</b></span><span>Fixed cost <b>{money(dashboard.monthToDate.monthlyFixedCost)}</b></span></div>
        </section>
        <section className="ops-panel production-sheet">
          <div className="section-heading"><div><span className="kicker">PRINTABLE</span><h2>{dashboard.kitchenName} production sheet</h2><p>{dashboard.serviceDate}</p></div><button className="no-print" onClick={() => window.print()}>Print sheet</button></div>
          <table><thead><tr><th>School</th><th>Grade</th><th>Paid</th><th>Free</th><th>Total</th></tr></thead><tbody>{dashboard.daily.breakdown.map((row) => <tr key={`${row.schoolId}-${row.gradeBand}`}><td>{row.schoolName}</td><td>{row.gradeBand}</td><td>{row.paidMeals}</td><td>{row.freeMeals}</td><td>{row.producedMeals}</td></tr>)}</tbody></table>
          <div className="production-items">{Object.entries(dashboard.daily.productionSheet).map(([item, quantity]) => <span key={item}><b>{quantity}</b>{item.replace(/([A-Z])/g, " $1")}</span>)}</div>
        </section>
        <section className="ops-panel no-print"><h2>Upcoming school meetings</h2>{dashboard.upcomingMeetings.length ? dashboard.upcomingMeetings.map((meeting) => <p key={meeting.id}><b>{meeting.school_name}</b> · {new Date(meeting.date_time).toLocaleString("en-IN")} · {meeting.purpose} · {meeting.contact_person}</p>) : <p>No upcoming meetings.</p>}</section>
      </>}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
