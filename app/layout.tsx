import type { Metadata, Viewport } from "next";
import { Archivo, Source_Serif_4 } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  style: ["normal", "italic"],
});

const isStaging = process.env.VERCEL_ENV === "preview";
const appleIconPath = isStaging
  ? "/icons/staging/icon-192x192.png"
  : "/icons/icon-192x192.png";

export const metadata: Metadata = {
  title: isStaging
    ? "Birava (Staging) — the drinks you remember"
    : "Birava — the drinks you remember",
  description:
    "Strava, but for drinks. Log check-ins, relive your sessions, keep score with your crew.",
  icons: {
    apple: appleIconPath,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: isStaging ? "Birava Staging" : "Birava",
  },
  openGraph: {
    title: "Birava",
    description: "Log check-ins, relive your sessions, keep score with your crew.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0D09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${archivo.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ServiceWorkerRegistration />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
