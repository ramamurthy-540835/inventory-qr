"use client";

import type { MealAudience } from "@/lib/pricing";

type AudienceCategory = {
  id: MealAudience;
  name: string;
  price: number;
  description: string;
};

const categories: AudienceCategory[] = [
  { id: "senior", name: "Senior Citizens", price: 29, description: "Comfort-first lunches" },
  { id: "school", name: "School Students", price: 39, description: "Fuel for growing minds" },
  { id: "college", name: "College Students", price: 49, description: "Campus day energy" },
  { id: "working", name: "Working People", price: 59, description: "A better workday lunch" },
];

function AudienceIllustration({ audience }: { audience: MealAudience }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (audience === "senior") return <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="27" r="15" {...common}/><path d="M29 22c4-12 19-13 23 0M24 67c2-15 9-23 16-23s14 8 16 23M24 50l-8 12M56 50l8 12M34 29h1M45 29h1M36 36c3 2 6 2 9 0" {...common}/></svg>;
  if (audience === "school") return <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="25" r="13" {...common}/><path d="M22 67c2-15 9-24 18-24s16 9 18 24M27 51l13 8 13-8M31 13c7-7 18-6 22 3M19 58l-7 7M61 58l7 7" {...common}/><path d="M33 26h14" {...common}/></svg>;
  if (audience === "college") return <svg viewBox="0 0 80 80" aria-hidden="true"><path d="m11 27 29-14 29 14-29 14zM23 35v12c9 8 25 8 34 0V35M68 28v18" {...common}/><circle cx="40" cy="57" r="11" {...common}/><path d="M35 57h10M40 52v10" {...common}/></svg>;
  return <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="22" r="12" {...common}/><path d="M22 67c2-16 9-27 18-27s16 11 18 27M28 43l12 8 12-8M30 18c3-10 18-11 21 0M59 29h9v18h-9zM62 33h3" {...common}/></svg>;
}

export default function AudienceCategorySelector({ value, onChange }: { value: MealAudience; onChange: (audience: MealAudience) => void }) {
  return <div className="audience-selector" role="radiogroup" aria-label="Choose who lunch is for">
    <div className="audience-selector-heading"><div><span className="kicker">PICK A LUNCH PLAN</span><h3>Who is lunch for?</h3></div><p>Choose a plan to see the meal price.</p></div>
    <div className="audience-list">
      {categories.map((category) => {
        const selected = value === category.id;
        return <button key={category.id} className={`audience-card ${category.id} ${selected ? "selected" : ""}`} onClick={() => onChange(category.id)} role="radio" aria-checked={selected}>
          <span className="audience-art"><AudienceIllustration audience={category.id} /></span>
          <span className="audience-name">{category.name}</span>
          <span className="audience-price">₹{category.price}<small> / meal</small></span>
          <span className="audience-description">{category.description}</span>
        </button>;
      })}
    </div>
  </div>;
}
