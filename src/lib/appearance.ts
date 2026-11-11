export type Appearance = "system" | "dawn" | "dusk";

/**
 * Runs in <head> before first paint: applies the saved appearance (Dawn, Dusk or the
 * system's) and the ground texture, so the page never flashes the wrong colours. The choice
 * is kept on <html data-appearance-choice>; the system listener reads it on every change, so
 * an explicit Dawn or Dusk is never overridden and System always follows the device. An
 * unknown saved value counts as System. It also stores the device's time zone in a cookie so
 * the server can write times and day headings locally.
 */
export const APPEARANCE_SCRIPT = `(function(){var d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)'),s='system',t='on';try{s=localStorage.getItem('nova-appearance')||s;t=localStorage.getItem('nova-texture')==='off'?'off':'on'}catch(e){}d.dataset.appearanceChoice=s;d.dataset.texture=t;function a(){var c=d.dataset.appearanceChoice;d.dataset.appearance=c==='dawn'||c==='dusk'?c:(m.matches?'dusk':'dawn')}a();m.addEventListener('change',a);try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&document.cookie.indexOf('nova-tz='+encodeURIComponent(z))<0)document.cookie='nova-tz='+encodeURIComponent(z)+';path=/;max-age=31536000;samesite=lax'}catch(e){}})()`;

/** Applies a choice made in Settings and records it where the head script's listener reads it. */
export function applyAppearance(appearance: Appearance, texture: string) {
  const root = document.documentElement;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.appearanceChoice = appearance;
  root.dataset.appearance = appearance === "system" ? (dark ? "dusk" : "dawn") : appearance;
  root.dataset.texture = texture;
}
