import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Meridian's material layers, rendered by React so Meridian's script never has to add them.
export function Body() {
  return (
    <span className="m-body" aria-hidden="true">
      <span className="m-refract" />
      <span className="m-light" />
    </span>
  );
}

export function Icon({ icon: I, size = 20 }: { icon: LucideIcon; size?: 16 | 18 | 20 | 22 }) {
  return <I className={size === 16 ? "i i-16" : "i"} width={size} height={size} strokeWidth={1.9} aria-hidden="true" focusable="false" />;
}

type Kind = "pigment" | "glass" | "quiet";

export function Button({ kind = "glass", icon, children, ...rest }: { kind?: Kind; icon?: LucideIcon; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button type="button" {...rest} className={`m-mat m-${kind} ${rest.className ?? ""}`.trim()}>
      <Body />
      <span className="m-label">
        {icon && <Icon icon={icon} />}
        {children}
      </span>
    </button>
  );
}

export function LinkButton({ kind = "glass", icon, children, ...rest }: { kind?: Kind; icon?: LucideIcon; children: ReactNode } & ComponentProps<typeof Link>) {
  return (
    <Link {...rest} className={`m-mat m-${kind} ${rest.className ?? ""}`.trim()}>
      <Body />
      <span className="m-label">
        {icon && <Icon icon={icon} />}
        {children}
      </span>
    </Link>
  );
}

export function IconButton({ kind = "quiet", icon, label, ...rest }: { kind?: Kind; icon: LucideIcon; label: string } & ComponentProps<"button">) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={`m-mat m-${kind} m-icon`}>
      <Body />
      <span className="m-label">
        <Icon icon={icon} />
      </span>
    </button>
  );
}

export function IconLink({ kind = "quiet", icon, label, ...rest }: { kind?: Kind; icon: LucideIcon; label: string } & ComponentProps<typeof Link>) {
  return (
    <Link aria-label={label} title={label} {...rest} className={`m-mat m-${kind} m-icon`}>
      <Body />
      <span className="m-label">
        <Icon icon={icon} />
      </span>
    </Link>
  );
}

/** Two letters that stand in for a source's logo. */
export function initials(name: string): string {
  const words = name.replace(/&/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function Mono({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={large ? "nv2-mono nv2-mono--l" : "nv2-mono"} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function MonoStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <span className="nv2-stack-mono" aria-hidden="true">
      {shown.map((n) => (
        <span key={n} className="nv2-mono">
          {initials(n)}
        </span>
      ))}
      {names.length > max && <span className="nv2-mono">+{names.length - max}</span>}
    </span>
  );
}

export function Badge({ children, accent = false, icon }: { children: ReactNode; accent?: boolean; icon?: LucideIcon }) {
  return (
    <span className={accent ? "nv2-badge nv2-badge--accent" : "nv2-badge"}>
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </span>
  );
}

export function Notice({ icon, children, error = false }: { icon: LucideIcon; children: ReactNode; error?: boolean }) {
  return (
    <div className={error ? "notice notice--error" : "notice"} role={error ? "alert" : "status"}>
      <Icon icon={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty nv2-tile">
      <Icon icon={icon} />
      <h2 className="t-section">{title}</h2>
      {children}
    </div>
  );
}

export { Time } from "./time";
