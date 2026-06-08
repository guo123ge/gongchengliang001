import { getDb } from "./db";
import type { Component } from "@/lib/types";
import type { Blueprint } from "@/lib/store";

export interface ServerProjectRecord {
  id: string;
  name: string;
  components: Component[];
  blueprint: Blueprint | null;
  createdAt: number;
  updatedAt: number;
  version: number;
  componentCount: number;
}

interface ProjectRow {
  id: string;
  name: string;
  components_json: string;
  blueprint_json: string | null;
  created_at: number;
  updated_at: number;
  version: number;
  component_count: number;
}

function rowToRecord(row: ProjectRow): ServerProjectRecord {
  return {
    id: row.id,
    name: row.name,
    components: JSON.parse(row.components_json || "[]"),
    blueprint: row.blueprint_json ? JSON.parse(row.blueprint_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    componentCount: row.component_count,
  };
}

export function listProjectRecords() {
  const rows = getDb()
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
    .all() as ProjectRow[];
  return rows.map(rowToRecord);
}

export function getProjectRecord(id: string) {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function upsertProjectRecord(record: ServerProjectRecord) {
  const now = Date.now();
  const existing = getProjectRecord(record.id);
  const createdAt = existing?.createdAt ?? record.createdAt ?? now;
  const updatedAt = record.updatedAt ?? now;
  getDb()
    .prepare(`
      INSERT INTO projects (id, name, components_json, blueprint_json, created_at, updated_at, version, component_count)
      VALUES (@id, @name, @componentsJson, @blueprintJson, @createdAt, @updatedAt, @version, @componentCount)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        components_json = excluded.components_json,
        blueprint_json = excluded.blueprint_json,
        updated_at = excluded.updated_at,
        version = excluded.version,
        component_count = excluded.component_count
    `)
    .run({
      id: record.id,
      name: record.name || "未命名项目",
      componentsJson: JSON.stringify(record.components ?? []),
      blueprintJson: record.blueprint ? JSON.stringify(record.blueprint) : null,
      createdAt,
      updatedAt,
      version: record.version || 1,
      componentCount: record.components?.length ?? record.componentCount ?? 0,
    });
  return getProjectRecord(record.id)!;
}

export function deleteProjectRecord(id: string) {
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
}
