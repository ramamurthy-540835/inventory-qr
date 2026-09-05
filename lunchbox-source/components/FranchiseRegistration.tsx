"use client";

import { FormEvent, useState } from "react";

type Field = "name" | "companyName" | "category" | "area" | "address" | "contactName" | "phone" | "email" | "website" | "latitude" | "longitude";
type Props = { initialArea?: string; initialCity?: string; opportunityId?: string; onSuccess?: () => void; redirectToPayment?: boolean };

const fields: { id: Field; label: string; type?: string; required?: boolean; wide?: boolean }[] = [
  { id: "name", label: "Franchise name", required: true }, { id: "companyName", label: "Company name", required: true }, { id: "category", label: "Business category", required: true }, { id: "area", label: "Service area", required: true }, { id: "address", label: "Full address", required: true, wide: true }, { id: "contactName", label: "Contact person", required: true }, { id: "phone", label: "10-digit mobile", required: true, type: "tel" }, { id: "email", label: "Business email", required: true, type: "email" }, { id: "website", label: "Website", type: "url" }, { id: "latitude", label: "Latitude", type: "number" }, { id: "longitude", label: "Longitude", type: "number" },
];

export default function FranchiseRegistration({ initialArea = "", initialCity = "Chennai", opportunityId = "", onSuccess, redirectToPayment = false }: Props) {
  const [message, setMessage] = useState(""); const [errors, setErrors] = useState<Record<string, string[]>>({}); const [busy, setBusy] = useState(false); const [reference, setReference] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setErrors({}); setMessage("");
    try {
      const response = await fetch("/api/franchise-applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const body = await response.json();
      if (!response.ok) { setErrors(body.fields || {}); setMessage(body.error || "Unable to submit your application."); return; }
      if (redirectToPayment) { window.location.assign(`/franchise/payment?applicationId=${encodeURIComponent(body.id)}`); return; }
      setReference(body.id);
    } catch { setMessage("Unable to submit your application. Please try again."); }
    finally { setBusy(false); }
  }
  if (reference) return <section className="franchise-registration" id="register-franchise"><span className="kicker">APPLICATION RECEIVED</span><h2>Your franchise application has been submitted for verification.</h2><p>Reference: <b>{reference}</b></p><p>Approved businesses will appear in the selected city directory.</p>{onSuccess && <button className="registration-done" onClick={onSuccess}>Done</button>}</section>;
  return <section className="franchise-registration" id="register-franchise"><div><span className="kicker">GROW WITH US</span><h2 id="registration-title">Register your LunchBox franchise.</h2><p>Submit your business details for verification. Approved businesses appear in the public directory.</p></div><form className="franchise-registration-form" onSubmit={submit} noValidate><input type="hidden" name="opportunityId" value={opportunityId} /><input type="hidden" name="city" value={initialCity} />{fields.map((field) => <div className={`franchise-field ${field.wide ? "franchise-field-wide" : ""}`} key={field.id}><label htmlFor={`franchise-${field.id}`}>{field.label}{field.required ? " *" : ""}</label><input id={`franchise-${field.id}`} name={field.id} defaultValue={field.id === "area" ? initialArea : ""} required={field.required} type={field.type || "text"} inputMode={field.id === "phone" ? "numeric" : undefined} aria-invalid={Boolean(errors[field.id])} aria-describedby={errors[field.id] ? `franchise-${field.id}-error` : undefined} />{errors[field.id] && <small id={`franchise-${field.id}-error`} role="alert">{errors[field.id][0]}</small>}</div>)}<div className="franchise-submit"><button disabled={busy}>{busy ? "Submitting..." : "Submit for review"}</button>{message && <p role="status">{message}</p>}</div></form></section>;
}
