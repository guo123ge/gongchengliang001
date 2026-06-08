import Database from "better-sqlite3";
import path from "path";
import { ensureServerDirs, dataDir } from "./paths";

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  ensureServerDirs();
  db = new Database(path.join(dataDir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      components_json TEXT NOT NULL,
      blueprint_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      component_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ocr_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      file_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      result_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
  `);
}
