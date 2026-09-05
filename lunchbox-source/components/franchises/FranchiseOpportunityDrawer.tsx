"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps SDK is loaded dynamically. */

import { useEffect, useMemo, useRef, useState } from "react";
import FranchiseRegistration from "@/components/FranchiseRegistration";
import type { FranchiseOpportunityLocation, FranchiseOpportunityNetwork } from "@/lib/franchise-opportunities";

type Props = { open: boolean; onClose: () => void };
declare global { interface Window { google?: any; } }
const number = new Intl.NumberFormat("en-IN");

export default function FranchiseOpportunityDrawer({ open, onClose }: Props) {
  const [data, setData] = useState<FranchiseOpportunityNetwork | null>(null);
  const [cityId, setCityId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [selected, setSelected] = useState<FranchiseOpportunityLocation | null>(null);
  const [error, setError] = useState(""); const [mapError, setMapError] = useState(""); const [loading, setLoading] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null); const mapNode = useRef<HTMLDivElement>(null); const registerOpenRef = useRef(false);
  const activeCity = data?.cities.find((city) => city.id === cityId) || data?.cities[0];
  const activeZone = activeCity?.zones.find((zone) => zone.id === zoneId) || activeCity?.zones[0];
  const visibleLocations = useMemo(() => activeZone?.locations || [], [activeZone]);
  const available = visibleLocations.reduce((sum, location) => sum + location.availableFranchiseCount, 0);

  useEffect(() => { registerOpenRef.current = registerOpen; }, [registerOpen]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && (registerOpenRef.current ? setRegisterOpen(false) : onClose());
    document.addEventListener("keydown", onKeyDown); document.body.style.overflow = "hidden"; closeButton.current?.focus();
    setLoading(true); setError(""); setMapError("");
    fetch("/api/franchise-opportunities").then(async (response) => {
      if (!response.ok) throw new Error("We couldn't load franchise opportunities.");
      return response.json();
    }).then((next: FranchiseOpportunityNetwork) => {
      setData(next); setCityId((current) => current || next.cities[0]?.id || ""); setZoneId((current) => current || next.cities[0]?.zones[0]?.id || "");
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "We couldn't load franchise opportunities.")).finally(() => setLoading(false));
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; previous?.focus(); };
  }, [open, onClose]);

  useEffect(() => {
    if (!activeCity) return;
    if (!activeCity.zones.some((zone) => zone.id === zoneId)) setZoneId(activeCity.zones[0]?.id || "");
    setSelected(null);
  }, [cityId, activeCity, zoneId]);

  useEffect(() => {
    if (!open || !mapNode.current || !visibleLocations.length) return;
    let cancelled = false;
    const mapped = visibleLocations.filter((location) => location.lat !== null && location.lng !== null);
    if (!mapped.length) { setMapError("Coordinates are not published for this region yet."); return; }
    (async () => {
      const response = await fetch("/api/maps/config"); const { key } = await response.json();
      if (!key) throw new Error("Google Maps is not configured.");
      if (!window.google) await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector("script[data-lunchbox-google-maps]") as HTMLScriptElement | null;
        if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true }); return; }
        const script = document.createElement("script"); script.dataset.lunchboxGoogleMaps = "true";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly`;
        script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("Google Maps failed to load.")); document.head.append(script);
      });
      if (cancelled || !mapNode.current) return;
      setMapError("");
      const map = new window.google.maps.Map(mapNode.current, { center: { lat: mapped[0].lat, lng: mapped[0].lng }, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      const info = new window.google.maps.InfoWindow(); const bounds = new window.google.maps.LatLngBounds();
      mapped.forEach((location) => {
        const position = { lat: location.lat as number, lng: location.lng as number }; bounds.extend(position);
        const marker = new window.google.maps.Marker({ map, position, title: `${location.name} — ${location.availableFranchiseCount} slots open`, icon: location.availableFranchiseCount ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png" : "https://maps.google.com/mapfiles/ms/icons/grey-dot.png" });
        marker.addListener("click", () => {
          const card = document.createElement("div"); const title = document.createElement("strong"); title.textContent = location.name;
          const status = document.createElement("p"); status.textContent = location.availableFranchiseCount ? `${location.availableFranchiseCount} franchise slots · ${number.format(location.remainingStudentCapacity)} student places/day` : "Allocation completed";
          card.append(title, status); info.setContent(card); info.open({ map, anchor: marker }); setSelected(location);
        });
      });
      map.fitBounds(bounds, 60); if (mapped.length === 1) map.setZoom(13);
    })().catch((reason) => !cancelled && setMapError(reason instanceof Error ? reason.message : "Unable to load Google Maps."));
    return () => { cancelled = true; };
  }, [open, visibleLocations]);

  if (!open) return null;
  return <div className="opportunity-overlay" role="dialog" aria-modal="true" aria-labelledby="opportunity-title" onMouseDown={onClose}>
    <aside className="opportunity-drawer" onMouseDown={(event) => event.stopPropagation()}>
      <header className="opportunity-header"><div><span className="kicker">LUNCHBOX TERRITORY BOOKING</span><h2 id="opportunity-title">Choose a service territory</h2><p>Select a city, region and service area—then review the capacity before applying.</p></div><button ref={closeButton} className="opportunity-close" onClick={onClose} aria-label="Close franchise opportunities">×</button></header>
      {loading && <div className="opportunity-loading" aria-live="polite">Loading franchise locations…</div>}
      {error && <p className="opportunity-error" role="alert">{error}</p>}
      {!loading && !error && !data?.cities.length && <div className="opportunity-empty"><b>No locations are published yet.</b><p>The operations team can publish service territories in Firestore.</p><button onClick={() => setRegisterOpen(true)}>Register general interest</button></div>}
      {data?.cities.length ? <>
        <section className="network-capacity-strip" aria-label="Franchise network capacity">
          <div><small>Network plan</small><b>{number.format(data.network.plannedFranchises)}</b><span>possible franchises</span></div>
          <div><small>Per franchise</small><b>{number.format(data.network.dailyStudentsPerFranchise)}</b><span>students each day</span></div>
          <div><small>Published capacity</small><b>{number.format(data.network.publishedDailyStudentCapacity)}</b><span>students each day</span></div>
        </section>
        <section className="territory-itinerary" aria-label="Select franchise territory">
          <label><span>1 · City</span><select value={activeCity?.id || ""} onChange={(event) => setCityId(event.target.value)}>{data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
          <i aria-hidden="true">→</i>
          <label><span>2 · Region</span><select value={activeZone?.id || ""} onChange={(event) => { setZoneId(event.target.value); setSelected(null); }}>{activeCity?.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
          <i aria-hidden="true">→</i>
          <label><span>3 · Service area</span><select value={selected?.id || ""} onChange={(event) => setSelected(visibleLocations.find((location) => location.id === event.target.value) || null)}><option value="">Choose an area</option>{visibleLocations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.availableFranchiseCount} open</option>)}</select></label>
        </section>
        <div className="opportunity-map-shell"><div className="opportunity-map" ref={mapNode}>{mapError && <p className="map-fallback" role="status">{mapError}</p>}</div><div className="opportunity-map-key"><span><i className="open" />Slots open</span><span><i className="complete" />Allocation complete</span><small>Click a marker or choose an area above.</small></div></div>
        <div className="opportunity-content">
          <section className="location-list"><div className="location-list-head"><div><span className="kicker">{activeZone?.name} · {activeCity?.name}</span><h3>{available} franchise slots open</h3></div><span>Select a service area</span></div>
            <div className="location-options">{visibleLocations.map((location) => <button key={location.id} className={`location-option ${location.status} ${selected?.id === location.id ? "selected" : ""}`} onClick={() => setSelected(location)}><span className="location-status" aria-hidden="true">{location.availableFranchiseCount ? "→" : "✓"}</span><span><b>{location.name}</b><small>{location.availableFranchiseCount ? `${location.availableFranchiseCount} of ${location.plannedFranchiseCount} franchise slots open` : "Allocation completed"}</small></span><em>{number.format(location.remainingStudentCapacity)}/day</em></button>)}</div>
          </section>
          <aside className="opportunity-summary">{selected ? <><span className="kicker">TERRITORY SUMMARY</span><h3>{selected.name}</h3><p>{selected.zoneName} · {selected.cityName}</p><dl>
            <div><dt>Availability</dt><dd className={selected.availableFranchiseCount ? "available" : "completed"}>{selected.availableFranchiseCount} of {selected.plannedFranchiseCount} slots</dd></div>
            <div><dt>Capacity per franchise</dt><dd>{number.format(selected.dailyStudentCapacity)} students/day</dd></div>
            <div><dt>Territory capacity</dt><dd>{number.format(selected.totalDailyStudentCapacity)} students/day</dd></div>
            <div><dt>Capacity remaining</dt><dd>{number.format(selected.remainingStudentCapacity)} students/day</dd></div>
          </dl>{selected.availableFranchiseCount ? <button className="opportunity-primary" onClick={() => setRegisterOpen(true)}>Apply for {selected.name} <span>→</span></button> : <p className="completed-note">This allocation is complete. Choose another service area with an open slot.</p>}</> : <><span className="kicker">YOUR SELECTION</span><h3>{activeCity?.name} to {activeZone?.name}</h3><p>Choose a service area to see available franchise slots and student-serving capacity.</p><ol><li>Choose the city</li><li>Choose its operating region</li><li>Compare and apply for an area</li></ol></>}</aside>
        </div>
      </> : null}
      {registerOpen && <div className="registration-overlay" role="dialog" aria-modal="true" aria-labelledby="registration-title" onMouseDown={() => setRegisterOpen(false)}><aside className="registration-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="opportunity-close" onClick={() => setRegisterOpen(false)} aria-label="Close registration form">×</button><FranchiseRegistration initialArea={selected?.name || ""} initialCity={selected?.cityName || activeCity?.name || ""} opportunityId={selected?.id || ""} /></aside></div>}
    </aside>
  </div>;
}
