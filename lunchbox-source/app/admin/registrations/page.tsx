import type { Metadata } from "next";
import PartnerRegistrationDashboard from "@/components/PartnerRegistrationDashboard";

export const metadata: Metadata = { title: "Registration Pipeline | LunchBox Admin", robots: { index: false, follow: false, nocache: true } };
export default function PartnerRegistrationsPage() { return <PartnerRegistrationDashboard />; }
