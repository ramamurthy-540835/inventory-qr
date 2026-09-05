"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";
import { franchiseApplicationStatuses, type FranchiseApplication, type FranchiseApplicationStatus } from "@/lib/franchise-applications";

type ViewState = "empty" | "loading" | "found" | "not-found" | "error";

const statusLabels: Record<FranchiseApplicationStatus, string> = {
  RECEIVED: "Received",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
};

function display(value: string | null) {
  return value || "Not provided";
}

function submittedDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function FranchiseApplicationLookup() {
  const [authorized, setAuthorized] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [application, setApplication] = useState<FranchiseApplication | null>(null);
  const [viewState, setViewState] = useState<ViewState>("empty");
  const [message, setMessage] = useState("");
  const [applications, setApplications] = useState<FranchiseApplication[]>([]);
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    const token = await firebaseAuth()?.currentUser?.getIdToken(true);
    if (!token) throw new Error("Your administrator session has expired.");
    const response = await fetch("/api/admin/franchise-applications", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json() as { applications?: FranchiseApplication[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Unable to load franchise applications.");
    setApplications(payload.applications || []);
  }, []);

  const authenticationChanged = useCallback(async (phone: string | null) => {
    setApplication(null);
    setViewState("empty");
    setMessage("");
    if (!phone) return setAuthorized(false);

    const claims = await firebaseAuth()?.currentUser?.getIdTokenResult(true);
    const roles = Array.isArray(claims?.claims.roles) ? claims.claims.roles : [];
    const isAdmin = claims?.claims.admin === true || roles.includes("admin");
    setAuthorized(isAdmin);
    if (!isAdmin) setMessage("This internal page requires administrator access.");
    else try { await loadApplications(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load franchise applications."); }
  }, [loadApplications]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!application) return; setSaving(true); setMessage("");
    try { const token = await firebaseAuth()?.currentUser?.getIdToken(true); const form = new FormData(event.currentTarget); const response = await fetch("/api/admin/franchise-applications", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ referenceId: application.referenceId, status: form.get("status"), assignedTo: form.get("assigned_to"), notes: form.get("notes") }) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "Unable to update application."); setMessage("Franchise workflow updated."); await loadApplications(); setApplication((current) => current ? { ...current, status: String(form.get("status")) as FranchiseApplicationStatus, notes: String(form.get("notes") || "") || null } : null); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update application."); } finally { setSaving(false); }
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReferenceId = referenceId.trim().toUpperCase();
    if (!/^FR-[A-Z0-9]{8,24}$/.test(normalizedReferenceId)) {
      setApplication(null);
      setViewState("error");
      return setMessage("Enter a valid reference ID, for example FR-FA5B231F.");
    }

    setReferenceId(normalizedReferenceId);
    setApplication(null);
    setMessage("");
    setViewState("loading");
    try {
      const token = await firebaseAuth()?.currentUser?.getIdToken(true);
      if (!token) throw new Error("Your administrator session has expired. Please sign in again.");
      const response = await fetch(`/api/franchise-applications/${encodeURIComponent(normalizedReferenceId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json() as { application?: FranchiseApplication; error?: string };
      if (response.status === 404) {
        setViewState("not-found");
        return setMessage(payload.error || "No application was found for that reference ID.");
      }
      if (!response.ok || !payload.application) throw new Error(payload.error || "Unable to retrieve the application.");
      setApplication(payload.application);
      setViewState("found");
    } catch (error) {
      setViewState("error");
      setMessage(error instanceof Error ? error.message : "Unable to retrieve the application.");
    }
  }

  return <main className="franchise-admin-page">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="LunchBox home"><span className="brand-mark">L</span><span>Lunch<span>Box</span></span></Link>
      <span className="internal-pill">Internal admin</span>
    </header>
    <section className="franchise-admin-shell">
      <div className="franchise-admin-heading">
        <div><span className="kicker">FRANCHISE ADMINISTRATION</span><h1>Application lookup</h1></div>
        <p>Find an applicant by their reference ID. Personal information is restricted to authorized administrators.</p>
      </div>

      <section className="admin-auth-panel" aria-label="Administrator authentication">
        <div><b>Secure access</b><span>Sign in with an account carrying the Firebase admin role.</span></div>
        <ParentAuth onChange={(phone) => void authenticationChanged(phone)} />
      </section>

      {authorized && <>
        <form className="application-lookup-form" onSubmit={lookup}>
          <label htmlFor="franchise-reference">Reference ID</label>
          <div><input id="franchise-reference" value={referenceId} onChange={(event) => setReferenceId(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 27))} placeholder="FR-FA5B231F" autoComplete="off" spellCheck={false} aria-describedby="reference-help" /><button className="checkout-button" disabled={viewState === "loading"}>{viewState === "loading" ? "Searching…" : "Search application"}</button></div>
          <small id="reference-help">Use the reference shared when the application was submitted.</small>
        </form>

        <section className="franchise-queue"><header><h2>Recent applications</h2><span>{applications.length} records</span></header><div>{applications.map((item) => <button type="button" className={application?.referenceId === item.referenceId ? "selected" : ""} key={item.referenceId} onClick={() => { setApplication(item); setReferenceId(item.referenceId); setViewState("found"); setMessage(""); }}><b>{item.applicantName || "Unnamed applicant"}</b><small>{item.referenceId} · {item.selectedCity}</small><span className={`application-status status-${item.status.toLowerCase().replace("_", "-")}`}>{statusLabels[item.status]}</span></button>)}</div></section>

        {viewState === "empty" && <section className="lookup-state"><span aria-hidden="true">⌕</span><h2>Search for an application</h2><p>Enter a franchise reference ID above to view the applicant’s details.</p></section>}
        {viewState === "loading" && <section className="lookup-state" aria-live="polite"><span className="lookup-spinner" aria-hidden="true" /><h2>Loading application</h2><p>Retrieving the latest record securely…</p></section>}
        {viewState === "not-found" && <section className="lookup-state lookup-not-found" role="status"><span aria-hidden="true">?</span><h2>Application not found</h2><p>{message}</p></section>}
        {viewState === "error" && <section className="lookup-state lookup-error" role="alert"><span aria-hidden="true">!</span><h2>Something went wrong</h2><p>{message}</p></section>}

        {viewState === "found" && application && <article className="application-detail-card">
          <header>
            <div><span className="detail-label">REFERENCE ID</span><h2>{application.referenceId}</h2></div>
            <span className={`application-status status-${application.status.toLowerCase().replace("_", "-")}`}>{statusLabels[application.status]}</span>
          </header>
          <div className="application-detail-grid">
            <section><span className="detail-icon" aria-hidden="true">Aa</span><div><span className="detail-label">APPLICANT NAME</span><b>{display(application.applicantName)}</b></div></section>
            <section><span className="detail-icon" aria-hidden="true">☎</span><div><span className="detail-label">PHONE NUMBER</span><b>{display(application.phone)}</b></div></section>
            <section><span className="detail-icon" aria-hidden="true">@</span><div><span className="detail-label">EMAIL</span><b>{display(application.email)}</b></div></section>
            <section><span className="detail-icon" aria-hidden="true">⌖</span><div><span className="detail-label">SELECTED CITY</span><b>{display(application.selectedCity)}</b></div></section>
            <section><span className="detail-icon" aria-hidden="true">₹</span><div><span className="detail-label">INVESTMENT READINESS</span><b>{display(application.investmentReadiness)}</b></div></section>
            <section><span className="detail-icon" aria-hidden="true">◷</span><div><span className="detail-label">SUBMITTED</span><b>{submittedDate(application.submittedAt)}</b><small>India Standard Time</small></div></section>
          </div>
          <section className="application-long-detail"><span className="detail-label">EXPERIENCE / BACKGROUND</span><p>{display(application.experienceBackground)}</p></section>
          {application.notes && <section className="application-long-detail application-notes"><span className="detail-label">INTERNAL NOTES</span><p>{application.notes}</p></section>}
          <form className="franchise-review-form" onSubmit={update}><label>Status<select name="status" defaultValue={application.status}>{franchiseApplicationStatuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label>Assigned owner<input name="assigned_to" maxLength={120} /></label><label className="franchise-review-notes">Internal notes<textarea name="notes" defaultValue={application.notes || ""} maxLength={2000} /></label><button className="checkout-button" disabled={saving}>{saving ? "Saving…" : "Save workflow"}</button></form>
        </article>}
      </>}
      {!authorized && message && <p className="admin-access-error" role="alert">{message}</p>}
    </section>
  </main>;
}
