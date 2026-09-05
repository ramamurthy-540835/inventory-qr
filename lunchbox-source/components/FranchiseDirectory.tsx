"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Franchise } from "@/lib/franchises";

const PAGE_SIZE = 24;
const DIRECTORY_LIMIT = 1000;

export default function FranchiseDirectory({ franchises }: { franchises: Franchise[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const areas = useMemo(() => [...new Set(franchises.map((item) => item.area).filter(Boolean))].sort(), [franchises]);
  const categories = useMemo(() => [...new Set(franchises.map((item) => item.category).filter(Boolean))].sort(), [franchises]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return franchises.slice(0, DIRECTORY_LIMIT).filter((item) => (!area || item.area === area) && (!category || item.category === category) && (!term || [item.name, item.companyName, item.category, item.address, item.area].join(" ").toLowerCase().includes(term)));
  }, [franchises, query, area, category]);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleFranchises = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - currentPage) <= 1);
  const resetPage = (action: () => void) => { action(); setPage(1); };

  return <>
    <div className="franchise-filters" aria-label="Filter Chennai franchises">
      <label><span>Search</span><input value={query} onChange={(event) => resetPage(() => setQuery(event.target.value))} placeholder="Name, company, area…" /></label>
      <label><span>Area</span><select value={area} onChange={(event) => resetPage(() => setArea(event.target.value))}><option value="">All areas</option>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Category</span><select value={category} onChange={(event) => resetPage(() => setCategory(event.target.value))}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <p className="franchise-count">{results.length} of {Math.min(franchises.length, DIRECTORY_LIMIT)} Chennai listings · showing up to 1,000 records</p>
    <div className="franchise-grid">{visibleFranchises.map((franchise) => <article className="franchise-card" key={franchise.id}>
      <div><span className="kicker">{franchise.category || "FRANCHISE"}</span><h3>{franchise.name}</h3>
      {franchise.companyName && <p><b>Company:</b> {franchise.companyName}</p>}
      {franchise.description && <p>{franchise.description}</p>}
      <address>{franchise.address}{franchise.area && <><br />{franchise.area}, Chennai</>}</address>
      <small className="franchise-student-count">{franchise.studentCount} students enrolled</small>
      <div className="franchise-contact"><Link href={`/franchises/${encodeURIComponent(franchise.id)}`}>View full details →</Link></div>
      {franchise.rating !== null && <small className="franchise-rating">★ {franchise.rating}{franchise.reviews !== null ? ` (${franchise.reviews} reviews)` : ""}</small>}</div>
    </article>)}</div>
    {results.length > PAGE_SIZE && <nav className="pagination" aria-label="Franchise results pages"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>{pages.map((item, index) => <span key={item}>{index > 0 && pages[index - 1] !== item - 1 && <i>…</i>}<button className={item === currentPage ? "active" : ""} aria-current={item === currentPage ? "page" : undefined} onClick={() => setPage(item)}>{item}</button></span>)}<button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
    {!results.length && <p className="franchise-message">No franchises match those filters.</p>}
  </>;
}
