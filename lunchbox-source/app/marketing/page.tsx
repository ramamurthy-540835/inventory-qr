"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MarketingMap from "@/components/MarketingMap";
import MarketingEvents from "@/components/MarketingEvents";
import {
  audienceTypes,
  marketingCities,
  marketingGeography,
  type AudienceType,
  type MarketingCity,
  type MarketingLead,
} from "@/lib/marketing";
import { marketingEventsStorageKey, outreachActivitiesStorageKey, type MarketingEvent, type OutreachActivity } from "@/lib/marketing-events";
import styles from "./marketing.module.css";
import nearbyStyles from "./nearby.module.css";
import outreachStyles from "./outreach.module.css";
import paginationStyles from "./pagination.module.css";

type LeadStage = "New" | "Contacted" | "Interested" | "Meeting";
type SavedLead = MarketingLead & {
  stage: LeadStage; notes: string; savedAt: string; contactEmail?: string;
  emailConsent?: boolean; whatsappConsent?: boolean;
  responseStatus?: "no_response" | "replied" | "interested" | "opted_out";
  eventsConducted?: number; studentsEnrolled?: number;
};
type CampaignPreviewItem = {
  recipient: { id: string; name: string; audience: AudienceType; emailConsent: boolean; whatsappConsent: boolean };
  message: { subject: string; email: string; whatsapp: string; imageUrl: string; variant: number };
  sequence: number; scheduledFor: string;
};

const stages: LeadStage[] = ["New", "Contacted", "Interested", "Meeting"];
const storageKey = "lunchbox-marketing-leads-v1";
const resultsPerPage = 10;

