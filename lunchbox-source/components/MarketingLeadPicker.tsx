"use client";

import { useMemo, useState } from "react";
import type { MarketingLead } from "@/lib/marketing";
import styles from "./MarketingLeadPicker.module.css";

type Props = {
  leads: MarketingLead[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  label?: string;
};

export default function MarketingLeadPicker({ leads, selectedIds, onChange, multiple = false, label = "Pipeline lead" }: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => leads.filter((lead) => !search || `${lead.name} ${lead.area || ""} ${lead.city}`.toLowerCase().includes(search.toLowerCase())), [leads, search]);
  return <div className={styles.picker}>
    <label>{label}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved leads" /></label>
    <div className={styles.options}>{filtered.length ? filtered.map((lead) => <label key={lead.id}>
      <input type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : "marketing-lead-picker"} checked={selectedIds.includes(lead.id)} onChange={(event) => onChange(multiple ? event.target.checked ? [...selectedIds, lead.id] : selectedIds.filter((id) => id !== lead.id) : [lead.id])} />
      <span>{lead.name}<small>{lead.area || lead.city} · {lead.type}</small></span>
    </label>) : <p>No matching saved leads. Add leads from Discover first.</p>}</div>
  </div>;
}
