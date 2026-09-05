"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { firebaseAuth } from "@/lib/firebase-client";
import { cities as fallbackCities, gradePlans as fallbackGradePlans, meals as fallbackMeals, type Meal } from "@/lib/meals";
import { initialBookingState, reducer, type BookingState } from "@/lib/book-machine";
import styles from "./book.module.css";

type Catalog = { cities: string[]; meals: Meal[]; gradePlans: Record<string, { label: string }> };
type School = { id: string; name: string; city: string; area: string; kitchenId?: string };
type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

declare global { interface Window { Razorpay?: RazorpayConstructor } }

async function loadRazorpayCheckout() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load secure payment checkout."));
    document.head.appendChild(script);
  });
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className={styles.state} role="alert"><p>{message}</p>{retry && <button className={styles.secondary} onClick={retry}>Try again</button>}</div>; }

export default function BookPage() {
  const [state, dispatch] = useReducer(reducer, initialBookingState);
  const [catalog, setCatalog] = useState<Catalog>({ cities: fallbackCities, meals: fallbackMeals, gradePlans: fallbackGradePlans });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const controller = new AbortController(); fetch("/api/catalog", { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error("The menu is unavailable. Try again when you are online."); return r.json(); }).then(setCatalog).catch((e) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => setLoading(false)); return () => controller.abort(); }, []);
  useEffect(() => { heading.current?.focus(); window.history.pushState({ act: state.act }, "", `/book/full${state.act ? `/${state.act}` : ""}`); }, [state.act]);
  useEffect(() => { const onPop = () => dispatch({ type: "BACK" }); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const selectedMeals = catalog.meals.filter((meal) => state.mealIds.includes(meal.id));
  const goBack = () => dispatch({ type: "BACK" });
  return <main className={styles.page}>
    {state.act > 0 && state.act < 8 && <button className={styles.back} onClick={goBack} aria-label="Go back one step">← Back</button>}
    {loading && state.act === 0 ? <div className={styles.state}>Loading the lunchbox…</div> : error && state.act === 0 ? <ErrorState message={error} retry={() => window.location.reload()} /> : <>
      {state.act === 0 && <Act0 onNext={() => dispatch({ type: "OPEN" })} />}
      {state.act === 1 && <Act1 cities={catalog.cities} onPick={(city) => dispatch({ type: "CITY", city })} />}
      {state.act === 2 && <Act2 city={state.city!} onPick={(school) => dispatch({ type: "SCHOOL", school })} />}
      {state.act === 3 && <Act3 plans={catalog.gradePlans} state={state} onNext={(studentName, section, gradeBand) => dispatch({ type: "STUDENT", studentName, section, gradeBand })} />}
      {state.act === 4 && <Act4 meals={catalog.meals} selected={state.mealIds} onNext={(mealIds) => dispatch({ type: "MEALS", mealIds })} />}
      {state.act === 5 && <Act5 meals={catalog.meals} selected={state.mealIds} onNext={() => dispatch({ type: "NEXT" })} />}
      {state.act === 6 && <Act6 state={state} onNext={(allergyText, allergyAcknowledged, parentPhone) => { dispatch({ type: "PHONE", parentPhone }); dispatch({ type: "SAFETY", allergyText, allergyAcknowledged }); }} />}
      {state.act === 7 && <Act7 state={state} meals={selectedMeals} onConfirmed={() => dispatch({ type: "CONFIRMED" })} />}
      {state.act === 8 && <Act8 state={state} meals={selectedMeals} />}
    </>}
  </main>;
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) { const ref = useRef<HTMLHeadingElement>(null); return <section className={styles.act}><h1 ref={ref} tabIndex={-1}>{title}</h1>{children}</section>; }
function Act0({ onNext }: { onNext: () => void }) { return <Frame title="A school lunch worth opening"><div className={styles.tiffin}><div className={styles.tiffinTop}>LunchBox</div><div className={styles.leafInside} aria-hidden="true" /></div><p>Choose a ₹39 lunch for your child’s school day.</p><button className={styles.primary} onClick={onNext}>Book lunch</button></Frame>; }
function Act1({ cities, onPick }: { cities: string[]; onPick: (city: string) => void }) { return <Frame title="Where does lunch go?"><div className={styles.grid}>{cities.map((city) => <button className={styles.card} key={city} onClick={() => onPick(city)}>{city}<span>Choose city →</span></button>)}</div></Frame>; }

function Act2({ city, onPick }: { city: string; onPick: (school: School) => void }) {
  const [query, setQuery] = useState(""); const [schools, setSchools] = useState<School[]>([]); const [message, setMessage] = useState(""); const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (query.trim().length < 3) { setSchools([]); return; } const timer = window.setTimeout(() => { controller.current?.abort(); const next = new AbortController(); controller.current = next; const cityCode = city.toUpperCase().replace(" ", "_"); fetch(`/api/schools/search?city=${encodeURIComponent(cityCode)}&zone=${encodeURIComponent(`${cityCode}_CENTRAL`)}&q=${encodeURIComponent(query)}&limit=10`, { signal: next.signal }).then((r) => r.json().then((data) => { if (!r.ok) throw new Error(data.error || "School search is unavailable. Try again or enter the school manually."); return data; })).then((data) => setSchools((data.schools || data.results || []).slice(0, 10))).catch((e) => { if (e.name !== "AbortError") setMessage(e.message); }); }, 400); return () => { window.clearTimeout(timer); controller.current?.abort(); }; }, [city, query]);
  return <Frame title={`Which school in ${city}?`}><label className={styles.label} htmlFor="school-search">School name</label><input id="school-search" className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing the school name" autoComplete="off" />{message && <ErrorState message={message} />}{schools.length > 0 && <div className={styles.results} role="listbox">{schools.map((school) => <button key={school.id} onClick={() => onPick(school)}>{school.name}<small>{school.area}</small></button>)}</div>}<p className={styles.note}>Pilot schools are labelled as pilot placeholders. School names come from the school directory.</p></Frame>;
}

