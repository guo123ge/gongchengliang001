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

// 服务端默认配置（从环境变量读取，部署时设置）
const SERVER_BASE_URL = process.env.AI_BASE_URL ?? "";
const SERVER_API_KEY = process.env.AI_API_KEY ?? "";
const SERVER_MODEL = process.env.AI_MODEL ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, model, baseUrl, apiKey, temperature, stream } = body as {
    messages: any[];
    model: string;
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    stream?: boolean;
  };

  // 优先使用客户端配置，其次服务端环境变量
  const finalBaseUrl = baseUrl || SERVER_BASE_URL;
  const finalApiKey = apiKey || SERVER_API_KEY;
  const finalModel = model || SERVER_MODEL;

  if (!finalBaseUrl || !finalApiKey || !finalModel) {
    return NextResponse.json(
      { error: "AI 未配置，请在右上角设置中填写 Base URL、API Key 与 Model，或在部署时配置 AI_BASE_URL / AI_API_KEY / AI_MODEL 环境变量。" },
      { status: 400 },
    );
  }

  const isStream = stream === true;

  const payload: Record<string, any> = {
    model: finalModel,
    temperature: typeof temperature === "number" ? temperature : 0.3,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: isStream,
  };

  try {
    const base = finalBaseUrl.replace(/\/$/, "");
    const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v1`;
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
      const detail = errData?.error?.message || errData?.error?.code || errText || "未知错误";
      const diagnostic = `AI 接口返回 HTTP ${resp.status}：${detail}`;
      return NextResponse.json(
        { error: diagnostic, raw: errData || errText },
        { status: resp.status },
      );
    }

    if (isStream) {
      // SSE 流式响应
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = resp.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content ?? "";
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch {
                    // 跳过无法解析的块
                  }
                }
              }
            }
            // 发送结束标记
            controller.enqueue(encoder.encode("__STREAM_DONE__"));
          } catch (e: any) {
            controller.enqueue(encoder.encode(`\n\n[错误: ${e.message}]`));
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-cache",
        },
      });
    }

    // 非流式：原有 JSON 响应
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    const msg = e?.message || "网络错误";
    if (isStream) {
      return new Response(msg, {
        headers: { "Content-Type": "text/plain" },
        status: 500,
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
