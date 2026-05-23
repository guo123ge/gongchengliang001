import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RECOGNIZE_SYSTEM = `你是一名专业的结构工程师 AI，擅长从建筑结构施工图中识别构件信息。

用户会提供一张结构平面图或配筋图的图片。请识别图中可见的结构构件，按以下 JSON 格式输出：

\`\`\`json
[
  {
    "type": "BEAM",
    "name": "KL1",
    "geometry": { "b": 300, "h": 600, "L": 6000 },
    "concrete": { "grade": "C30", "seismic": "TWO", "cover": 25, "env": "Ia" },
    "rebars": [
      { "id": "r1", "role": "LONGITUDINAL", "grade": "HRB400", "diameter": 25, "count": 2 },
      { "id": "r2", "role": "STIRRUP", "grade": "HRB400", "diameter": 8, "spacing": 200, "densifySpacing": 100, "densifyLength": 600 }
    ],
    "placement": { "x": 0, "y": 0, "z": 0 }
  }
]
\`\`\`

规则：
1. 构件 type 仅限：BEAM / COLUMN / SHEAR_WALL / SLAB / STAIR / FOUND / STRIP_FOUND / PILE_CAP / PILE / RAFT
2. 所有长度单位 mm；混凝土等级 C20~C80；钢筋等级 HPB300 / HRB400 / HRB500
3. 若图纸信息不足，请合理推断常用值并在 JSON 后附注说明
4. 每个构件必须包含唯一 id 字段（格式 "comp_1", "comp_2"...）
5. 只输出 JSON 代码块，不要额外解释（除非推断说明）`;

const SERVER_BASE_URL = process.env.AI_BASE_URL ?? "";
const SERVER_API_KEY = process.env.AI_API_KEY ?? "";
const SERVER_MODEL = process.env.AI_MODEL ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imageUrl, baseUrl, apiKey, model } = body as {
    imageUrl: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  };

  const finalBaseUrl = baseUrl || SERVER_BASE_URL;
  const finalApiKey = apiKey || SERVER_API_KEY;
  const finalModel = model || SERVER_MODEL;

  if (!finalBaseUrl || !finalApiKey || !finalModel) {
    return NextResponse.json({ error: "AI 未配置" }, { status: 400 });
  }

  const base = finalBaseUrl.replace(/\/$/, "");
  const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v1`;

  const payload = {
    model: finalModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: RECOGNIZE_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: "请识别这张结构图中的所有构件，按要求输出 JSON。",
          },
        ],
      },
    ],
  };

  try {
    const resp = await fetch(`${versionedBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      let errData: any = {};
      try { errData = JSON.parse(errText); } catch {}
      const detail = errData?.error?.message || errText || "未知错误";
      return NextResponse.json({ error: `AI 接口错误 HTTP ${resp.status}：${detail}` }, { status: resp.status });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";

    // Extract JSON block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 未返回有效 JSON", raw: content }, { status: 422 });
    }

    let components: any[];
    try {
      components = JSON.parse(jsonMatch[1]);
      if (!Array.isArray(components)) throw new Error("not array");
    } catch {
      return NextResponse.json({ error: "JSON 解析失败", raw: jsonMatch[1] }, { status: 422 });
    }

    // Ensure required fields
    const uid = () => Math.random().toString(36).slice(2, 10);
    components = components.map((c, i) => ({
      id: c.id ?? `ai_${uid()}`,
      type: c.type ?? "BEAM",
      name: c.name ?? `构件${i + 1}`,
      geometry: c.geometry ?? {},
      concrete: {
        grade: "C30",
        seismic: "TWO",
        cover: 25,
        env: "Ia",
        ...c.concrete,
      },
      rebars: Array.isArray(c.rebars)
        ? c.rebars.map((r: any) => ({ id: r.id ?? `r_${uid()}`, ...r }))
        : [],
      placement: c.placement ?? { x: 0, y: 0, z: 0 },
      centralLabel: c.centralLabel,
    }));

    // Extract any explanation after the JSON block
    const notes = content.replace(/```json[\s\S]*?```/, "").trim();

    return NextResponse.json({ components, notes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "网络错误" }, { status: 500 });
  }
}
