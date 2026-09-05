import { schools } from "@/lib/meals";

export const DEMO_CONTEXT = {
  city: "Chennai",
  school: schools[0]?.name || "Chennai pilot school",
  gradeBand: "8th standard",
  studentFirstName: "Nila",
  section: "B",
} as const;
