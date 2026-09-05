import { NextRequest, NextResponse } from "next/server";
import { buildCampaignMessage, type CampaignRecipient } from "@/lib/campaigns";
import { audienceTypes, marketingCities } from "@/lib/marketing";

export const runtime = "nodejs";

type CampaignRequest = {
  mode?: "preview" | "send";
  campaignName?: string;
  recipients?: CampaignRecipient[];
  messagesPerRecipient?: number;
  intervalHours?: number;
  responseAware?: boolean;
  imageUrl?: string;
};

function configuration() {
  return {
    email: Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    sendingEnabled: Boolean(process.env.CAMPAIGN_ADMIN_TOKEN),
  };
}

function isRecipient(value: unknown): value is CampaignRecipient {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CampaignRecipient>;
  return typeof item.id === "string" && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 200
    && typeof item.city === "string" && marketingCities.includes(item.city as CampaignRecipient["city"])
    && typeof item.audience === "string" && item.audience in audienceTypes
    && typeof item.emailConsent === "boolean" && typeof item.whatsappConsent === "boolean"
    && (!item.email || (typeof item.email === "string" && item.email.length <= 254))
    && (!item.phone || (typeof item.phone === "string" && item.phone.length <= 30));
}

export async function GET() {
  return NextResponse.json(configuration());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as CampaignRequest | null;
  const campaignName = body?.campaignName?.trim().slice(0, 80) || "LunchBox local lunch pilot";
  const recipients = Array.isArray(body?.recipients) ? body.recipients.slice(0, 100).filter(isRecipient) : [];
  if (!recipients.length) return NextResponse.json({ error: "Add at least one consented recipient." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const messagesPerRecipient = Number.isInteger(body?.messagesPerRecipient) ? Math.min(4, Math.max(1, body!.messagesPerRecipient!)) : 1;
  const intervalHours = Number.isFinite(body?.intervalHours) ? Math.min(720, Math.max(1, Number(body?.intervalHours))) : 48;
  const responseAware = body?.responseAware !== false;
  const imageOverride = validImageUrl(body?.imageUrl, origin);
  const eligible = recipients.filter((recipient) => !responseAware || !["replied", "interested", "opted_out"].includes(recipient.responseStatus || "no_response"));
  const prepared = eligible.flatMap((recipient) => {
    const variants = shuffle([0, 1, 2, 3]).slice(0, messagesPerRecipient);
    return variants.map((variant, sequence) => ({
      recipient,
      message: buildCampaignMessage(recipient, campaignName, origin, variant, imageOverride),
      sequence: sequence + 1,
      scheduledFor: new Date(Date.now() + sequence * intervalHours * 60 * 60 * 1000).toISOString(),
    }));
  });
  if (body?.mode !== "send") {
    return NextResponse.json({ mode: "preview", configuration: configuration(), messages: prepared, skippedForResponse: recipients.length - eligible.length, messagesPerRecipient, intervalHours, responseAware });
  }

  if (!process.env.CAMPAIGN_ADMIN_TOKEN || request.headers.get("x-campaign-admin-token") !== process.env.CAMPAIGN_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Campaign authorization failed." }, { status: 401 });
  }

  const results = [];
  for (const item of prepared) {
    if (new Date(item.scheduledFor).getTime() > Date.now()) {
      results.push({ id: item.recipient.id, sequence: item.sequence, status: "scheduled", scheduledFor: item.scheduledFor });
      continue;
    }
    if (item.recipient.emailConsent && item.recipient.email) results.push(await sendEmail(item.recipient, item.message));
    if (item.recipient.whatsappConsent && item.recipient.phone) results.push(await sendWhatsApp(item.recipient, item.message));
  }
  return NextResponse.json({ mode: "send", results });
}

function validImageUrl(value: unknown, origin: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" || url.origin === origin ? url.toString() : undefined;
  } catch { return undefined; }
}

function shuffle<T>(values: T[]) {
  for (let index = values.length - 1; index > 0; index--) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapWith]] = [values[swapWith], values[index]];
  }
  return values;
}

async function sendEmail(recipient: CampaignRecipient, message: ReturnType<typeof buildCampaignMessage>) {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return { id: recipient.id, channel: "email", status: "not_configured" };
  const html = `<img src="${escapeHtml(message.imageUrl)}" alt="Balanced LunchBox meal" style="max-width:100%;height:auto"><p>${escapeHtml(message.email).replace(/\n/g, "<br>")}</p>`;
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ personalizations: [{ to: [{ email: recipient.email, name: recipient.name }] }], from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || "LunchBox" }, subject: message.subject, content: [{ type: "text/plain", value: message.email }, { type: "text/html", value: html }] }),
  });
  return { id: recipient.id, channel: "email", status: response.ok ? "accepted" : "failed", code: response.status };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

async function sendWhatsApp(recipient: CampaignRecipient, message: ReturnType<typeof buildCampaignMessage>) {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { id: recipient.id, channel: "whatsapp", status: "not_configured" };
  const phone = recipient.phone!.replace(/\D/g, "");
  const response = await fetch(`https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.length === 10 ? `91${phone}` : phone, type: "template", template: { name: message.whatsappTemplate, language: { code: "en" }, components: [{ type: "header", parameters: [{ type: "image", image: { link: message.imageUrl } }] }, { type: "body", parameters: [{ type: "text", text: recipient.name }, { type: "text", text: recipient.area || recipient.city }] }] } }),
  });
  return { id: recipient.id, channel: "whatsapp", status: response.ok ? "accepted" : "failed", code: response.status };
}
