import type { Metadata } from "next";
import "./franchise.css";

export const metadata: Metadata = {
  title: "LunchBox Franchise | ₹5 Lakh Opportunity",
  description: "Apply for a LunchBox school meal franchise in Chennai, Coimbatore, Madurai or Trichy.",
};

export default function FranchiseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
