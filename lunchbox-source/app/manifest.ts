import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LunchBox by ChennaiFood",
    short_name: "LunchBox",
    description: "Balanced school lunches delivered to onboarded schools in Tamil Nadu.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fffdf7",
    theme_color: "#18392c",
    categories: ["food", "education", "lifestyle"],
    icons: [
      { src: "/icons/lunchbox-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/lunchbox-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/lunchbox-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
