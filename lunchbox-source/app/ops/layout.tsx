import Link from "next/link";

export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    {children}
    <nav aria-label="Operations navigation" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 40, display: "flex", gap: 8, padding: 6, border: "1px solid #dfe5d9", borderRadius: 999, background: "#fffdf7ee", boxShadow: "0 10px 28px #18392c1f", backdropFilter: "blur(10px)" }}>
      <Link href="/ops" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 800 }}>Control room</Link>
      <Link href="/ops/appointments" style={{ padding: "8px 12px", fontSize: 12, fontWeight: 800 }}>Appointments</Link>
      <Link href="/ops/costs" style={{ padding: "8px 12px", borderRadius: 999, background: "#18392c", color: "white", fontSize: 12, fontWeight: 800 }}>Costs</Link>
    </nav>
  </>;
}
