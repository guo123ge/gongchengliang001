import path from "path";
import { mkdirSync } from "fs";

const root = process.cwd();

export const dataDir = process.env.APP_DATA_DIR || path.join(root, "data");
export const uploadDir = process.env.APP_UPLOAD_DIR || path.join(root, "uploads");

export function ensureServerDirs() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadDir, { recursive: true });
}

export function toPublicUploadUrl(filePath: string) {
  const rel = path.relative(uploadDir, filePath).replace(/\\/g, "/");
  return `/api/uploads/${rel}`;
}
