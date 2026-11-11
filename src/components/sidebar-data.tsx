import { Folder } from "lucide-react";
import { getFolders } from "@/lib/data";
import { context } from "@/lib/server";
import { NavLink } from "./nav";
import { Icon } from "./ui";

export async function UnreadCount() {
  const { db } = await context();
  const { unreadTotal } = await getFolders(db);
  return unreadTotal ? <span className="nv2-count" aria-label={`${unreadTotal} unread`}>{unreadTotal}</span> : null;
}

export async function FolderNav() {
  const { db } = await context();
  const { folders } = await getFolders(db);
  if (!folders.length) return null;
  return (
    <div className="app-nav">
      <p className="nv2-group-label" id="folders-label">
        Folders
      </p>
      <ul aria-labelledby="folders-label" className="app-nav">
        {folders.map((f) => (
          <li key={f.id}>
            <NavLink
              href={`/folders/${f.id}`}
              icon={<Icon icon={Folder} />}
              label={f.name}
              count={f.unread ? <span className="nv2-count" aria-label={`${f.unread} unread`}>{f.unread}</span> : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
