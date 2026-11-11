"use client";

import { CircleAlert, Mail } from "lucide-react";
import { useActionState, useId } from "react";
import { sendSignInLink, type SignInState } from "@/app/sign-in/actions";
import { Body, Icon, Notice } from "./ui";

export function SignInForm() {
  const [state, send, sending] = useActionState<SignInState, FormData>(sendSignInLink, null);
  const id = useId();
  if (state?.sent) {
    return (
      <Notice icon={Mail}>
        Check <strong>{state.email}</strong> for a sign-in link. It works once, for an hour.
      </Notice>
    );
  }
  return (
    <form action={send} className="nv2-stack" style={{ gap: "var(--s4)" }}>
      <div className="field">
        <label htmlFor={id}>Email</label>
        <input id={id} name="email" type="email" className="input" autoComplete="email" required defaultValue={state?.email} />
      </div>
      {state?.error && (
        <Notice icon={CircleAlert} error>
          {state.error}
        </Notice>
      )}
      <button type="submit" className="m-mat m-pigment" aria-busy={sending || undefined}>
        <Body />
        <span className="m-label">
          <Icon icon={Mail} />
          {sending ? "Sending…" : "Email me a link"}
        </span>
      </button>
    </form>
  );
}
