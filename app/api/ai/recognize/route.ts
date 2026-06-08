import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

const RECOGNIZE_SYSTEM = `你是一名专业结构工程图纸识别助手。
用户会提供一张结构平面图或配筋图图片。请识别图中可见构件，并输出一个 JSON 数组代码块：
\`\`\`json
[
  {
    "id": "comp_1",
    "type": "BEAM",
    "name": "KL1",
    "geometry": { "b": 300, "h": 600, "L": 6000 },
    "concrete": { "grade": "C30", "seismic": "TWO", "cover": 25, "env": "Ia" },
    "rebars": [],
    "placement": { "x": 0, "y": 0, "z": 0 }
  }
]
\`\`\`
构件 type 限于 BEAM / COLUMN / SHEAR_WALL / SLAB / STAIR / FOUND / STRIP_FOUND / PILE_CAP / PILE / RAFT。
所有长度单位均为 mm。无法确认的尺寸请保守留空或使用图纸中明确标注的值。`;

const SERVER_BASE_URL = process.env.AI_BASE_URL ?? "";
const SERVER_API_KEY = process.env.AI_API_KEY ?? "";
const SERVER_MODEL = process.env.AI_VISION_MODEL || process.env.AI_MODEL || "";

export async function POST(req: NextRequest) {
  const auth = requireAuth();
  if (auth) return auth;

  const body = await req.json();
  const { imageUrl, model } = body as { imageUrl: string; model?: string };
  const finalModel = model || SERVER_MODEL;

  if (!SERVER_BASE_URL || !SERVER_API_KEY || !finalModel) {
    return NextResponse.json({ error: "服务器未配置视觉 AI 环境变量。" }, { status: 400 });
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "缺少 imageUrl。" }, { status: 400 });
  }

  const base = SERVER_BASE_URL.replace(/\/$/, "");
  const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v1`;
  const payload = {
    model: finalModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: RECOGNIZE_SYSTEM },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          { type: "text", text: "请识别这张结构图中的所有构件，并按要求输出 JSON。" },
        ],
      },
    ],
  };

  try {
    const resp = await fetch(`${versionedBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVER_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json({ error: `AI 接口错误 HTTP ${resp.status}: ${errText}` }, { status: resp.status });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 未返回有效 JSON。", raw: content }, { status: 422 });
    }

    let components: any[] = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(components)) throw new Error("AI 返回内容不是数组。");
    const uid = () => Math.random().toString(36).slice(2, 10);
    components = components.map((c, i) => ({
      id: c.id ?? `ai_${uid()}`,
      type: c.type ?? "BEAM",
      name: c.name ?? `构件${i + 1}`,
      geometry: c.geometry ?? {},
      concrete: { grade: "C30", seismic: "TWO", cover: 25, env: "Ia", ...c.concrete },
      rebars: Array.isArray(c.rebars) ? c.rebars.map((r: any) => ({ id: r.id ?? `r_${uid()}`, ...r })) : [],
      placement: c.placement ?? { x: 0, y: 0, z: 0 },
      centralLabel: c.centralLabel,
    }));
    const notes = content.replace(/```json[\s\S]*?```/, "").trim();
    return NextResponse.json({ components, notes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "识别失败" }, { status: 500 });
  }
}
