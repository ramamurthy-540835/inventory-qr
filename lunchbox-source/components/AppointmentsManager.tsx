"use client";

import { FormEvent, useCallback, useState } from "react";
import ParentAuth from "@/components/ParentAuth";
import { firebaseAuth } from "@/lib/firebase-client";

type Kitchen = { id: string; kitchen_name: string };
type Staff = { id: string; name: string; role: string; monthly_salary: number; joining_date: string; phone: string; medical_cert_expiry: string; active: boolean };
type Meeting = { id: string; school_id: string; school_name: string; contact_person: string; date_time: string; purpose: string; status: string; notes: string; active: boolean };

export default function AppointmentsManager() {
  const [authorized, setAuthorized] = useState(false);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [kitchenId, setKitchenId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [warnings, setWarnings] = useState<Staff[]>([]);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [message, setMessage] = useState("");

  const token = () => firebaseAuth()?.currentUser?.getIdToken();
  const load = useCallback(async (selectedKitchen: string) => {
    if (!selectedKitchen) return;
    const auth = await token();
    const response = await fetch(`/api/ops/appointments?kitchenId=${encodeURIComponent(selectedKitchen)}`, { headers: { Authorization: `Bearer ${auth}` } });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load appointments.");
    setStaff(data.staff);
    setMeetings(data.meetings);
    setWarnings(data.certificateWarnings);
    setMessage("");
  }, []);

  const authenticated = useCallback(async (phone: string | null) => {
    if (!phone) return setAuthorized(false);
    const claims = (await firebaseAuth()?.currentUser?.getIdTokenResult(true))?.claims;
    if (claims?.admin !== true) { setMessage("Administrator access is required."); return setAuthorized(false); }
    setAuthorized(true);
    const auth = await token();
    const response = await fetch("/api/admin/kitchens", { headers: { Authorization: `Bearer ${auth}` } });
    const data = await response.json();
    if (response.ok) {
      setKitchens(data.kitchens);
      const first = data.kitchens[0]?.id || "";
      setKitchenId(first);
      await load(first);
    } else setMessage(data.error || "Unable to load kitchens.");
  }, [load]);

  async function save(payload: Record<string, unknown>) {
    const auth = await token();
    const response = await fetch("/api/ops/appointments", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` }, body: JSON.stringify({ kitchenId, ...payload }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to save appointment.");
    setEditingStaff(null);
    setEditingMeeting(null);
    setMessage("Appointment saved.");
    await load(kitchenId);
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    await save({ recordType: "staff", id: editingStaff?.id, name: form.name, role: form.role, monthlySalary: form.monthlySalary, joiningDate: form.joiningDate, phone: form.phone, medicalCertExpiry: form.medicalCertExpiry, active: true });
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    await save({ recordType: "meeting", id: editingMeeting?.id, schoolId: form.schoolId, schoolName: form.schoolName, contactPerson: form.contactPerson, dateTime: new Date(String(form.dateTime)).toISOString(), purpose: form.purpose, status: form.status, notes: form.notes, active: true });
  }

  return <section className="menu-section ops-dashboard">
    <div className="section-heading"><div><span className="kicker">APPOINTMENTS</span><h1>People and school meetings</h1></div><p>Simple appointment records only; no payroll processing.</p></div>
    <ParentAuth onChange={(phone) => void authenticated(phone)} />
    {authorized && <>
      <div className="ops-filter"><label>Kitchen<select value={kitchenId} onChange={(event) => { setKitchenId(event.target.value); void load(event.target.value); }}>{kitchens.map((kitchen) => <option key={kitchen.id} value={kitchen.id}>{kitchen.kitchen_name}</option>)}</select></label><a href="/ops">Back to operations</a></div>
      {warnings.length > 0 && <section className="ops-warning"><h2>Medical certificates expiring within 30 days</h2>{warnings.map((person) => <p key={person.id}><b>{person.name}</b> · {person.role} · expires {person.medical_cert_expiry}</p>)}</section>}
      <div className="ops-columns">
        <section className="ops-panel"><h2>{editingStaff ? "Edit" : "Add"} staff appointment</h2><form key={editingStaff?.id || "new-staff"} className="ops-form" onSubmit={saveStaff}>
          <label>Name<input name="name" required minLength={2} defaultValue={editingStaff?.name} /></label>
          <label>Role<select name="role" defaultValue={editingStaff?.role}><option>head cook</option><option>assistant cook</option><option>helper</option><option>rider</option><option>cleaner</option></select></label>
          <label>Monthly salary (₹)<input name="monthlySalary" type="number" min="0" required defaultValue={editingStaff?.monthly_salary} /></label>
          <label>Joining date<input name="joiningDate" type="date" required defaultValue={editingStaff?.joining_date} /></label>
          <label>Phone<input name="phone" pattern="[6-9][0-9]{9}" required defaultValue={editingStaff?.phone} /></label>
          <label>Medical certificate expiry<input name="medicalCertExpiry" type="date" required defaultValue={editingStaff?.medical_cert_expiry} /></label>
          <button className="checkout-button">Save staff</button>{editingStaff && <button type="button" onClick={() => setEditingStaff(null)}>Cancel edit</button>}
        </form></section>
        <section className="ops-panel"><h2>{editingMeeting ? "Edit" : "Add"} school meeting</h2><form key={editingMeeting?.id || "new-meeting"} className="ops-form" onSubmit={saveMeeting}>
          <label>School ID<input name="schoolId" required defaultValue={editingMeeting?.school_id} /></label><label>School name<input name="schoolName" required defaultValue={editingMeeting?.school_name} /></label>
          <label>Contact person<input name="contactPerson" required defaultValue={editingMeeting?.contact_person} /></label><label>Date and time<input name="dateTime" type="datetime-local" required defaultValue={editingMeeting?.date_time?.slice(0, 16)} /></label>
          <label>Purpose<select name="purpose" defaultValue={editingMeeting?.purpose}><option>principal meeting</option><option>tasting day</option><option>PTA presentation</option></select></label>
          <label>Status<select name="status" defaultValue={editingMeeting?.status}><option>planned</option><option>done</option><option>follow-up</option></select></label>
          <label>Notes<textarea name="notes" maxLength={2000} defaultValue={editingMeeting?.notes} /></label><button className="checkout-button">Save meeting</button>{editingMeeting && <button type="button" onClick={() => setEditingMeeting(null)}>Cancel edit</button>}
        </form></section>
      </div>
      <section className="ops-panel"><h2>Staff</h2>{staff.map((person) => <article className="ops-row" key={person.id}><span><b>{person.name}</b> · {person.role} · ₹{person.monthly_salary}/month · certificate {person.medical_cert_expiry} · {person.active ? "active" : "inactive"}</span><span><button onClick={() => setEditingStaff(person)}>Edit</button>{person.active && <button onClick={() => void save({ recordType: "staff", id: person.id, name: person.name, role: person.role, monthlySalary: person.monthly_salary, joiningDate: person.joining_date, phone: person.phone, medicalCertExpiry: person.medical_cert_expiry, active: false })}>Deactivate</button>}</span></article>)}</section>
      <section className="ops-panel"><h2>School meetings</h2>{meetings.map((meeting) => <article className="ops-row" key={meeting.id}><span><b>{meeting.school_name}</b> · {new Date(meeting.date_time).toLocaleString("en-IN")} · {meeting.purpose} · {meeting.status}</span><button onClick={() => setEditingMeeting(meeting)}>Edit</button></article>)}</section>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
