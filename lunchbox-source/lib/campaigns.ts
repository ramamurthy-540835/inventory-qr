import type { AudienceType, MarketingCity } from "@/lib/marketing";

export type CampaignRecipient = {
  id: string;
  name: string;
  city: MarketingCity;
  area?: string;
  audience: AudienceType;
  phone?: string;
  email?: string;
  whatsappConsent: boolean;
  emailConsent: boolean;
  responseStatus?: "no_response" | "replied" | "interested" | "opted_out";
};

const content = {
  schools: {
    image: "/campaigns/school-lunch.webp",
    template: "lunchbox_school_intro",
    subjects: ["A balanced lunch pilot for {name}", "Fresh vegetarian lunches for {name}", "Could LunchBox support families at {name}?", "A simple weekday meal partnership"],
    openings: ["Support busy families with balanced school lunches", "Bring a simple, reliable vegetarian lunch option to your campus", "Make lunchtime easier with fresh meals planned for students", "Explore a small tasting-led lunch pilot for your school community"],
  },
  colleges: {
    image: "/campaigns/college-lunch.webp",
    template: "lunchbox_college_intro",
    subjects: ["A fresh campus lunch option for {name}", "Vegetarian meal partnership for {name}", "A flexible meal pilot for your campus", "Fresh weekday meals for students and staff"],
    openings: ["Give students a convenient, balanced campus meal", "Explore a flexible vegetarian lunch service for students and staff", "Add a dependable vegetarian option without increasing campus kitchen complexity", "Test student interest through a limited campus tasting"],
  },
  apartments: {
    image: "/campaigns/community-lunch.webp",
    template: "lunchbox_community_intro",
    subjects: ["A family lunch pilot for {name}", "Fresh weekday lunches for your community", "Could LunchBox help busy residents?", "A community tasting for {name}"],
    openings: ["Make weekday lunches easier for families in your community", "Offer residents a convenient, balanced vegetarian lunch option", "Bring reliable weekday meals closer to busy households", "Measure resident interest with a small community tasting"],
  },
  parent_hubs: {
    image: "/campaigns/community-lunch.webp",
    template: "lunchbox_community_intro",
    subjects: ["A LunchBox partnership for {name}", "A balanced lunch pilot for local families", "Fresh meal support for your parent community", "Could we arrange a LunchBox tasting?"],
    openings: ["Help local families discover a reliable weekday lunch option", "Connect parents with fresh vegetarian lunches for busy weekdays", "Give parents a practical way to simplify weekday meal planning", "Explore family interest through a short introduction and tasting"],
  },
} satisfies Record<AudienceType, { image: string; template: string; subjects: string[]; openings: string[] }>;

export function buildCampaignMessage(recipient: CampaignRecipient, campaignName: string, origin: string, variant?: number, imageOverride?: string) {
  const audience = content[recipient.audience];
  const selectedVariant = variant == null ? Math.floor(Math.random() * audience.subjects.length) : variant % audience.subjects.length;
  const subject = audience.subjects[selectedVariant].replace("{name}", recipient.name);
  const opening = audience.openings[selectedVariant];
  const area = recipient.area || recipient.city;
  const whatsapp = `Hello ${recipient.name},\n\n${opening}. LunchBox is planning “${campaignName}” in ${area}. We would be glad to arrange a brief introduction or tasting.\n\nWould you like details? Reply STOP at any time to opt out.`;
  const email = `Hello ${recipient.name} team,\n\n${opening}. LunchBox is planning “${campaignName}” in ${area}, with fresh vegetarian meals designed for dependable weekday service.\n\nWe would be glad to arrange a short call or tasting and understand what would work for your community.\n\nRegards,\nLunchBox team\n\nYou are receiving this because your organisation agreed to be contacted. Reply with “Unsubscribe” to opt out.`;
  return { subject, whatsapp, email, imageUrl: imageOverride || `${origin}${audience.image}`, whatsappTemplate: audience.template, variant: selectedVariant + 1 };
}
