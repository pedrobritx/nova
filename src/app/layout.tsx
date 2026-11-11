import "@pedrobritx/meridian/css/meridian.css";
import "@pedrobritx/meridian/css/components.css";
import "@/styles/nova-ocean.css";
import "@/styles/app.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MeridianEnhancer } from "@/components/meridian-enhancer";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";

export const metadata: Metadata = {
  title: { default: "Nova", template: "%s · Nova" },
  description: "Your feeds as stories: duplicates merged, sources kept.",
  applicationName: "Nova",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6f2f5" },
    { media: "(prefers-color-scheme: dark)", color: "#08202b" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" data-env="ocean" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="nv2">
        <div className="nv2-ground" aria-hidden="true" />
        {children}
        <MeridianEnhancer />
      </body>
    </html>
  );
}
