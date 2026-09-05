import type { MarketingCity } from "@/lib/marketing";

export const eventTypes = ["TASTING_DAY", "PTA_STALL", "CAMPUS_SAMPLING", "COMMUNITY_TALK", "FRANCHISE_LAUNCH", "OTHER"] as const;
export const eventStatuses = ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED", "POSTPONED"] as const;
export const activityTypes = ["CALL", "EMAIL", "WHATSAPP", "SMS", "IN_PERSON_VISIT", "OTHER"] as const;
export const activityDirections = ["OUTBOUND", "INBOUND"] as const;
export const activityOutcomes = ["NO_ANSWER", "FOLLOW_UP_NEEDED", "INTERESTED", "NOT_INTERESTED", "MEETING_SCHEDULED", "CONVERTED"] as const;

export type MarketingEventType = (typeof eventTypes)[number];
export type MarketingEventStatus = (typeof eventStatuses)[number];
export type OutreachActivityType = (typeof activityTypes)[number];
export type OutreachDirection = (typeof activityDirections)[number];
export type OutreachOutcome = (typeof activityOutcomes)[number];

export type MarketingEvent = {
  eventId: string;
  title: string;
  eventType: MarketingEventType;
  city: MarketingCity;
  zone: string;
  area: string;
  linkedLeadIds: string[];
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd: string;
  venue: string;
  ownerName: string;
  status: MarketingEventStatus;
  expectedAttendance?: number;
  actualAttendance?: number;
  leadsGeneratedCount?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OutreachActivity = {
  activityId: string;
  leadId: string;
  linkedEventId?: string;
  activityType: OutreachActivityType;
  direction: OutreachDirection;
  outcome: OutreachOutcome;
  notes: string;
  performedBy: string;
  performedAt: string;
  nextFollowUpDate?: string;
  createdAt: string;
};

export const marketingEventsStorageKey = "lunchbox-marketing-events-v1";
export const outreachActivitiesStorageKey = "lunchbox-outreach-activities-v1";

export const eventTypeLabels: Record<MarketingEventType, string> = {
  TASTING_DAY: "Tasting day", PTA_STALL: "PTA stall", CAMPUS_SAMPLING: "Campus sampling",
  COMMUNITY_TALK: "Community talk", FRANCHISE_LAUNCH: "Franchise launch", OTHER: "Other",
};
export const eventStatusLabels: Record<MarketingEventStatus, string> = {
  PLANNED: "Planned", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", POSTPONED: "Postponed",
};
export const activityTypeLabels: Record<OutreachActivityType, string> = {
  CALL: "Call", EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS", IN_PERSON_VISIT: "In-person visit", OTHER: "Other",
};
export const activityOutcomeLabels: Record<OutreachOutcome, string> = {
  NO_ANSWER: "No answer", FOLLOW_UP_NEEDED: "Follow-up needed", INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested", MEETING_SCHEDULED: "Meeting scheduled", CONVERTED: "Converted",
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function outcomeToLeadStage(outcome: OutreachOutcome): "Contacted" | "Interested" | "Meeting" {
  if (outcome === "INTERESTED") return "Interested";
  if (outcome === "MEETING_SCHEDULED" || outcome === "CONVERTED") return "Meeting";
  return "Contacted";
}

type SeedLead = { id: string; name: string; city: MarketingCity; zone?: string; area?: string };

export function buildMarketingSeeds(leads: SeedLead[], now = new Date()) {
  const selected = leads.slice(0, 3);
  const isoDate = (offset: number) => { const date = new Date(now); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); };
  const isoTime = (offsetDays: number, hour: number) => { const date = new Date(now); date.setDate(date.getDate() + offsetDays); date.setHours(hour, 0, 0, 0); return date.toISOString(); };
  const base = selected[0] || { id: "sample-school", name: "Adyar Pilot School", city: "Chennai" as const, zone: "East / North-East Chennai", area: "Adyar" };
  const second = selected[1] || base; const third = selected[2] || second;
  const events: MarketingEvent[] = [
    { eventId: "sample-tasting", title: `${base.name} tasting day`, eventType: "TASTING_DAY", city: base.city, zone: base.zone || "", area: base.area || "", linkedLeadIds: [base.id], scheduledDate: isoDate(5), scheduledTimeStart: "11:00", scheduledTimeEnd: "13:00", venue: base.name, ownerName: "Priya", status: "CONFIRMED", expectedAttendance: 80, notes: "Vegetarian tasting menu and parent feedback cards.", createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { eventId: "sample-pta", title: `${second.name} PTA introduction`, eventType: "PTA_STALL", city: second.city, zone: second.zone || "", area: second.area || "", linkedLeadIds: [second.id], scheduledDate: isoDate(12), scheduledTimeStart: "16:00", scheduledTimeEnd: "18:00", venue: second.name, ownerName: "Arun", status: "PLANNED", expectedAttendance: 45, notes: "Bring pricing cards and allergy policy handout.", createdAt: now.toISOString(), updatedAt: now.toISOString() },
    { eventId: "sample-talk", title: `${third.name} food-safety talk`, eventType: "COMMUNITY_TALK", city: third.city, zone: third.zone || "", area: third.area || "", linkedLeadIds: [third.id], scheduledDate: isoDate(-8), scheduledTimeStart: "10:30", scheduledTimeEnd: "11:30", venue: third.name, ownerName: "Meena", status: "COMPLETED", expectedAttendance: 30, actualAttendance: 34, leadsGeneratedCount: 7, notes: "Strong interest in weekday subscriptions.", createdAt: isoTime(-16, 9), updatedAt: isoTime(-8, 12) },
  ];
  const activities: OutreachActivity[] = [
    { activityId: "sample-call-1", leadId: base.id, activityType: "CALL", direction: "OUTBOUND", outcome: "MEETING_SCHEDULED", notes: "Coordinator confirmed a tasting discussion.", performedBy: "Priya", performedAt: isoTime(-1, 11), nextFollowUpDate: isoDate(1), createdAt: isoTime(-1, 11) },
    { activityId: "sample-email-1", leadId: second.id, activityType: "EMAIL", direction: "OUTBOUND", outcome: "FOLLOW_UP_NEEDED", notes: "Sent menu, pricing, and safety information.", performedBy: "Arun", performedAt: isoTime(-3, 15), nextFollowUpDate: isoDate(0), createdAt: isoTime(-3, 15) },
    { activityId: "sample-whatsapp-1", leadId: third.id, linkedEventId: "sample-talk", activityType: "WHATSAPP", direction: "INBOUND", outcome: "INTERESTED", notes: "Asked for subscription details after the talk.", performedBy: "Meena", performedAt: isoTime(-7, 10), createdAt: isoTime(-7, 10) },
    { activityId: "sample-visit-1", leadId: base.id, activityType: "IN_PERSON_VISIT", direction: "OUTBOUND", outcome: "INTERESTED", notes: "Met the administrator and reviewed serving space.", performedBy: "Priya", performedAt: isoTime(-10, 14), createdAt: isoTime(-10, 14) },
    { activityId: "sample-call-2", leadId: second.id, activityType: "CALL", direction: "OUTBOUND", outcome: "NO_ANSWER", notes: "Reception requested a call after school hours.", performedBy: "Arun", performedAt: isoTime(-12, 16), createdAt: isoTime(-12, 16) },
  ];
  return { events, activities };
}
