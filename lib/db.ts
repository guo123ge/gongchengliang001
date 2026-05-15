// IndexedDB 持久化层 — 零后端依赖的本地存储
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

/** 保存项目记录 */
export async function saveProject(record: ProjectRecord): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 加载单个项目 */
export async function loadProject(id: string): Promise<ProjectRecord | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const req = tx.objectStore(STORE_PROJECTS).get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** 列出所有项目（仅元数据，不含 components 大字段） */
export async function listProjects(): Promise<ProjectRecord[]> {
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

/** 删除项目 */
export async function deleteProject(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 读取 meta 值 */
export async function getMeta(key: string): Promise<string | number | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readonly");
  const req = tx.objectStore(STORE_META).get(key);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

/** 写入 meta 值 */
export async function setMeta(key: string, value: string | number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 生成短 ID */
export function genProjectId(): string {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Type guard: IndexedDB 是否可用 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && !!indexedDB.open;
  } catch {
    return false;
  }
}
