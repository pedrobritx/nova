"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { moveSource, unfollow } from "@/app/actions";
import { Body, Icon } from "./ui";

const NEW = "__new__";

/** A folder picker that saves as soon as it changes; "New folder…" asks for a name first. */
export function MoveSource({ subscriptionId, current, folders, label }: { subscriptionId: string; current: string | null; folders: string[]; label: string }) {
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  return (
    <form action={moveSource} ref={form}>
      <input type="hidden" name="subscription" value={subscriptionId} />
      <label htmlFor={id} className="nv2-sr">{label}</label>
      <select
        id={id}
        name="folder"
        className="input"
        style={{ minWidth: 180 }}
        defaultValue={current ?? ""}
        onChange={(e) => {
          if (e.target.value === NEW) {
            const name = window.prompt("Name the new folder")?.trim();
            if (!name) {
              e.target.value = current ?? "";
              return;
            }
            const option = new Option(name, name, true, true);
            e.target.add(option);
          }
          form.current?.requestSubmit();
        }}
      >
        <option value="">No folder</option>
        {folders.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
        <option value={NEW}>New folder…</option>
      </select>
    </form>
  );
}

export function UnfollowButton({ subscriptionId, title }: { subscriptionId: string; title: string }) {
  return (
    <form
      action={unfollow}
      onSubmit={(e) => {
        if (!window.confirm(`Stop following ${title}? Its items leave your library.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="subscription" value={subscriptionId} />
      <button type="submit" className="m-mat m-quiet m-icon" aria-label={`Unfollow ${title}`} title="Unfollow">
        <Body />
        <span className="m-label">
          <Icon icon={Trash2} />
        </span>
      </button>
    </form>
  );
}
