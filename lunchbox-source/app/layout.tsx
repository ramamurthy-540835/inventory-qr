import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./franchise-insights.css";

export const viewport: Viewport = { themeColor: "#18392c", colorScheme: "light" };

export const metadata: Metadata = {
  title: "LunchBox | Better school lunches",
  description: "Balanced school lunches for students in Tamil Nadu.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LunchBox", statusBarStyle: "default" },
  icons: { icon: "/icons/lunchbox-192.png", apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
