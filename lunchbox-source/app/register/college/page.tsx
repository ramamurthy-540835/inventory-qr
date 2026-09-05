import type { Metadata } from "next";
import EntityRegistrationForm from "@/components/EntityRegistrationForm";

export const metadata: Metadata = { title: "College Student Meal Registration | LunchBox", robots: { index: false, follow: false } };
export default function CollegeRegistrationPage() { return <EntityRegistrationForm entityType="college" />; }
