export type GuestSource = {
  url: string;
  title: string;
  siteUrl: string | null;
  folder: string | null;
  addedAt: string;
  refreshedAt: string | null;
  error: string | null;
};

export type GuestItem = {
  key: string;
  feedUrl: string;
  guid: string;
  linkKey: string | null;
  url: string | null;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: string;
  read: boolean;
  saved: boolean;
};

export type GuestPreference = {
  key: string;
  value: string;
};