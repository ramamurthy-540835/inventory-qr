import type { Metadata } from "next";
import PrivateSchoolSearch from "@/components/PrivateSchoolSearch";

export const metadata: Metadata = { title: "Register Your Child for School Meals | LunchBox", description: "Parent and child school-meal registration for LunchBox.", robots: { index: false, follow: false } };
export default function SchoolRegistrationPage() {
  return <PrivateSchoolSearch />;
}
