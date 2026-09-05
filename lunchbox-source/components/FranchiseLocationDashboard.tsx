"use client";

import { useMemo, useState } from "react";
import FranchiseDirectory from "@/components/FranchiseDirectory";
import { buildFranchiseLocationInsights, franchiseCities, type FranchiseCitySelection } from "@/lib/franchise-analytics";
import type { Franchise } from "@/lib/franchises";

function number(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function barWidth(value: number, maximum: number) {
  return maximum > 0 ? `${Math.max(4, Math.round((value / maximum) * 100))}%` : "0%";
}

export default function FranchiseLocationDashboard({ franchises }: { franchises: Franchise[] }) {
  const [city, setCity] = useState<FranchiseCitySelection>("All");
  const insights = useMemo(() => buildFranchiseLocationInsights(franchises, city), [franchises, city]);
  const maxCityCount = Math.max(0, ...insights.cityRows.map((row) => row.franchises));
  const maxCategoryCount = Math.max(0, ...insights.categoryRows.map((row) => row.count));

  return <section className="franchise-location-dashboard" aria-labelledby="franchise-insights-title">
    <header className="franchise-insights-header">
      <div><span className="kicker">LOCATION INSIGHTS</span><h3 id="franchise-insights-title">{city === "All" ? "Tamil Nadu franchise network" : `${city} franchise network`}</h3><p>Choose one city or view the complete network. Every metric, graph, and directory result follows the same selection.</p></div>
      <div className="franchise-city-selector" role="group" aria-label="Filter franchise insights by city">
        {(["All", ...franchiseCities] as FranchiseCitySelection[]).map((item) => <button key={item} type="button" className={city === item ? "active" : ""} aria-pressed={city === item} onClick={() => setCity(item)}>{item}</button>)}
      </div>
    </header>

    <div className="franchise-insight-metrics">
      <article><small>Partner locations</small><b>{number(insights.totalFranchises)}</b><span>{city === "All" ? "Across all four cities" : city}</span></article>
      <article><small>Students enrolled</small><b>{number(insights.totalStudents)}</b><span>Selected network total</span></article>
      <article><small>Mapped locations</small><b>{number(insights.mappedLocations)}</b><span>Coordinates available</span></article>
    </div>

    <div className="franchise-graphs">
      <article aria-label="Partner locations by city">
        <header><span className="kicker">CITY COMPARISON</span><h4>Partner locations</h4></header>
        <div className="franchise-bar-list">{insights.cityRows.map((row) => <div className={city === row.city ? "selected" : ""} key={row.city}><span>{row.city}</span><i><b style={{ width: barWidth(row.franchises, maxCityCount) }} /></i><strong>{number(row.franchises)}</strong></div>)}</div>
      </article>
      <article aria-label={`Franchise categories for ${city}`}>
        <header><span className="kicker">CATEGORY MIX</span><h4>{city === "All" ? "All locations" : city}</h4></header>
        {insights.categoryRows.length ? <div className="franchise-bar-list">{insights.categoryRows.map((row) => <div key={row.category}><span>{row.category}</span><i><b style={{ width: barWidth(row.count, maxCategoryCount) }} /></i><strong>{number(row.count)}</strong></div>)}</div> : <p className="franchise-chart-empty">No franchise data is published for this selection yet.</p>}
      </article>
    </div>

    <FranchiseDirectory franchises={insights.franchises} />
  </section>;
}
