import "@pedrobritx/meridian/css/meridian.css";
import "@pedrobritx/meridian/css/components.css";
import "@/styles/nova-ocean.css";
import "@/styles/app.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MeridianEnhancer } from "@/components/meridian-enhancer";

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

// Runs before first paint: applies the saved appearance (Dawn, Dusk or the system's) and the
// ground texture setting, so the page never flashes the wrong colours. It also stores the
// device's time zone in a cookie so the server can write times and day headings locally.
const APPEARANCE = `(function(){try{var d=document.documentElement,s=localStorage.getItem('nova-appearance')||'system',m=matchMedia('(prefers-color-scheme: dark)');function a(){d.dataset.appearance=s==='system'?(m.matches?'dusk':'dawn'):s}a();if(s==='system')m.addEventListener('change',a);d.dataset.texture=localStorage.getItem('nova-texture')==='off'?'off':'on';var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&document.cookie.indexOf('nova-tz='+encodeURIComponent(z))<0)document.cookie='nova-tz='+encodeURIComponent(z)+';path=/;max-age=31536000;samesite=lax'}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" data-env="ocean" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE }} />
      </head>
      <body className="nv2">
        <div className="nv2-ground" aria-hidden="true" />
        {children}
        <MeridianEnhancer />
      </body>
    </html>
  );
}
