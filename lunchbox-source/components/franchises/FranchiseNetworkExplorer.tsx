"use client";

import { useState } from "react";
import FranchiseOpportunityDrawer from "@/components/franchises/FranchiseOpportunityDrawer";

export default function FranchiseNetworkExplorer() {
  const [open, setOpen] = useState(false);
  return <section className="network-explorer" aria-labelledby="network-explorer-title">
    <div><span className="kicker">TAMIL NADU NETWORK</span><h3 id="network-explorer-title">Find your LunchBox territory.</h3><p>Choose a city, region and service area, then compare open slots and daily student capacity.</p></div>
    <button className="network-explorer-button" onClick={() => setOpen(true)}>Choose a territory <span>→</span></button>
    <FranchiseOpportunityDrawer open={open} onClose={() => setOpen(false)} />
  </section>;
}
