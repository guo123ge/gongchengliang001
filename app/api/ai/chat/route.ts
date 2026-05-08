import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `你是一名资深结构工程师 AI 助手，精通中国 22G101 平法图集与钢筋混凝土设计。

用户将提供"当前模型 JSON"（components 数组，含梁/板/柱/桩基），以及自然语言指令。你的任务：

1. 用简洁中文解答用户问题或解释平法规则。
2. 若用户要求修改模型，请在回答末尾输出一段以 \`\`\`json ... \`\`\` 包裹的**操作指令数组**，格式：
   [
     {"action":"update","id":"<componentId>","patch":{"geometry":{...},"concrete":{...},"rebars":[...]}},
     {"action":"create","component":{ 完整 Component 对象，含 id,name,type,geometry,concrete,rebars,placement }},
     {"action":"delete","id":"<componentId>"}
   ]
3. 不确定时只给出解释，不输出操作 JSON。
4. 所有长度单位 mm，构件类型仅限 BEAM/SLAB/COLUMN/PILE。`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, model, baseUrl, apiKey, temperature } = body as {
    messages: any[];
    model: string;
    baseUrl: string;
    apiKey: string;
    temperature?: number;
  };
  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json(
      { error: "AI 未配置，请先在设置中填写 Base URL、API Key 与 Model。" },
      { status: 400 },
    );
  }
  const payload = {
    model,
    temperature: typeof temperature === "number" ? temperature : 0.3,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: false,
  };
  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "AI 接口调用失败", raw: data },
        { status: resp.status },
      );
    }
    const content = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "网络错误" }, { status: 500 });
  }
}
