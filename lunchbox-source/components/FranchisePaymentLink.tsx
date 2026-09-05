"use client";
import { useState } from "react";
export default function FranchisePaymentLink({ applicationId }: { applicationId: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function continueToPayment() { setBusy(true); setMessage(""); try { const response = await fetch(`/api/franchise-applications/${encodeURIComponent(applicationId)}/payment-link`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to create payment link."); window.location.assign(data.url); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create payment link."); setBusy(false); } }
  return <><button className="primary-button payment-link-button" onClick={continueToPayment} disabled={busy || !applicationId}>{busy ? "Creating secure payment link…" : "Continue to secure payment"} <span>→</span></button>{message && <p className="payment-link-error" role="alert">{message}</p>}</>;
}
