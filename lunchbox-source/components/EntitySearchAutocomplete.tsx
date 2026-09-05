"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { EntityType, LocationEntityResult } from "@/lib/entity-locator/types";
import { CITY_BY_CODE, SCHOOL_CITIES, type CityCode, type ZoneCode } from "@/lib/school-locator/territories";

type Props = { entityType: EntityType; value: LocationEntityResult | null; onChange: (entity: LocationEntityResult | null) => void };
type Payload = { results?: LocationEntityResult[]; meta?: { cache_hit?: boolean }; entity?: LocationEntityResult; error?: string };
const title = (type: EntityType) => type === "office" ? "Office" : type === "company" ? "Company" : "College";
const manualPath = (type: EntityType) => type === "office" ? "offices" : type === "company" ? "companies" : "colleges";

export default function EntitySearchAutocomplete({ entityType, value, onChange }: Props) {
  const label = title(entityType);
  const [cityCode, setCityCode] = useState<CityCode | "">(value?.city_code || "");
  const [zoneCode, setZoneCode] = useState<ZoneCode | "">(value?.zone_code || "");
  const [query, setQuery] = useState(value?.display_name || "");
  const [results, setResults] = useState<LocationEntityResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [cityWide, setCityWide] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  const [message, setMessage] = useState("Choose a city and zone to begin.");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const city = useMemo(() => cityCode ? CITY_BY_CODE.get(cityCode) : null, [cityCode]);
  const zones = city?.zones || [];
  const selectedZone = zoneCode ? zones.find((zone) => zone.code === zoneCode) : null;

  useEffect(() => {
    const prefix = query.trim();
    if (!cityCode || !zoneCode) { setResults([]); setMessage("Choose a city and zone to begin."); return; }
    if (value && prefix === value.display_name) { setResults([]); setMessage(""); return; }
    if (prefix.length < 3) { setResults([]); setActiveIndex(-1); setMessage(`Type at least three characters of the ${entityType} name.`); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setMessage("");
      try {
        const params = new URLSearchParams({ type: entityType, city: cityCode, zone: zoneCode, q: prefix, limit: "10" });
        if (cityWide) params.set("scope", "city");
        const response = await fetch(`/api/entities/search?${params}`, { signal: controller.signal });
        const data = await response.json() as Payload;
        if (!response.ok) throw new Error(data.error || `${label} search is temporarily unavailable.`);
        const matches = data.results || []; setResults(matches); setCacheHit(Boolean(data.meta?.cache_hit));
        setActiveIndex(matches.length ? 0 : -1);
        setMessage(matches.length ? "" : `No matching ${entityType}s found in ${cityWide ? city?.name : selectedZone?.name}.`);
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setResults([]); setMessage(`${label} search is temporarily unavailable. You can enter it manually.`); }
      } finally { setLoading(false); }
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityCode, zoneCode, query, cityWide, city, selectedZone, value, entityType, label]);

  function reset() { onChange(null); setManualOpen(false); }
  function choose(entity: LocationEntityResult) { onChange(entity); setQuery(entity.display_name); setResults([]); setMessage(""); setManualOpen(false); }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); choose(results[activeIndex]); }
    else if (event.key === "Escape") { setResults([]); setActiveIndex(-1); }
  }
  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!cityCode || !zoneCode) return; setManualSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/${manualPath(entityType)}/manual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        display_name: form.get("display_name"), formatted_address: form.get("formatted_address"), locality: form.get("locality"), postal_code: form.get("postal_code"), city_code: cityCode, zone_code: zoneCode,
      }) });
      const data = await response.json() as Payload;
      if (!response.ok || !data.entity) throw new Error(data.error || `Unable to add this ${entityType}.`);
      choose(data.entity);
    } catch (error) { setMessage(error instanceof Error ? error.message : `Unable to add this ${entityType}.`); }
    finally { setManualSaving(false); }
  }
  const source = (entity: LocationEntityResult) => cacheHit ? "Cached" : entity.provider === "google" ? "Google" : entity.provider === "manual" ? "Manual" : "Directory";

  return <section className="school-location-card" aria-labelledby="entity-location-heading">
    <div className="school-card-title"><span>01</span><div><h2 id="entity-location-heading">{label} location</h2><p>Four cities · twenty LunchBox search territories</p></div></div>
    <div className="school-location-grid">
      <label>City *<select value={cityCode} onChange={(event) => { setCityCode(event.target.value as CityCode | ""); setZoneCode(""); setQuery(""); setCityWide(false); reset(); }}><option value="">Select city</option>{SCHOOL_CITIES.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>
      <label>Zone *<select value={zoneCode} disabled={!cityCode} onChange={(event) => { setZoneCode(event.target.value as ZoneCode | ""); setQuery(""); setCityWide(false); reset(); }}><option value="">Select zone</option>{zones.map((zone) => <option value={zone.code} key={zone.code}>{zone.name}</option>)}</select></label>
    </div>
    <label className="school-combobox-label" htmlFor={`${entityType}-search-input`}>{label} *</label>
    <div className="school-combobox"><input id={`${entityType}-search-input`} role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={`${entityType}-search-list`} aria-activedescendant={activeIndex >= 0 ? `${entityType}-option-${activeIndex}` : undefined} value={query} disabled={!cityCode || !zoneCode} minLength={3} maxLength={80} autoComplete="off" placeholder={cityCode && zoneCode ? "Type first 3 letters…" : "Select city and zone first"} onKeyDown={keyDown} onChange={(event) => { setQuery(event.target.value); setCityWide(false); reset(); }} />{loading && <span className="school-search-spinner" aria-hidden="true" />}</div>
    <div className="school-search-results" aria-live="polite">
      {loading && <p>Searching {entityType}s...</p>}{!loading && message && <p>{message}</p>}
      {!loading && results.length > 0 && <ul id={`${entityType}-search-list`} role="listbox" aria-label={`Matching ${entityType}s`}>{results.map((entity, index) => <li id={`${entityType}-option-${index}`} role="option" aria-selected={index === activeIndex} key={entity.id} onMouseDown={(event) => { event.preventDefault(); choose(entity); }} onMouseEnter={() => setActiveIndex(index)}><div><b>{entity.display_name}</b><span>{entity.formatted_address}</span><small>{entity.locality} · {entity.zone_name} · {entity.city_name}{entity.category ? ` · ${entity.category.replaceAll("_", " ")}` : ""}</small></div><em>{source(entity)}</em></li>)}</ul>}
    </div>
    {!loading && cityCode && zoneCode && query.trim().length >= 3 && results.length === 0 && !value && <div className="school-fallback-actions">{!cityWide && <button type="button" onClick={() => setCityWide(true)}>Search all {city?.name}</button>}<button type="button" onClick={() => setManualOpen((open) => !open)}>{label} not found? Add manually</button></div>}
    {manualOpen && city && selectedZone && <form className="manual-school-form" onSubmit={addManual}><div className="manual-heading"><h3>Add {entityType} manually</h3><p>Manual entries are marked unverified until reviewed.</p></div><div className="manual-grid"><label>{label} name *<input name="display_name" required minLength={3} maxLength={160} /></label><label>Locality *<input name="locality" required minLength={2} maxLength={100} /></label><label className="manual-address">Full address *<textarea name="formatted_address" required minLength={5} maxLength={300} /></label><label>City<input readOnly value={city.name} /></label><label>Zone<input readOnly value={selectedZone.name} /></label><label>Pincode *<input name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} /></label></div><button className="checkout-button" disabled={manualSaving}>{manualSaving ? "Saving…" : `Use this ${entityType}`}</button></form>}
  </section>;
}
