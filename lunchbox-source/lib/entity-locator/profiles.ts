import type { EntityType } from "@/lib/entity-locator/types";

export type EntitySearchProfile = {
  entityType: EntityType;
  label: string;
  collection: "offices" | "companies" | "colleges";
  idPrefix: "OFFICE" | "COMPANY" | "COLLEGE";
  googleQueryTerm: string;
  serpQueryTerms: readonly string[];
  preferredTypes: readonly string[];
  includePattern: RegExp;
  excludePattern: RegExp;
};

export const ENTITY_PROFILES: Record<EntityType, EntitySearchProfile> = {
  office: {
    entityType: "office",
    label: "Office",
    collection: "offices",
    idPrefix: "OFFICE",
    googleQueryTerm: "office",
    serpQueryTerms: ["office", "corporate office"],
    preferredTypes: ["corporate_office", "business_center", "business_park", "office", "software_company"],
    includePattern: /\b(office|corporate|business (?:center|centre|park)|it park|software|bpo|consulting|regional|head office|branch|financial services|professional services|workspace|cowork|co-work)\b/i,
    excludePattern: /\b(school|college|university|hospital|restaurant|cafe|shop|store|apartment|residency|temple|salon|gym|cinema|theatre)\b/i,
  },
  company: {
    entityType: "company",
    label: "Company",
    collection: "companies",
    idPrefix: "COMPANY",
    googleQueryTerm: "company",
    serpQueryTerms: ["company", "private limited"],
    preferredTypes: ["corporate_office", "company", "software_company", "manufacturer", "consultant"],
    includePattern: /\b(company|companies|private limited|pvt\.? ltd|limited|ltd|llp|technologies|technology|solutions|industries|enterprise|consulting|logistics|software|services|systems|manufacturing|corporation)\b/i,
    excludePattern: /\b(school|college|university|hospital|restaurant|cafe|apartment|temple|salon|gym|cinema|theatre|dance|music|studio|fitness)\b/i,
  },
  college: {
    entityType: "college",
    label: "College",
    collection: "colleges",
    idPrefix: "COLLEGE",
    googleQueryTerm: "college",
    serpQueryTerms: ["college", "private college"],
    preferredTypes: ["college", "university", "educational_institution"],
    includePattern: /\b(college|polytechnic|institute of technology|engineering institute|arts and science|medical institute|management institute|academy of higher education)\b/i,
    excludePattern: /\b(school|tuition|coaching|training centre|training center|driving|dance|music|office|restaurant|hospital|shop|store)\b/i,
  },
};

export function isEntityType(value: string): value is EntityType {
  return value === "office" || value === "company" || value === "college";
}
