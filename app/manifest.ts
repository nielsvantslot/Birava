import type { MetadataRoute } from "next";

const isStaging = process.env.VERCEL_ENV === "preview";
const iconBase = isStaging ? "/icons/staging" : "/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: isStaging ? "Birava (Staging)" : "Birava",
    short_name: isStaging ? "Birava Staging" : "Birava",
    description:
      "Strava, but for drinks. Log check-ins, relive your sessions, keep score with your crew.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0D09",
    theme_color: "#0A0D09",
    orientation: "portrait",
    icons: [
      { src: `${iconBase}/icon-72x72.png`, sizes: "72x72", type: "image/png" },
      { src: `${iconBase}/icon-96x96.png`, sizes: "96x96", type: "image/png" },
      { src: `${iconBase}/icon-128x128.png`, sizes: "128x128", type: "image/png" },
      { src: `${iconBase}/icon-144x144.png`, sizes: "144x144", type: "image/png" },
      { src: `${iconBase}/icon-152x152.png`, sizes: "152x152", type: "image/png" },
      {
        src: `${iconBase}/icon-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      { src: `${iconBase}/icon-384x384.png`, sizes: "384x384", type: "image/png" },
      {
        src: `${iconBase}/icon-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    categories: ["food", "lifestyle", "social"],
  };
}
