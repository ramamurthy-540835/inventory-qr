import { describe, expect, it } from "vitest";
import { inrToPaise, SCHOOL_LUNCH_PAISE } from "@/lib/money";

describe("integer school lunch money", () => {
  it("represents ₹39 as 3900 paise", () => expect(inrToPaise(39)).toBe(SCHOOL_LUNCH_PAISE));
  it("rejects fractional INR inputs", () => expect(() => inrToPaise(39.5)).toThrow());
});
