"use client";

import type { GuestItem, GuestPreference, GuestSource } from "./types";

const DATABASE_NAME = "nova-guest-v1";
const STORES = ["sources", "items", "preferences"] as const;
type StoreName = (typeof STORES)[number];

type StoredRow = GuestSource | GuestItem | GuestPreference;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not allow local data storage."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: store === "items" || store === "preferences" ? "key" : "url" });
        }
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage"));
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error("Close other Nova tabs and try again."));
  });
}

export async function readAll<T extends StoredRow>(store: StoreName): Promise<T[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, "readonly");
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read local data"));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function writeMany(store: StoreName, rows: StoredRow[]): Promise<void> {
  if (!rows.length) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    for (const row of rows) transaction.objectStore(store).put(row);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not save local data")); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("Local save was cancelled")); };
  });
}

export async function deleteRow(store: StoreName, key: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).delete(key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Could not delete local data")); };
  });
}