function Act3({ plans, state, onNext }: { plans: Record<string, { label: string }>; state: BookingState; onNext: (name: string, section: string, grade: string) => void }) { const [name, setName] = useState(state.studentName); const [section, setSection] = useState(state.section); const [grade, setGrade] = useState(state.gradeBand || Object.keys(plans)[0]); return <Frame title="Who is this lunch for?"><label className={styles.label} htmlFor="grade">Grade band</label><select id="grade" className={styles.input} value={grade} onChange={(e) => setGrade(e.target.value)}>{Object.entries(plans).map(([id, plan]) => <option key={id} value={id}>{plan.label} standard</option>)}</select><label className={styles.label} htmlFor="student">Student’s first name</label><input id="student" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /><label className={styles.label} htmlFor="section">Section</label><input id="section" className={styles.input} value={section} onChange={(e) => setSection(e.target.value)} placeholder="For example, B" autoComplete="off" /><button className={styles.primary} disabled={name.trim().length < 2} onClick={() => onNext(name, section, grade)}>See this week’s leaf</button></Frame>; }

function Act4({ meals, selected, onNext }: { meals: Meal[]; selected: string[]; onNext: (ids: string[]) => void }) { const [ids, setIds] = useState(selected); return <Frame title="What’s on the leaf?"><p>Every lunch has 1 chapati, 1 bowl of rice, sambar, curd, 2 vegetable curries, 1 serving of channa and 1 appalam.</p><div className={styles.menu}>{meals.map((meal) => <button key={meal.id} className={`${styles.menuCard} ${ids.includes(meal.id) ? styles.selected : ""}`} onClick={() => setIds((current) => current.includes(meal.id) ? current.filter((id) => id !== meal.id) : [...current, meal.id])}><b>{meal.day}</b><span>{meal.description}</span></button>)}</div><button className={styles.primary} disabled={!ids.length} onClick={() => onNext(ids)}>Choose days</button></Frame>; }

function Act5({ meals, selected, onNext }: { meals: Meal[]; selected: string[]; onNext: () => void }) { const days = meals.filter((meal) => selected.includes(meal.id)); return <Frame title="Which days should we pack?"><p>Available days are checked against the school calendar, cutoff, holidays and kitchen capacity when you book.</p><div className={styles.days}>{days.map((meal) => <div className={styles.day} key={meal.id}><b>{meal.day}</b><span>{meal.shortDate}</span><small>Capacity is checked at booking</small></div>)}</div><button className={styles.primary} onClick={onNext}>Continue to safety</button></Frame>; }

