import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { expirePendingPayments } from "@/lib/firestore";

export const runtime = "nodejs";

function validSecret(received: string) {
  const expected = process.env.PAYMENT_EXPIRY_TASK_SECRET;
  if (!expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!validSecret(request.headers.get("X-Task-Secret") || "")) {
    return NextResponse.json({ error: "Unauthorized task request." }, { status: 401 });
  }
  return NextResponse.json(await expirePendingPayments());
}
