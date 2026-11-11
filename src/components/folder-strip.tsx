import Link from "next/link";
import { getFolders } from "@/lib/data";
import { context } from "@/lib/server";
import { KeepCurrentInView } from "./keep-current-in-view";

type Folder = { id: string; name: string };

/**
 * Folders as a row of chips for phones and narrow windows, where the sidebar is hidden. It
 * runs to the screen edges and scrolls sideways, as in the phone design. Hidden on wide
 * screens, where the sidebar lists the same folders.
 */
export function FolderChips({ folders, current }: { folders: Folder[]; current?: string }) {
  if (!folders.length) return null;
  return (
    <nav className="folder-strip" aria-label="Folders">
      {folders.map((f) => (
        <Link key={f.id} href={`/folders/${f.id}`} className="nv2-chip" aria-current={f.id === current ? "page" : undefined}>
          {f.name}
        </Link>
      ))}
      {current && <KeepCurrentInView />}
    </nav>
  );
}

export async function FolderStrip() {
  const { db } = await context();
  const { folders } = await getFolders(db);
  return <FolderChips folders={folders} />;
}
