import { Inbox, Rss, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NovaMark } from "@/components/mark";
import { Icon } from "@/components/ui";
import { NavLink, TabLink } from "@/components/nav";
import { FolderNav, UnreadCount } from "@/components/sidebar-data";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <nav className="app-side nv2-glass" aria-label="Library">
        <Link href="/" className="app-brand">
          <NovaMark />
          Nova
        </Link>
        <div className="app-nav">
          <NavLink href="/" icon={<Icon icon={Sun} />} label="Today" />
          <NavLink
            href="/latest"
            icon={<Icon icon={Inbox} />}
            label="Latest"
            count={
              <Suspense fallback={null}>
                <UnreadCount />
              </Suspense>
            }
          />
        </div>
        <Suspense fallback={<div className="skeleton" style={{ height: 160 }} />}>
          <FolderNav />
        </Suspense>
        <div className="app-side-foot">
          <NavLink href="/sources" icon={<Icon icon={Rss} />} label="Sources" />
          <NavLink href="/settings" icon={<Icon icon={Settings} />} label="Settings" />
        </div>
      </nav>
      <main className="app-main" id="main">
        {children}
      </main>
      <nav className="app-tabbar nv2-tabbar nv2-glass" aria-label="Main">
        <TabLink href="/" icon={<Icon icon={Sun} size={22} />} label="Today" />
        <TabLink href="/latest" icon={<Icon icon={Inbox} size={22} />} label="Latest" />
        <TabLink href="/sources" icon={<Icon icon={Rss} size={22} />} label="Sources" />
        <TabLink href="/settings" icon={<Icon icon={Settings} size={22} />} label="Settings" />
      </nav>
    </div>
  );
}
