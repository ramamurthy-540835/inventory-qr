import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Razorpay signature verification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "checkout-secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "webhook-secret");
  });

  it("accepts an authentic checkout signature", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const signature = createHmac("sha256", "checkout-secret").update("order_123|pay_123").digest("hex");
    expect(verifyCheckoutSignature("order_123", "pay_123", signature)).toBe(true);
  });

  it("rejects a checkout signature for a different payment", async () => {
    const { verifyCheckoutSignature } = await import("@/lib/razorpay");
    const signature = createHmac("sha256", "checkout-secret").update("order_123|pay_other").digest("hex");
    expect(verifyCheckoutSignature("order_123", "pay_123", signature)).toBe(false);
  });

  it("verifies the exact raw webhook body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/razorpay");
    const body = '{"event":"payment.captured","payload":{"value":39}}';
    const signature = createHmac("sha256", "webhook-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(`${body}\n`, signature)).toBe(false);
  });
});
