import type { Metadata } from "next";
import FranchiseApplicationLookup from "@/components/FranchiseApplicationLookup";

export const metadata: Metadata = {
  title: "Franchise Applications | LunchBox Admin",
  description: "Internal LunchBox franchise application lookup.",
  robots: { index: false, follow: false, nocache: true },
};

export default function FranchiseApplicationsPage() {
  return <FranchiseApplicationLookup />;
}
