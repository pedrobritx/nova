"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

// Icons arrive as rendered elements: components cannot cross from server to client.
type Props = { href: string; icon: ReactNode; label: string; count?: ReactNode };

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ href, icon, label, count, current }: Props & { current: boolean }) {
  return (
    <Link href={href} className="nv2-nav" aria-current={current ? "page" : undefined}>
      {icon}
      <span className="nv2-nav-label">{label}</span>
      {count}
    </Link>
  );
}

function CurrentNavItem(props: Props) {
  return <NavItem {...props} current={isCurrent(usePathname(), props.href)} />;
}

/** The link renders at once; which one is current is filled in from the URL as the page loads. */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<NavItem {...props} current={false} />}>
      <CurrentNavItem {...props} />
    </Suspense>
  );
}

function TabItem({ href, icon, label, current }: Omit<Props, "count"> & { current: boolean }) {
  return (
    <Link href={href} className="nv2-tab" aria-current={current ? "page" : undefined}>
      {icon}
      {label}
    </Link>
  );
}

function CurrentTabItem(props: Omit<Props, "count">) {
  return <TabItem {...props} current={isCurrent(usePathname(), props.href)} />;
}

export function TabLink(props: Omit<Props, "count">) {
  return (
    <Suspense fallback={<TabItem {...props} current={false} />}>
      <CurrentTabItem {...props} />
    </Suspense>
  );
}
