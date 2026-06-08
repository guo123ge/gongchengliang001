import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { getFileRecord } from "./files";

export type OcrStatus = "queued" | "running" | "succeeded" | "failed";

interface OcrRow {
  id: string;
  project_id: string | null;
  file_id: string;
  status: OcrStatus;
  progress: number;
  error: string | null;
  result_json: string | null;
  created_at: number;
  updated_at: number;
}

function rowToJob(row: OcrRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    fileId: row.file_id,
    status: row.status,
    progress: row.progress,
    error: row.error,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOcrJob(fileId: string, projectId?: string | null) {
  const file = getFileRecord(fileId);
  if (!file) throw new Error("文件不存在");
  const id = `ocr_${randomUUID()}`;
  const now = Date.now();
  getDb()
    .prepare(`
      INSERT INTO ocr_jobs (id, project_id, file_id, status, progress, created_at, updated_at)
      VALUES (?, ?, ?, 'queued', 0, ?, ?)
    `)
    .run(id, projectId || file.projectId || null, fileId, now, now);
  void processOcrJob(id);
  return getOcrJob(id)!;
}

export function getOcrJob(id: string) {
  const row = getDb().prepare("SELECT * FROM ocr_jobs WHERE id = ?").get(id) as OcrRow | undefined;
  return row ? rowToJob(row) : null;
}

function updateJob(id: string, patch: Partial<{ status: OcrStatus; progress: number; error: string | null; result: unknown }>) {
  const current = getOcrJob(id);
  if (!current) return;
  getDb()
    .prepare(`
      UPDATE ocr_jobs
      SET status = ?, progress = ?, error = ?, result_json = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      patch.status ?? current.status,
      patch.progress ?? current.progress,
      patch.error === undefined ? current.error : patch.error,
      patch.result === undefined ? (current.result ? JSON.stringify(current.result) : null) : JSON.stringify(patch.result),
      Date.now(),
      id,
    );
}

async function processOcrJob(id: string) {
  const job = getOcrJob(id);
  if (!job) return;
  const file = getFileRecord(job.fileId);
  if (!file) {
    updateJob(id, { status: "failed", progress: 100, error: "文件不存在" });
    return;
  }

  updateJob(id, { status: "running", progress: 20, error: null });
  try {
    const components = await recognizeFileWithVision(file.path, file.mimeType);
    updateJob(id, {
      status: "succeeded",
      progress: 100,
      result: { components, notes: "" },
    });
  } catch (e: any) {
    updateJob(id, {
      status: "failed",
      progress: 100,
      error: e?.message || "OCR 识别失败",
    });
  }
}

async function recognizeFileWithVision(filePath: string, mimeType: string) {
  const baseUrl = process.env.AI_BASE_URL ?? "";
  const apiKey = process.env.AI_API_KEY ?? "";
  const model = process.env.AI_VISION_MODEL || process.env.AI_MODEL || "";
  if (!baseUrl || !apiKey || !model) {
    throw new Error("服务器未配置 AI_BASE_URL / AI_API_KEY / AI_VISION_MODEL");
  }
  if (!mimeType.startsWith("image/")) {
    throw new Error("第一版 OCR 队列仅直接支持图片识别；PDF 请在前端选择页码渲染后提交图片识别");
  }

  const imageUrl = `data:${mimeType};base64,${readFileSync(filePath).toString("base64")}`;
  const base = baseUrl.replace(/\/$/, "");
  const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v1`;
  const resp = await fetch(`${versionedBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "你是结构施工图识别助手。只输出```json代码块，内容为构件数组。" },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: "识别图中的梁、板、柱、基础等构件，输出 JSON 数组。" },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    throw new Error(`视觉 AI 返回 HTTP ${resp.status}: ${await resp.text().catch(() => "")}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const match = String(content).match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error("视觉 AI 未返回 JSON 代码块");
  const parsed = JSON.parse(match[1]);
  if (!Array.isArray(parsed)) throw new Error("视觉 AI JSON 不是数组");
  return parsed;
}
