"use client";

import { useState } from "react";
import EntityRegistrationForm from "@/components/EntityRegistrationForm";

export default function OfficeCompanyRegistration() {
  const [entityType, setEntityType] = useState<"office" | "company">("office");
  return <EntityRegistrationForm key={entityType} entityType={entityType} onBusinessTypeChange={setEntityType} />;
}
