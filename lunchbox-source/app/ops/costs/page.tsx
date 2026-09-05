import type { Metadata } from "next";
import OperationsCostManager from "@/components/OperationsCostManager";

export const metadata: Metadata = { title: "Operations Costs | LunchBox", robots: { index: false, follow: false, nocache: true } };

export default function OperationsCostsPage() { return <OperationsCostManager />; }
