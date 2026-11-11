/**
 * The largest OPML file Nova imports. The form checks it before uploading, the import action
 * checks it again, and next.config.ts lets Server Action requests be large enough to carry it.
 */
export const MAX_OPML_BYTES = 2 * 1024 * 1024;
export const MAX_OPML_LABEL = "2 MB";
export const OPML_TOO_LARGE = `The file is larger than ${MAX_OPML_LABEL}. Is it really an OPML export?`;
