"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import EntitySearchAutocomplete from "@/components/EntitySearchAutocomplete";
import type { EntityType, LocationEntityResult } from "@/lib/entity-locator/types";

const COPY = {
  office: { location: "workplace", kicker: "OFFICE WORKER MEAL REGISTRATION", heading: "Register for lunch at work.", description: "Find your workplace, then enter your own details and meal preferences." },
  company: { location: "company", kicker: "OFFICE WORKER MEAL REGISTRATION", heading: "Register for lunch at work.", description: "Find your employer, then enter your own details and meal preferences." },
  college: { location: "college", kicker: "COLLEGE STUDENT MEAL REGISTRATION", heading: "Register for college meals.", description: "Find your college, then enter your student details and meal preferences." },
} as const;

function mapsUrl(entity: LocationEntityResult) {
  const params = new URLSearchParams({ api: "1", query: entity.formatted_address });
  if (entity.provider_place_id) params.set("query_place_id", entity.provider_place_id);
  return `https://www.google.com/maps/search/?${params}`;
}

export default function EntityRegistrationForm({ entityType, onBusinessTypeChange }: { entityType: EntityType; onBusinessTypeChange?: (type: "office" | "company") => void }) {
  const copy = COPY[entityType];
  const isCollege = entityType === "college";
  const [selected, setSelected] = useState<LocationEntityResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submittedReference, setSubmittedReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submittedReference) return;
    setSubmitting(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const body = Object.fromEntries(form.entries()); body[`${entityType}_id`] = selected.id;
      const response = await fetch(`/api/${entityType}-registration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { referenceId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to complete your meal registration.");
      setSubmittedReference(data.referenceId || "Received");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete your meal registration."); }
    finally { setSubmitting(false); }
  }

  function reset() { setSelected(null); setMessage(""); setSubmittedReference(""); }

  return <main className="school-search-page">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">L</span><span>Lunch<span>Box</span></span></Link><nav className="registration-mini-nav" aria-label="Meal registration types"><Link href="/schools/register">Parent / Child</Link><Link className={isCollege ? "active" : ""} href="/register/college">College Student</Link><Link className={!isCollege ? "active" : ""} href="/register/office-company">Office Worker</Link></nav></header>
    <section className="school-search-shell">
      <div className="school-search-heading"><span className="kicker">{copy.kicker}</span><h1>{copy.heading}</h1><p>{copy.description}</p>{onBusinessTypeChange && <div className="business-type-switch" role="group" aria-label="How would you like to find your workplace?"><button className={entityType === "office" ? "active" : ""} type="button" onClick={() => onBusinessTypeChange("office")}>Search office location</button><button className={entityType === "company" ? "active" : ""} type="button" onClick={() => onBusinessTypeChange("company")}>Search company name</button></div>}</div>
      <div className="registration-progress" aria-label="Registration progress"><span className={selected ? "complete" : "active"}>1 <b>Find {copy.location}</b></span><span className={selected ? "active" : ""}>2 <b>Your details</b></span><span>3 <b>Meal preferences</b></span></div>
      <EntitySearchAutocomplete entityType={entityType} value={selected} onChange={(entity) => { setSelected(entity); setMessage(""); setSubmittedReference(""); }} />
      {selected && <form className="selected-school-panel entity-registration-panel" onSubmit={submit}>
        <div className="selected-school-heading"><div><span className="kicker">SELECTED {copy.location.toUpperCase()}</span><h2>{selected.display_name}</h2></div><span className="school-source-badge">{selected.provider === "google" ? "Google" : selected.provider === "manual" ? "Manual" : "Directory"}</span></div>
        {selected.outside_selected_zone && <p className="school-zone-warning">Located in another zone: {selected.zone_name}</p>}
        <div className="selected-school-fields"><label>{copy.location} name<input readOnly value={selected.display_name} /></label><label>Locality<input readOnly value={selected.locality} /></label><label className="selected-address">Address<textarea readOnly value={selected.formatted_address} /></label><label>Zone<input readOnly value={selected.zone_name} /></label><label>City<input readOnly value={selected.city_name} /></label><label>Pincode<input readOnly value={selected.postal_code || ""} /></label></div>

        {isCollege ? <div className="entity-form-section"><h3>Your student details</h3><p className="registration-required-note">Enter the details of the student who will receive the meals.</p><div className="selected-school-fields">
          <label>Student full name *<input name="student_name" required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label>Mobile number *<input name="student_phone" required inputMode="tel" autoComplete="tel" placeholder="9876543210" pattern="(?:\+91)?[6-9][0-9]{9}" /></label>
          <label>Email<input name="student_email" type="email" maxLength={160} autoComplete="email" /></label>
          <label>Student / roll number<input name="student_id" maxLength={80} /></label>
          <label>Course / programme *<input name="course_name" required minLength={2} maxLength={120} placeholder="e.g. B.Com, B.E. CSE" /></label>
          <label>Year of study *<select name="study_year" required defaultValue=""><option value="" disabled>Select year</option><option value="1">First year</option><option value="2">Second year</option><option value="3">Third year</option><option value="4">Fourth year</option><option value="5+">Fifth year or above</option></select></label>
          <label>Student type<select name="student_type" defaultValue=""><option value="">Select</option><option value="day_scholar">Day scholar</option><option value="hosteller">Hosteller</option></select></label>
        </div></div> : <div className="entity-form-section"><h3>Your employee details</h3><p className="registration-required-note">Enter your own details—not the organization&apos;s contact information.</p><div className="selected-school-fields">
          <label>Employee full name *<input name="employee_name" required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label>Mobile number *<input name="employee_phone" required inputMode="tel" autoComplete="tel" placeholder="9876543210" pattern="(?:\+91)?[6-9][0-9]{9}" /></label>
          <label>Email<input name="employee_email" type="email" maxLength={160} autoComplete="email" /></label>
          <label>Employee ID<input name="employee_id" maxLength={80} /></label>
          <label>Designation<input name="designation" maxLength={120} autoComplete="organization-title" /></label>
          <label>Department<input name="department" maxLength={120} /></label>
          <label>Work schedule<select name="work_schedule" defaultValue=""><option value="">Select</option><option value="Monday–Friday">Monday–Friday</option><option value="Monday–Saturday">Monday–Saturday</option><option value="Shift based">Shift based</option><option value="Hybrid">Hybrid</option></select></label>
        </div></div>}

        <div className="entity-form-section"><h3>Your meal preferences</h3><p className="registration-required-note">These details help us suggest suitable LunchBox meal plans.</p><div className="selected-school-fields">
          <label>Dietary preference<select name="dietary_preference" defaultValue="vegetarian"><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="no_preference">No preference</option></select></label>
          <label>Meal plan interest<select name="meal_plan_interest" defaultValue=""><option value="">Select</option><option value="daily_lunch">Daily lunch</option><option value="weekly_plan">Weekly plan</option><option value="monthly_plan">Monthly subscription</option><option value="trial">Trial meal</option></select></label>
          <label>Preferred lunch time<input name="preferred_meal_time" type="time" /></label>
          <label className="selected-address">Allergies or dietary notes<textarea name="allergies" maxLength={500} placeholder="Tell us about any food allergies. Leave blank if none." /></label>
        </div></div>
        <label className="registration-consent"><input name="consent" type="checkbox" required /> <span>I confirm these details are correct and allow LunchBox to contact me about my meal registration.</span></label>
        {!submittedReference && <div className="selected-school-actions"><button className="checkout-button" disabled={submitting}>{submitting ? "Submitting…" : "Submit meal registration"}</button><a href={mapsUrl(selected)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a><button type="button" className="change-school-button" onClick={reset}>Change {copy.location}</button></div>}
        {message && <p className="school-registration-message registration-error-message" role="alert">{message}</p>}
        {submittedReference && <div className="registration-success-card" role="status"><span>Meal registration received</span><h3>Thank you. Your details have been saved.</h3><p>Save this reference: <b>{submittedReference}</b></p><button type="button" onClick={reset}>Register another person</button></div>}
      </form>}
    </section>
  </main>;
}
