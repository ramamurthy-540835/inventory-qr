export const PLANS = {
  senior: { id: "senior", label: "Senior Citizens", priceInPaise: 2900 },
  school: { id: "school", label: "School Students", priceInPaise: 3900 },
  college: { id: "college", label: "College Students", priceInPaise: 4900 },
  working: { id: "working", label: "Working People", priceInPaise: 5900 },
} as const;

export type PlanId = keyof typeof PLANS;

export function planPriceInRupees(plan: PlanId) {
  return PLANS[plan].priceInPaise / 100;
}
