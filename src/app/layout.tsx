import type { Metadata } from "next";
import { Sora, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "MANEXA — AI-Powered School Management",
  description:
    "MANEXA is a multi-tenant SaaS platform that runs every academic, administrative, financial and operational function of a modern educational institution.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "MANEXA", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#B6FF2A",
};

const themeScript = `(() => {
  try {
    const t = localStorage.getItem('mnx-theme') || 'dark';
    if (t === 'light') document.documentElement.classList.add('light');
  } catch(e){}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
