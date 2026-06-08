import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { toPublicUploadUrl, uploadDir } from "./paths";

const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/octet-stream",
  "text/plain",
  "application/x-dxf",
]);

function safeExt(name: string, type: string) {
  const ext = path.extname(name).toLowerCase();
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".dxf", ".dwg"].includes(ext)) return ext;
  if (type === "application/pdf") return ".pdf";
  if (type === "image/png") return ".png";
  if (type === "image/jpeg") return ".jpg";
  return ".bin";
}

export interface FileRecord {
  id: string;
  projectId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  createdAt: number;
}

interface FileRow {
  id: string;
  project_id: string | null;
  original_name: string;
  mime_type: string;
  size: number;
  path: string;
  created_at: number;
}

function rowToFile(row: FileRow): FileRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    path: row.path,
    url: toPublicUploadUrl(row.path),
    createdAt: row.created_at,
  };
}

export function getFileRecord(id: string) {
  const row = getDb().prepare("SELECT * FROM files WHERE id = ?").get(id) as FileRow | undefined;
  return row ? rowToFile(row) : null;
}

export async function saveUploadedFile(file: File, projectId?: string | null) {
  if (!allowedTypes.has(file.type) && !/\.(pdf|png|jpe?g|webp|dxf|dwg)$/i.test(file.name)) {
    throw new Error("不支持的文件类型");
  }
  const id = `file_${randomUUID()}`;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const dir = path.join(uploadDir, projectId || "unassigned", day);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${id}${safeExt(file.name, file.type)}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  writeFileSync(filePath, bytes);
  getDb()
    .prepare(`
      INSERT INTO files (id, project_id, original_name, mime_type, size, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, projectId || null, file.name, file.type || "application/octet-stream", bytes.length, filePath, now);
  return getFileRecord(id)!;
}