function Act6({ state, onNext }: { state: BookingState; onNext: (allergy: string, acknowledged: boolean, phone: string) => void }) { const [allergy, setAllergy] = useState(state.allergyText); const [ack, setAck] = useState(state.allergyAcknowledged); const [phone, setPhone] = useState(state.parentPhone); const valid = /^[6-9]\d{9}$/.test(phone) && ack; return <Frame title="Safety comes first"><p>Tell us about allergies exactly as you want the school coordinator and kitchen to see them.</p><label className={styles.label} htmlFor="allergy">Allergies</label><textarea id="allergy" className={styles.input} value={allergy} onChange={(e) => setAllergy(e.target.value)} placeholder="Write none if there are no known allergies" /><label className={styles.label} htmlFor="phone">Parent mobile number</label><input id="phone" className={styles.input} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} /><label className={styles.check}><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I confirm this allergy information is complete.</label><button className={styles.primary} disabled={!valid} onClick={() => onNext(allergy, ack, phone)}>Review and pay</button></Frame>; }

function Act7({ state, meals, onConfirmed }: { state: BookingState; meals: Meal[]; onConfirmed: () => void }) { const [price, setPrice] = useState<{ totalInr: number; lines: Array<{ name: string; quantity: number; lineTotalInr: number }> } | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const key = useRef(state.idempotencyKey || crypto.randomUUID()); const [paymentFailure, setPaymentFailure] = useState(""); useEffect(() => { const controller = new AbortController(); fetch("/api/orders/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience: "school", items: meals.map((meal) => ({ mealId: meal.id, quantity: 1 })) }), signal: controller.signal }).then((r) => r.json().then((data) => { if (!r.ok) throw new Error(data.error); return data; })).then(setPrice).catch((e) => { if (e.name !== "AbortError") setMessage(e.message || "The bill is unavailable. Try again."); }); return () => controller.abort(); }, [meals]);
  async function book() { setBusy(true); setMessage(""); setPaymentFailure(""); try { const token = await firebaseAuth()?.currentUser?.getIdToken(); const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key.current, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ studentName: state.studentName, parentPhone: state.parentPhone, schoolName: state.school!.name, city: state.city, gradeBand: state.gradeBand, audience: "school", items: meals.map((meal) => ({ mealId: meal.id, quantity: 1 })), allergies: state.allergyText }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Booking could not be created. Try again."); if (!data.payment) throw new Error("Razorpay is not configured. No booking was confirmed."); await loadRazorpayCheckout(); await new Promise<void>((resolve, reject) => { const checkout = new window.Razorpay!({ key: data.payment.keyId, amount: data.payment.amount, currency: data.payment.currency, name: "LunchBox", description: "School lunch order", order_id: data.payment.id, prefill: { contact: `+91${state.parentPhone}` }, handler: async (result: RazorpayResult) => { try { const verification = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(result) }); const verified = await verification.json(); if (!verification.ok) throw new Error(verified.error || "Payment verification failed."); resolve(); } catch (error) { reject(error); } }, modal: { ondismiss: () => reject(new Error("Payment was not completed.")) } }); checkout.open(); }); onConfirmed(); } catch (e) { setPaymentFailure(e instanceof Error ? e.message : "Payment was not completed."); } finally { setBusy(false); } }
  return <Frame title="Review and pay"><div className={styles.bill}>{price?.lines.map((line) => <div key={line.name}><span>{line.name} × {line.quantity}</span><b>₹{line.lineTotalInr}</b></div>)}<div className={styles.total}><span>Total</span><b>{price ? `₹${price.totalInr}` : "Loading…"}</b></div></div>{message && <ErrorState message={message} />}{paymentFailure && <div className={styles.notice} role="alert">{paymentFailure}</div>}<button className={styles.primary} disabled={!price || busy} onClick={book}>{busy ? "Opening secure payment…" : "Pay securely with Razorpay"}</button></Frame>; }
function Act8({ state, meals }: { state: BookingState; meals: Meal[] }) { return <Frame title="Payment confirmed"><p>Your lunch order for {state.studentName} is confirmed.</p><p>{meals.map((meal) => meal.day).join(", ")}</p><p>The school coordinator will receive the delivery details.</p><Link className={styles.secondary} href="/">Back to LunchBox</Link></Frame>; }
