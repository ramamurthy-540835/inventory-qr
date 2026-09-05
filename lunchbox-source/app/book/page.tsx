"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_TIMELINE, reducedMotionTransform } from "@/lib/book/timeline";
import { meals } from "@/lib/meals";
import { LeafArt } from "@/components/book/art/leaf";
import { TiffinArt } from "@/components/book/art/tiffin";
import { FoodArt } from "@/components/book/art/food";
import { isMealAudience, type MealAudience } from "@/lib/pricing";
import FullBookingPage from "./full/page";
import styles from "./demo.module.css";

type Beat = "open" | "fill" | "seal";
type Price = { totalInr: number; totalPaise: number };
const curryOne = meals[0]?.description.split(",")[4]?.trim() || "vegetable curry";
const curryTwo = meals[0]?.description.split(",")[5]?.trim().replace(" channa and 1 appalam.", "") || "vegetable curry";
const food = [
  { kind: "rice" as const, name: "Rice", delay: DEMO_TIMELINE.fill.rice },
  { kind: "chapati" as const, name: "Chapati", delay: DEMO_TIMELINE.fill.chapati },
  { kind: "sambar" as const, name: "Sambar", delay: DEMO_TIMELINE.fill.sambar },
  { kind: "curd" as const, name: "Curd", delay: DEMO_TIMELINE.fill.curd },
  { kind: "curry" as const, name: curryOne, delay: DEMO_TIMELINE.fill.curryOne },
  { kind: "curry" as const, name: curryTwo, delay: DEMO_TIMELINE.fill.curryTwo },
  { kind: "channa" as const, name: "Channa", delay: DEMO_TIMELINE.fill.channa },
  { kind: "appalam" as const, name: "Appalam", delay: DEMO_TIMELINE.fill.appalam },
];

export default function BookDemoPage() {
  const [beat, setBeat] = useState<Beat>("open");
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4]);
  const [price, setPrice] = useState<Price | null>(null);
  const [audience, setAudience] = useState<MealAudience>("school");
  const [priceError, setPriceError] = useState("");
  const [reduced, setReduced] = useState(false);
  const taps = useRef(0); const resetTimer = useRef<number | null>(null);
  const days = meals.slice(0, 5);

  useEffect(() => { const params = new URLSearchParams(window.location.search); const requestedAudience = params.get("audience"); if (isMealAudience(requestedAudience)) setAudience(requestedAudience); if (params.get("reset") === "1") setBeat("open"); setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => { if (beat !== "fill") return; const controller = new AbortController(); setPriceError(""); fetch("/api/orders/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience, dayCount: selectedDays.length }), signal: controller.signal }).then((response) => response.json().then((data) => { if (!response.ok) throw new Error(data.error || "The server bill is unavailable."); return data; })).then(setPrice).catch((error) => { if (error.name !== "AbortError") setPriceError("The server bill is unavailable. Keep this tab online and try again."); }); return () => controller.abort(); }, [audience, beat, selectedDays.length]);

  const cameraStyle = { transform: reducedMotionTransform(reduced) };
  const daysLabel = useMemo(() => selectedDays.map((index) => days[index]?.day.slice(0, 3)).join(" · "), [days, selectedDays]);
  function reset() { setBeat("open"); setSelectedDays([0, 1, 2, 3, 4]); }
  function continueToCheckout() {
    const cart = Object.fromEntries(selectedDays.map((index) => [days[index].id, 1]));
    sessionStorage.setItem("lunchbox_checkout", JSON.stringify({ cart, audience }));
    window.location.assign("/checkout");
  }
  function tiffinTap() { taps.current += 1; if (resetTimer.current) window.clearTimeout(resetTimer.current); resetTimer.current = window.setTimeout(() => { taps.current = 0; }, 700); if (taps.current >= 3) { taps.current = 0; reset(); } }
  function advanceBeat() { if (beat === "open") setBeat("fill"); else if (beat === "fill") continueToCheckout(); else reset(); }
  function toggleDay(index: number) { setSelectedDays((current) => current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort()); }

  if (process.env.NEXT_PUBLIC_BOOKING_MODE === "full") return <FullBookingPage />;
  return <main className={styles.demo} onClick={advanceBeat}>
    <div className={styles.camera} style={cameraStyle}>
      <button className={styles.resetTarget} aria-label="Reset demo" onClick={(event) => { event.stopPropagation(); tiffinTap(); }}><TiffinArt open={beat !== "open"} sealed={beat === "seal"} /></button>
      <div className={`${styles.stage} ${styles[`beat-${beat}`]}`}>
        <div className={styles.leafLayer}><LeafArt sealed={beat === "seal"} /></div>
        {beat === "fill" && <div className={styles.foodLayer}>{food.map((item) => <div className={`${styles.food} ${styles[`food-${item.kind}`]}`} key={item.name} style={{ "--delay": `${reduced ? 0 : item.delay}ms` } as React.CSSProperties}><FoodArt kind={item.kind} curryName={item.name} /><span>{item.name}</span></div>)}</div>}
      </div>
    </div>
    {beat === "open" && <section className={styles.copy}><h1>{ audience === "school" ? "A school lunch worth opening." : "A better lunch worth opening." }</h1><button onClick={(event) => { event.stopPropagation(); advanceBeat(); }}>Open the box</button></section>}
    {beat === "fill" && <section className={styles.fillControls} onClick={(event) => event.stopPropagation()}><h1>What your child gets.</h1><p className={styles.composition}>1 chapati, 1 bowl of rice, sambar, curd, 2 vegetable curries, 1 serving of channa, 1 appalam.</p><div className={styles.week} aria-label="Choose days">{days.map((meal, index) => <button className={selectedDays.includes(index) ? styles.daySelected : ""} key={meal.id} onClick={() => toggleDay(index)}><span>{meal.day.slice(0, 3)}</span><i aria-hidden="true"><LeafArt /></i></button>)}</div>{priceError && <p role="status" className={styles.error}>Your final total will be calculated securely at checkout.</p>}<div className={styles.bill}><span>{daysLabel || "Choose a day"}</span><b>{price ? `₹${price.totalInr}` : "Calculated at checkout"}</b></div><button disabled={!selectedDays.length} onClick={continueToCheckout}>Continue to secure checkout</button></section>}
  </main>;
}
