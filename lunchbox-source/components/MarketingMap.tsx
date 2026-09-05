"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps SDK is loaded dynamically by multiple map components. */

import { useEffect, useRef, useState } from "react";
import type { MarketingLead } from "@/lib/marketing";

type Props = { school: MarketingLead; communities: MarketingLead[] };
declare global { interface Window { google?: any } }

export default function MarketingMap({ school, communities }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    function render() {
      if (!node.current || !window.google || school.latitude == null || school.longitude == null) return;
      const maps = window.google.maps;
      const center = { lat: school.latitude, lng: school.longitude };
      const map = new maps.Map(node.current, { center, zoom: 13, mapTypeControl: false, streetViewControl: false });
      const bounds = new maps.LatLngBounds();
      bounds.extend(center);
      new maps.Marker({ map, position: center, title: school.name, label: "S", zIndex: 10 });
      communities.forEach((community, index) => {
        if (community.latitude == null || community.longitude == null) return;
        const position = { lat: community.latitude, lng: community.longitude };
        bounds.extend(position);
        new maps.Marker({ map, position, title: `${community.name} (${community.distanceKm ?? "?"} km)`, label: String(index + 1) });
      });
      if (communities.length) map.fitBounds(bounds);
    }
    async function load() {
      if (window.google?.maps) { render(); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-lunchbox-maps="true"]');
      if (existing) { existing.addEventListener("load", render); return; }
      try {
        const response = await fetch("/api/marketing/maps-config");
        const data = await response.json() as { apiKey?: string; error?: string };
        if (!response.ok || !data.apiKey) throw new Error(data.error || "Map configuration unavailable.");
        if (cancelled) return;
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(data.apiKey)}`;
        script.async = true;
        script.dataset.lunchboxMaps = "true";
        script.onload = render;
        script.onerror = () => setError("Google Maps could not be loaded. Check browser-key restrictions.");
        document.head.appendChild(script);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Google Maps is unavailable."); }
    }
    void load();
    return () => { cancelled = true; };
  }, [school, communities]);
  return error ? <div className="marketing-map-error">{error}</div> : <div className="marketing-map" ref={node} aria-label="School and nearby apartment map" />;
}
