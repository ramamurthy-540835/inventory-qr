export const SCHOOL_LUNCH_PAISE = 3900;
export function inrToPaise(amountInr: number) { if (!Number.isSafeInteger(amountInr) || amountInr < 0) throw new Error("Money must be a non-negative integer INR amount."); return amountInr * 100; }
