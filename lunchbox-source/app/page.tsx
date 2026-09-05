"use client";

import InstallAppButton from "@/components/InstallAppButton";
import AudienceCategorySelector from "@/components/AudienceCategorySelector";
import { useEffect, useMemo, useState } from "react";
import { cities as fallbackCities, gradePlans as fallbackGradePlans, mealNutrition, meals as fallbackMeals, schools as fallbackSchools, type GradePlan, type Meal, type School } from "@/lib/meals";
import { mealAudiencePrice, type MealAudience } from "@/lib/pricing";

type Cart = Record<string, number>;

export default function Home() {
  const [meals, setMeals] = useState<Meal[]>(fallbackMeals);
  const [gradePlans, setGradePlans] = useState<Record<string, GradePlan>>(fallbackGradePlans);
  const [catalogError, setCatalogError] = useState("");
  const [city, setCity] = useState(fallbackCities[0]);
  const [schoolId, setSchoolId] = useState(fallbackSchools[0]?.id || "request");
  const [gradeBand, setGradeBand] = useState(Object.keys(fallbackGradePlans)[0]);
  const [audience, setAudience] = useState<MealAudience>("school");
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetch("/api/catalog").then(async (response) => {
      if (!response.ok) throw new Error("Catalogue unavailable");
      return response.json();
    }).then((catalog) => {
      setMeals(catalog.meals);
      setGradePlans(catalog.gradePlans);
      setCatalogError("");
      setCity((current) => catalog.cities.includes(current) ? current : catalog.cities[0]);
      setGradeBand((current) => catalog.gradePlans[current] ? current : Object.keys(catalog.gradePlans)[0]);
      setSchoolId((current) => {
        if (catalog.schools.some((school: School) => school.id === current)) return current;
        return catalog.schools[0]?.id || "request";
      });
    }).catch((error) => setCatalogError(error instanceof Error ? error.message : "Catalogue unavailable"));
  }, []);

  const itemCount = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const unitPrice = mealAudiencePrice(audience);
  const audienceCopy = {
    senior: { eyebrow: "Comfort made fresh every day", title: <>Wholesome food for<br /><em>good living.</em></>, description: "Freshly cooked, balanced vegetarian lunches made gentle, filling and easy to enjoy." },
    school: { eyebrow: "Made for growing minds", title: <>Big nutrition for<br /><em>bright young minds.</em></>, description: "Freshly cooked, balanced school lunches designed for growing students from 6th to 12th standard." },
    college: { eyebrow: "Fuel for the next chapter", title: <>Good food for<br /><em>big ambitions.</em></>, description: "Fresh, filling vegetarian lunches that keep college days moving from first class to last." },
    working: { eyebrow: "A better workday lunch", title: <>Eat well. Work<br /><em>bright.</em></>, description: "A dependable, balanced lunch for busy workdays — cooked fresh and delivered ready for your break." },
  }[audience];
  const subtotal = useMemo(
    () => meals.reduce((sum, meal) => sum + unitPrice * (cart[meal.id] || 0), 0),
    [cart, meals, unitPrice],
  );

  function addMeal(id: string) {
    setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
    setCartOpen(true);
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) => {
      const next = Math.max(0, (current[id] || 0) + amount);
      const updated = { ...current, [id]: next };
      if (!next) delete updated[id];
      return updated;
    });
  }

  function continueToCheckout() {
    sessionStorage.setItem("lunchbox_checkout", JSON.stringify({ cart, city, schoolId, gradeBand, audience }));
    window.location.assign("/checkout");
  }

  function choosePlan() {
    window.location.assign("/book?audience=" + audience);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LunchBox home">
          <span className="brand-mark">L</span>
          <span>Lunch<span>Box</span></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#menu">Menu</a>
          <a href="#standards">Our promise</a>
          <a href="#how">How it works</a>
        </nav>
        <InstallAppButton />
        <button className="cart-button" onClick={() => setCartOpen(true)}>
          <span>Bag</span>
          <b>{itemCount}</b>
        </button>
        <a className="profile-button" href="/checkout" aria-label="Login or open your profile"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-4 3.1-6 7.5-6s6.7 2 7.5 6"/></svg><span>Login</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>●</span> {audienceCopy.eyebrow}</div>
          <h1>{audienceCopy.title}</h1>
          <p>{audienceCopy.description}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={choosePlan}>Open the ₹{unitPrice} lunch <span>→</span></button>
            <div className="parent-proof"><b>4.9 ★</b><span>Loved by 2,000+ parents</span></div>
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration of a balanced lunchbox">
          <div className="lunchbox">
            <div className="box-top"><span /><span /></div>
            <div className="box-bottom"><span /><span /><span /></div>
          </div>
          <div className="nutrition-card"><b>Perfectly balanced</b><span>Protein · Grains · Veggies</span></div>
        </div>
      </section>

      <section className="promise-strip" id="standards">
        <div><i aria-hidden="true">{"\u25A3"}</i><span><b>Trusted by Schools</b><small>Partnered with verified schools across Tamil Nadu.</small></span></div>
        <div><i aria-hidden="true">{"\u23F1"}</i><span><b>Reliable Daily Delivery</b><small>Lunches arrive on time every school day.</small></span></div>
        <div><i aria-hidden="true">{"\u25CE"}</i><span><b>Easy Parent Ordering</b><small>Order, manage, and track in a few taps.</small></span></div>
        <div><i aria-hidden="true">{"\u2665"}</i><span><b>Healthy Kids</b><small>Clear nutrition and quality standards for parents.</small></span></div>
      </section>

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div><span className="kicker">THIS WEEK</span><h2>Pick their happy lunch.</h2></div>
          <p>Every packet contains 1 chapati, 1 bowl of rice, sambar, curd, 2 vegetable curries, channa and 1 appalam.</p>
        </div>

        <AudienceCategorySelector value={audience} onChange={setAudience} />

        <div className="menu-diet" aria-label="Meal type"><span>100% vegetarian</span></div>

        <div className="meal-grid">
          {catalogError && <p role="alert">{catalogError}. Please try again shortly.</p>}
          {gradePlans[gradeBand] && meals.map((meal) => <MealCard key={meal.id} meal={meal} gradePlan={gradePlans[gradeBand]} price={unitPrice} quantity={cart[meal.id] || 0} onAdd={() => addMeal(meal.id)} />)}
        </div>
      </section>

      <section className="how-section" id="how">
        <div><span>1</span><b>Choose meals</b><p>Select one day or plan the whole week.</p></div>
        <div><span>2</span><b>Tell us the school</b><p>We group deliveries by campus and lunch break.</p></div>
        <div><span>3</span><b>We deliver fresh</b><p>Every pack arrives sealed, named and on time.</p></div>
      </section>
      <footer><a className="brand" href="#top"><span className="brand-mark">L</span><span>Lunch<span>Box</span></span></a><p>Made with care for growing minds in Tamil Nadu.</p><small>Menu is illustrative. Final meal plans should be approved by a qualified pediatric dietitian and the participating school.</small></footer>

      {cartOpen && <div className="overlay" onMouseDown={() => setCartOpen(false)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-head"><div><span className="kicker">YOUR ORDER</span><h2>Lunch bag</h2></div><button onClick={() => setCartOpen(false)}>×</button></div>
        {itemCount === 0 ? <div className="empty"><span className="empty-mark">LB</span><h3>Your bag is empty</h3><p>Add a wholesome lunch to get started.</p></div> : <>
          <div className="cart-list">{meals.filter((meal) => cart[meal.id]).map((meal) => <div className="cart-row" key={meal.id}><div className={`mini-meal ${meal.color}`} aria-hidden="true" /><div><b>{meal.name}</b><small>{meal.day} · ₹{unitPrice}</small></div><div className="stepper"><button onClick={() => changeQuantity(meal.id, -1)}>−</button><span>{cart[meal.id]}</span><button onClick={() => changeQuantity(meal.id, 1)}>+</button></div></div>)}</div>
          <div className="cart-total"><span>Total</span><b>₹{subtotal}</b></div>
          <button className="checkout-button" onClick={continueToCheckout}>Continue to details <span>→</span></button>
        </>}
      </aside></div>}
    </main>
  );
}

function MealCard({ meal, gradePlan, price, quantity, onAdd }: { meal: Meal; gradePlan: GradePlan; price: number; quantity: number; onAdd: () => void }) {
  const nutrition = mealNutrition(meal, gradePlan);
  return <article className="meal-card">
    <div className={`meal-photo ${meal.color}`}><span className="day-pill">{meal.day} · {meal.shortDate}</span><span className="food-visual" aria-label="Balanced lunch illustration" /><span className="rating">★ {meal.rating}</span></div>
    <div className="meal-body"><div className="tags">{meal.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h3>{meal.name}</h3><p>{meal.description}</p><div className="macros"><span><b>{nutrition.estimatedProteinG}g</b> protein</span><span><b>{nutrition.estimatedCalories}</b> kcal</span><span><b>{nutrition.targetCalories}</b> kcal grade target</span></div><div className="meal-bottom"><strong>₹{price}<small> / meal</small></strong><button onClick={onAdd}>{quantity ? `Add another (${quantity})` : "Add to bag"} <span>+</span></button></div></div>
  </article>;
}
