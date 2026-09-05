import { z } from "zod";
export const franchiseApplicationSchema = z.object({
  name: z.string().trim().min(3).max(160), companyName: z.string().trim().min(2).max(160), category: z.string().trim().min(2).max(100), area: z.string().trim().min(2).max(100), address: z.string().trim().min(8).max(300), contactName: z.string().trim().min(2).max(160),
  phone: z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid 10-digit Indian mobile number."),
  email: z.string().trim().email().max(254), website: z.union([z.literal(""), z.string().trim().url().max(300)]), latitude: z.union([z.literal(""), z.coerce.number().min(-90).max(90)]).optional(), longitude: z.union([z.literal(""), z.coerce.number().min(-180).max(180)]).optional(), opportunityId: z.string().trim().max(120).optional(), city: z.string().trim().min(2).max(100).default("Chennai"),
});
export type FranchiseApplicationInput = z.infer<typeof franchiseApplicationSchema>;
