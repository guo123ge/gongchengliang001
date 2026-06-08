import type { Component } from "./types";
import type { Blueprint } from "./store";

const DB_NAME = "rebar-quant";
const DB_VERSION = 2;
const STORE_PROJECTS = "projects";
const STORE_META = "meta";

export interface ProjectRecord {
  id: string;
  name: string;
  components: Component[];
  blueprint: Blueprint | null;
  createdAt: number;
  updatedAt: number;
  version: number;
  componentCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        const meta = db.createObjectStore(STORE_META, { keyPath: "key" });
        meta.put({ key: "currentProjectId", value: "" });
        meta.put({ key: "lastUsedTimestamp", value: 0 });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) throw new Error(await resp.text().catch(() => `HTTP ${resp.status}`));
  return resp.json() as Promise<T>;
}

function canUseServerApi() {
  return typeof window !== "undefined";
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  if (canUseServerApi()) {
    try {
      await apiJson(`/api/projects/${encodeURIComponent(record.id)}`, {
        method: "PUT",
        body: JSON.stringify(record),
      });
      return;
    } catch (e) {
      console.warn("服务器保存失败，回退 IndexedDB", e);
    }
  }
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  if (canUseServerApi()) {
    try {
      const data = await apiJson<{ project: ProjectRecord }>(`/api/projects/${encodeURIComponent(id)}`);
      return data.project;
    } catch (e) {
      console.warn("服务器加载失败，回退 IndexedDB", e);
    }
  }
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const req = tx.objectStore(STORE_PROJECTS).get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(): Promise<ProjectRecord[]> {
  if (canUseServerApi()) {
    try {
      const data = await apiJson<{ projects: ProjectRecord[] }>("/api/projects");
      return data.projects;
    } catch (e) {
      console.warn("服务器列表失败，回退 IndexedDB", e);
    }
  }
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const req = tx.objectStore(STORE_PROJECTS).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const list = (req.result ?? []) as ProjectRecord[];
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    };
    req.onerror = () => reject(tx.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (canUseServerApi()) {
    try {
      await apiJson(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      return;
    } catch (e) {
      console.warn("服务器删除失败，回退 IndexedDB", e);
    }
  }
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta(key: string): Promise<string | number | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readonly");
  const req = tx.objectStore(STORE_META).get(key);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function setMeta(key: string, value: string | number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function genProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && !!indexedDB.open;
  } catch {
    return false;
  }
}