export default function MarketingPage() {
  const [city, setCity] = useState<MarketingCity>("Chennai");
  const [zone, setZone] = useState("South / South-East Chennai");
  const [area, setArea] = useState("Velachery");
  const [audience, setAudience] = useState<AudienceType>("schools");
  const [keyword, setKeyword] = useState("");
  const [resultLimit, setResultLimit] = useState(50);
  const [resultPage, setResultPage] = useState(1);
  const [campaignName, setCampaignName] = useState("Chennai school lunch pilot");
  const [results, setResults] = useState<MarketingLead[]>([]);
  const [saved, setSaved] = useState<SavedLead[]>([]);
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [activities, setActivities] = useState<OutreachActivity[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"discover" | "pipeline" | "outreach" | "events">("discover");
  const [activityLeadId, setActivityLeadId] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<MarketingLead | null>(null);
  const [communities, setCommunities] = useState<MarketingLead[]>([]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [campaignPreview, setCampaignPreview] = useState("");
  const [campaignMessages, setCampaignMessages] = useState<CampaignPreviewItem[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [messagesPerRecipient, setMessagesPerRecipient] = useState(1);
  const [intervalHours, setIntervalHours] = useState(48);
  const [responseAware, setResponseAware] = useState(true);
  const [campaignImage, setCampaignImage] = useState("auto");
  const [customImageUrl, setCustomImageUrl] = useState("");

  useEffect(() => { void loadWorkspace(); },
    // The shared development workspace loads once when Marketing OS opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  async function authorizedFetch(path: string, init?: RequestInit) {
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Shared workspace request failed.");
    return body;
  }

  async function loadWorkspace() {
    setWorkspaceLoading(true); setWorkspaceError("");
    try {
      const response = await fetch("/api/marketing/workspace");
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not load the shared workspace.");
      const remoteLeads = (body.leads || []) as SavedLead[]; const remoteEvents = (body.events || []) as MarketingEvent[]; const remoteActivities = (body.activities || []) as OutreachActivity[];
      const localLeads = readLocal<SavedLead>(storageKey); const localEvents = readLocal<MarketingEvent>(marketingEventsStorageKey); const localActivities = readLocal<OutreachActivity>(outreachActivitiesStorageKey);
      const mergedLeads = mergeRecords(remoteLeads, localLeads, (item) => item.id); const mergedEvents = mergeRecords(remoteEvents, localEvents, (item) => item.eventId); const mergedActivities = mergeRecords(remoteActivities, localActivities, (item) => item.activityId);
      setSaved(mergedLeads); setEvents(mergedEvents); setActivities(mergedActivities);
      const imports = [...localLeads.map((record) => ["lead", record] as const), ...localEvents.map((record) => ["event", record] as const), ...localActivities.map((record) => ["activity", record] as const)];
      if (imports.length) { await Promise.all(imports.map(([entity, record]) => authorizedFetch("/api/marketing/workspace", { method: "PUT", body: JSON.stringify({ entity, record }) }))); localStorage.removeItem(storageKey); localStorage.removeItem(marketingEventsStorageKey); localStorage.removeItem(outreachActivitiesStorageKey); }
    } catch (reason) { setWorkspaceError(reason instanceof Error ? reason.message : "Could not load the shared workspace."); }
    finally { setWorkspaceLoading(false); }
  }

  function persist(next: SavedLead[]) {
    const previous = saved;
    setSaved(next);
    void syncRecords("lead", previous, next, (item) => item.id);
  }

  function persistEvents(next: MarketingEvent[]) { const previous = events; setEvents(next); void syncRecords("event", previous, next, (item) => item.eventId); }
  function persistActivities(next: OutreachActivity[]) { const previous = activities; setActivities(next); void syncRecords("activity", previous, next, (item) => item.activityId); }
  async function syncRecords<T>(entity: "lead" | "event" | "activity", previous: T[], next: T[], id: (item: T) => string) {
    try {
      const previousById = new Map(previous.map((item) => [id(item), item])); const nextById = new Map(next.map((item) => [id(item), item]));
      const writes = next.filter((item) => JSON.stringify(previousById.get(id(item))) !== JSON.stringify(item)).map((record) => authorizedFetch("/api/marketing/workspace", { method: "PUT", body: JSON.stringify({ entity, record }) }));
      const deletes = previous.filter((item) => !nextById.has(id(item))).map((item) => authorizedFetch(`/api/marketing/workspace?entity=${entity}&id=${encodeURIComponent(id(item))}`, { method: "DELETE" }));
      await Promise.all([...writes, ...deletes]);
    } catch (reason) { setWorkspaceError(reason instanceof Error ? reason.message : "Could not save shared workspace changes."); }
  }

  async function discover() {
    setLoading(true);
    setError("");
    setResultPage(1);
    try {
      const params = new URLSearchParams({ city, zone, area, audience, keyword, limit: String(resultLimit) });
      const response = await fetch(`/api/marketing/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setResults(data.leads);
      setQuery(data.query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not search right now.");
    } finally {
      setLoading(false);
    }
  }

  function saveLead(lead: MarketingLead) {
    if (saved.some((item) => item.id === lead.id)) return;
    persist([...saved, { ...lead, stage: "New", notes: "", eventsConducted: 0, studentsEnrolled: 0, savedAt: new Date().toISOString() }]);
    void fetch("/api/marketing/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead, schoolPlaceId: selectedSchool?.placeId || selectedSchool?.id }),
    });
  }

  async function findNearby(school = selectedSchool) {
    if (!school) return;
    setSelectedSchool(school);
    setNearbyLoading(true);
    setError("");
    try {
      const response = await fetch("/api/marketing/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, radiusKm }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nearby search failed");
      setCommunities(data.communities || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not find nearby communities.");
    } finally { setNearbyLoading(false); }
  }

  function updateLead(id: string, patch: Partial<SavedLead>) {
    persist(saved.map((lead) => lead.id === id ? { ...lead, ...patch } : lead));
  }

  function updateLeadStage(id: string, stage: LeadStage) {
    updateLead(id, { stage });
  }

  function openActivityForLead(id: string) {
    setActivityLeadId(id);
    setTab("events");
  }

  function removeLead(id: string) {
    persist(saved.filter((lead) => lead.id !== id));
  }

  async function previewCampaign() {
    const recipients = saved.filter((lead) => lead.emailConsent || lead.whatsappConsent).map((lead) => ({
      id: lead.id, name: lead.name, city: lead.city, area: lead.area, audience: lead.audience,
      phone: lead.phone, email: lead.contactEmail, emailConsent: Boolean(lead.emailConsent),
      whatsappConsent: Boolean(lead.whatsappConsent),
      responseStatus: lead.responseStatus || "no_response",
    }));
    setCampaignLoading(true); setCampaignPreview(""); setCampaignMessages([]);
    try {
      const imageUrl = campaignImage === "custom" ? customImageUrl : campaignImage === "auto" ? undefined : campaignImage;
      const response = await fetch("/api/marketing/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview", campaignName, recipients, messagesPerRecipient, intervalHours, responseAware, imageUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare campaign.");
      setCampaignPreview(`${data.messages.length} dynamic messages prepared across ${recipients.length - data.skippedForResponse} active recipients. ${data.skippedForResponse} suppressed because of response status. Live sending remains disabled until provider secrets are configured.`);
      setCampaignMessages(data.messages || []);
    } catch (reason) { setCampaignPreview(reason instanceof Error ? reason.message : "Could not prepare campaign."); }
    finally { setCampaignLoading(false); }
  }

  const activeCityLeads = useMemo(() => saved.filter((lead) => lead.city === city), [saved, city]);
  const resultPageCount = Math.ceil(results.length / resultsPerPage);
  const pagedResults = results.slice((resultPage - 1) * resultsPerPage, resultPage * resultsPerPage);
  const zones = Object.keys(marketingGeography[city]);
  const areas = (marketingGeography[city] as Record<string, readonly string[]>)[zone] || [];
  function changeCity(nextCity: MarketingCity) {
    const nextZones = Object.keys(marketingGeography[nextCity]);
    const nextZone = nextZones[0];
    const nextAreas = (marketingGeography[nextCity] as Record<string, readonly string[]>)[nextZone];
    setCity(nextCity); setZone(nextZone); setArea(nextAreas[0]); setResults([]); setResultPage(1); setSelectedSchool(null); setCommunities([]);
  }
  function changeZone(nextZone: string) {
    const nextAreas = (marketingGeography[city] as Record<string, readonly string[]>)[nextZone] || [];
    setZone(nextZone); setArea(nextAreas[0] || ""); setResults([]); setResultPage(1); setSelectedSchool(null); setCommunities([]);
  }
  const contacted = saved.filter((lead) => lead.stage !== "New").length;
  const interested = saved.filter((lead) => lead.stage === "Interested" || lead.stage === "Meeting").length;
  const outreach = buildOutreach(campaignName, city, audience);
  const outreachRecipients = saved;

  if (workspaceLoading) return <main className={styles.shell}><section className={styles.content}>Loading shared Firestore workspace…</section></main>;

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/"><span>L</span>LunchBox</Link>
      <p className={styles.workspace}>MARKETING OS</p>
      <nav>
        <button className={tab === "discover" ? styles.active : ""} onClick={() => setTab("discover")}><i>⌕</i>Discover</button>
        <button className={tab === "pipeline" ? styles.active : ""} onClick={() => setTab("pipeline")}><i>◎</i>Lead pipeline <b>{saved.length}</b></button>
        <button className={tab === "outreach" ? styles.active : ""} onClick={() => setTab("outreach")}><i>↗</i>Outreach kit</button>
        <button className={tab === "events" ? styles.active : ""} onClick={() => setTab("events")}><i>◫</i>Events</button>
      </nav>
      <div className={styles.sideNote}><strong>Development mode</strong><p>Shared Firestore data is currently public. Re-enable staff authentication before production use.</p></div>
    </aside>

    <section className={styles.content}>
      <header className={styles.topbar}>
        <div><span>CAMPAIGN WORKSPACE</span><h1>{campaignName}</h1></div>
        <Link href="/">View LunchBox site ↗</Link>
      </header>

      {workspaceError && <div className={styles.error}><b>Shared workspace</b><span>{workspaceError}</span></div>}

      {tab !== "events" && <div className={styles.metrics}>
        <Metric label="Saved leads" value={saved.length} note="Across four cities" />
        <Metric label="Contacted" value={contacted} note={saved.length ? `${Math.round(contacted / saved.length * 100)}% of pipeline` : "Start with discovery"} />
        <Metric label="Interested" value={interested} note="Qualified opportunities" />
        <Metric label="Active city" value={activeCityLeads.length} note={`${city} leads`} />
      </div>}

      {tab === "discover" && <>
        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span>LIVE LOCAL DISCOVERY</span><h2>Find your next community partner.</h2></div><p>Searches Google Places by city, zone and area, then shows schools and nearby communities on Google Maps.</p></div>
          <div className={styles.builder}>
            <label><span>Campaign name</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} maxLength={60} /></label>
            <label><span>City</span><select value={city} onChange={(event) => changeCity(event.target.value as MarketingCity)}>{marketingCities.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Zone</span><select value={zone} onChange={(event) => changeZone(event.target.value)}>{zones.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Area</span><select value={area} onChange={(event) => { setArea(event.target.value); setResultPage(1); }}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Audience</span><select value={audience} onChange={(event) => { setAudience(event.target.value as AudienceType); setResultPage(1); }}>{Object.entries(audienceTypes).map(([id, item]) => <option value={id} key={id}>{item.label}</option>)}</select></label>
            <label><span>Results to find</span><select value={resultLimit} onChange={(event) => { setResultLimit(Number(event.target.value)); setResultPage(1); }}>{[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
            <label><span>Search by keyword</span><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setResultPage(1); }} placeholder={`Example: CBSE ${audienceTypes[audience].searchTerm}`} maxLength={80} /></label>
            <button onClick={discover} disabled={loading}>{loading ? "Searching…" : "Discover leads"}<b>→</b></button>
          </div>
          <div className={styles.intent}><b>{audienceTypes[audience].label}:</b> {audienceTypes[audience].intent}</div>
        </section>

        {error && <div className={styles.error}><b>Search unavailable</b><span>{error}</span></div>}
        {(results.length > 0 || query) && <section className={styles.results}>
          <div className={styles.resultHead}><div><span>SEARCH RESULTS</span><h2>{results.length} opportunities found</h2><p>{query} · Showing 10 per page</p></div><button onClick={() => results.forEach(saveLead)}>Save all results</button></div>
          <div className={styles.leadGrid}>{pagedResults.map((lead) => {
            const isSaved = saved.some((item) => item.id === lead.id);
            return <article className={styles.leadCard} key={lead.id}>
              <div className={styles.leadTop}><span>{lead.position}</span><div><small>{lead.type}</small><h3>{lead.name}</h3></div></div>
              <p className={styles.address}>{lead.address}</p>
              <div className={styles.proof}>{lead.rating && <span>★ {lead.rating} {lead.reviews ? `(${lead.reviews})` : ""}</span>}{lead.phone && <span>{lead.phone}</span>}</div>
              <div className={styles.cardActions}>{lead.website && <a href={lead.website} target="_blank" rel="noreferrer">Website ↗</a>}<button disabled={isSaved} onClick={() => saveLead(lead)}>{isSaved ? "Saved ✓" : "+ Save lead"}</button></div>
              {lead.audience === "schools" && lead.latitude != null && lead.longitude != null && <button className={nearbyStyles.schoolSelect} onClick={() => void findNearby(lead)}>Use this school</button>}
            </article>;
          })}</div>
          {resultPageCount > 1 && <nav className={paginationStyles.pagination} aria-label="Search result pages">
            <button onClick={() => setResultPage((page) => Math.max(1, page - 1))} disabled={resultPage === 1} aria-label="Previous page">‹</button>
            {Array.from({ length: resultPageCount }, (_, index) => index + 1).map((page) => <button key={page} className={page === resultPage ? paginationStyles.currentPage : ""} onClick={() => setResultPage(page)} aria-current={page === resultPage ? "page" : undefined}>{page}</button>)}
            <button onClick={() => setResultPage((page) => Math.min(resultPageCount, page + 1))} disabled={resultPage === resultPageCount} aria-label="Next page">›</button>
          </nav>}
        </section>}
        {selectedSchool && <section className={nearbyStyles.nearbyPanel}>
          <div className={nearbyStyles.nearbyHead}><div><span>SCHOOL-CENTRED DISCOVERY</span><h2>{selectedSchool.name}</h2><p>{selectedSchool.address}</p></div><div><label>Search radius<select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}><option value={2}>2 km</option><option value={5}>5 km</option><option value={8}>8 km</option><option value={10}>10 km</option></select></label><button disabled={nearbyLoading} onClick={() => void findNearby()}>{nearbyLoading ? "Searching…" : "Find communities"}</button></div></div>
          <MarketingMap school={selectedSchool} communities={communities} />
          <div className={nearbyStyles.communityList}>{communities.map((lead, index) => <article key={lead.id}><b>{index + 1}</b><div><h3>{lead.name}</h3><p>{lead.address}</p><small>{lead.distanceKm} km from school {lead.rating ? ` · ★ ${lead.rating}` : ""}</small></div><button disabled={saved.some((item) => item.id === lead.id)} onClick={() => saveLead(lead)}>{saved.some((item) => item.id === lead.id) ? "Saved" : "Save"}</button></article>)}</div>
          {!nearbyLoading && !communities.length && <p className={nearbyStyles.nearbyEmpty}>Choose a radius and search for nearby apartment communities.</p>}
        </section>}
        {!results.length && !query && !error && <section className={styles.empty}><span>⌕</span><h2>Start with a city and audience.</h2><p>Find schools, apartment communities, and parent hubs, then save the best opportunities to your pipeline.</p></section>}
      </>}

      {tab === "pipeline" && <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>PARTNER PIPELINE</span><h2>Turn discovery into conversations.</h2></div><p>Update each stage after calls, WhatsApp outreach, tastings, or meetings.</p></div>
        {saved.length ? <div className={styles.pipeline}>{saved.map((lead) => <article key={lead.id}>
          <div><small>{lead.city} · {audienceTypes[lead.audience].label}</small><h3>{lead.name}</h3><p>{lead.address}</p><p>{lead.eventsConducted || 0} events · {lead.studentsEnrolled || 0} students enrolled</p><select aria-label={`Response status for ${lead.name}`} value={lead.responseStatus || "no_response"} onChange={(event) => updateLead(lead.id, { responseStatus: event.target.value as SavedLead["responseStatus"] })}><option value="no_response">No response</option><option value="replied">Replied</option><option value="interested">Interested</option><option value="opted_out">Opted out</option></select></div>
          <select value={lead.stage} onChange={(event) => updateLeadStage(lead.id, event.target.value as LeadStage)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
          <div className={outreachStyles.pipelineFields}>
            <label><span>Contact notes</span><input value={lead.notes} onChange={(event) => updateLead(lead.id, { notes: event.target.value })} placeholder="Next step or contact notes" /></label>
            <label><span>Events conducted</span><input type="number" min={0} step={1} value={lead.eventsConducted ?? 0} onChange={(event) => updateLead(lead.id, { eventsConducted: Math.max(0, Number(event.target.value) || 0) })} /></label>
            <label><span>Students enrolled</span><input type="number" min={0} step={1} value={lead.studentsEnrolled ?? 0} onChange={(event) => updateLead(lead.id, { studentsEnrolled: Math.max(0, Number(event.target.value) || 0) })} /></label>
          </div>
          <div className={styles.rowActions}>{lead.phone && <a href={`tel:${lead.phone}`}>Call</a>}{lead.website && <a href={lead.website} target="_blank" rel="noreferrer">Website</a>}<button onClick={() => openActivityForLead(lead.id)}>Log activity</button><button onClick={() => removeLead(lead.id)}>Remove</button></div>
        </article>)}</div> : <div className={styles.empty}><span>◎</span><h2>No saved leads yet.</h2><p>Use Discover to build your first local partner list.</p><button onClick={() => setTab("discover")}>Discover opportunities</button></div>}
      </section>}

      {tab === "outreach" && <section className={styles.panel}>
        <div className={styles.panelHead}><div><span>OUTREACH KIT</span><h2>Start a relevant conversation.</h2></div><p>Adapt these drafts before sending. Confirm consent and use real, verifiable LunchBox claims.</p></div>
        <div className={outreachStyles.recipientSection}>
          <div><h3>Automated campaign recipients</h3><p>Add contact details and record explicit consent for each channel before preparing a campaign.</p></div>
          {outreachRecipients.length ? <div className={outreachStyles.recipientList}>{outreachRecipients.map((lead) => {
            const message = buildOutreach(campaignName, lead.city, lead.audience);
            const whatsappUrl = lead.phone ? buildWhatsAppUrl(lead.phone, message.whatsapp) : "";
            const emailUrl = lead.contactEmail ? `mailto:${encodeURIComponent(lead.contactEmail)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.email)}` : "";
            return <article key={lead.id}>
              <div><small>{audienceTypes[lead.audience].label}</small><h4>{lead.name}</h4><p>{lead.phone || "No phone number available"}</p></div>
              <input type="email" value={lead.contactEmail || ""} onChange={(event) => updateLead(lead.id, { contactEmail: event.target.value })} placeholder="Contact email address" aria-label={`Email address for ${lead.name}`} />
              <div className={outreachStyles.sendActions}>
                {whatsappUrl ? <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a> : <span>WhatsApp unavailable</span>}
                {emailUrl ? <a href={emailUrl}>Email</a> : <span>Add email</span>}
              </div>
              <div className={outreachStyles.consents}>
                <label><input type="checkbox" checked={Boolean(lead.whatsappConsent)} onChange={(event) => updateLead(lead.id, { whatsappConsent: event.target.checked })} disabled={!lead.phone} /> WhatsApp consent recorded</label>
                <label><input type="checkbox" checked={Boolean(lead.emailConsent)} onChange={(event) => updateLead(lead.id, { emailConsent: event.target.checked })} disabled={!lead.contactEmail} /> Email consent recorded</label>
              </div>
            </article>;
          })}</div> : <div className={outreachStyles.recipientEmpty}>No recipients saved yet. Discover and save schools, colleges, apartments, or parent hubs first.</div>}
          <div className={outreachStyles.sequenceControls}>
            <label><span>Messages per recipient</span><select value={messagesPerRecipient} onChange={(event) => setMessagesPerRecipient(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
            <label><span>Time interval</span><select value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value))}><option value={24}>1 day</option><option value={48}>2 days</option><option value={72}>3 days</option><option value={168}>1 week</option><option value={336}>2 weeks</option></select></label>
            <label className={outreachStyles.responseToggle}><input type="checkbox" checked={responseAware} onChange={(event) => setResponseAware(event.target.checked)} /> Stop follow-ups after a reply, interest, or opt-out</label>
            <label><span>Campaign image</span><select value={campaignImage} onChange={(event) => setCampaignImage(event.target.value)}><option value="auto">Automatic by audience</option><option value="/campaigns/school-lunch.webp">School lunch</option><option value="/campaigns/college-lunch.webp">College lunch</option><option value="/campaigns/community-lunch.webp">Community lunch</option><option value="custom">Custom image URL</option></select></label>
            {campaignImage === "custom" && <label className={outreachStyles.customImage}><span>Public HTTPS image URL</span><input type="url" value={customImageUrl} onChange={(event) => setCustomImageUrl(event.target.value)} placeholder="https://example.com/campaign-image.jpg" /></label>}
          </div>
          <div className={outreachStyles.automationBar}><button onClick={() => void previewCampaign()} disabled={campaignLoading}>{campaignLoading ? "Preparing…" : "Preview automated campaign"}</button>{campaignPreview && <p>{campaignPreview}</p>}</div>
          {campaignMessages.length > 0 && <div className={outreachStyles.messagePreviews}>
            <h3>Dynamic messages ready for review</h3>
            {campaignMessages.map(({ recipient, message, sequence, scheduledFor }) => <article key={`${recipient.id}-${sequence}`}>
              {/* A user-selected remote campaign URL cannot be statically allowlisted for next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={message.imageUrl} alt={`Campaign creative for ${recipient.name}`} />
              <div className={outreachStyles.previewContent}>
                <div className={outreachStyles.previewMeta}><span>{audienceTypes[recipient.audience].label}</span><span>Message {sequence}</span><span>Variant {message.variant}</span><span>{new Date(scheduledFor).toLocaleString()}</span><strong>{recipient.name}</strong></div>
                {recipient.whatsappConsent && <section><h4>WhatsApp message</h4><p>{message.whatsapp}</p></section>}
                {recipient.emailConsent && <section><h4>Email subject</h4><p>{message.subject}</p><h4>Email message</h4><p>{message.email}</p></section>}
              </div>
            </article>)}
          </div>}
        </div>
        <div className={styles.outreachGrid}>
          <CopyCard title="WhatsApp introduction" text={outreach.whatsapp} />
          <CopyCard title="Email subject" text={outreach.subject} compact />
          <CopyCard title="Email body" text={outreach.email} />
          <CopyCard title="Call opener" text={outreach.call} />
        </div>
      </section>}

      {tab === "events" && <MarketingEvents leads={saved} events={events} activities={activities} onEventsChange={persistEvents} onActivitiesChange={persistActivities} initialLeadId={activityLeadId} onInitialLeadHandled={() => setActivityLeadId("")} onLeadStageChange={updateLeadStage} />}
    </section>
  </main>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function CopyCard({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <article className={`${styles.copyCard} ${compact ? styles.compact : ""}`}><div><h3>{title}</h3><button onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button></div><p>{text}</p></article>;
}

function buildOutreach(name: string, city: MarketingCity, audience: AudienceType) {
  const group = audienceTypes[audience].label.toLowerCase();
  return {
    whatsapp: `Hello, I’m reaching out from LunchBox. We’re planning ${name}, a vegetarian school-lunch pilot for families in ${city}. We would like to explore a short introduction or tasting with your ${group}. Who would be the right person to speak with?`,
    subject: `LunchBox pilot opportunity for families in ${city}`,
    email: `Hello,\n\nLunchBox is preparing a vegetarian school-lunch pilot for students in grades 6–12 in ${city}. We are speaking with selected ${group} to understand parent interest and arrange a limited tasting.\n\nCould we schedule a brief call to discuss whether this may be relevant to your community?\n\nRegards,\nLunchBox team`,
    call: `Hello, I’m calling from LunchBox about a small school-lunch pilot in ${city}. We are looking for a few ${group} to understand parent demand. May I speak with the person who coordinates community partnerships?`,
  };
}

function buildWhatsAppUrl(phone: string, message: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function readLocal<T>(key: string): T[] {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T[] : []; }
  catch { return []; }
}

function mergeRecords<T>(remote: T[], local: T[], id: (item: T) => string) {
  const merged = new Map(remote.map((item) => [id(item), item]));
  local.forEach((item) => merged.set(id(item), item));
  return [...merged.values()];
}
