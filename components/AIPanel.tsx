"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User as UserIcon, Sparkles, Settings, Zap, PlusCircle, Pencil, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "@/lib/store";
import type { Component } from "@/lib/types";
import { loadAIConfig, saveAIConfig } from "./SettingsDialog";

interface Msg { role: "user" | "assistant"; content: string }

// ── AI 操作指令卡片 ──────────────────────────────────────────────

function rebarLabel(r: any): string {
  if (r.label) return r.label;
  const parts: string[] = [`${r.role}`];
  if (r.grade && r.diameter) parts.push(`${r.grade} Φ${r.diameter}`);
  if (r.count) parts.push(`${r.count}根`);
  if (r.spacing) parts.push(`@${r.spacing}mm`);
  if (r.extension) parts.push(`ext=${r.extension}mm`);
  return parts.join(" ");
}

function geomLabel(g: any): string {
  const p: string[] = [];
  if (g.b != null && g.h != null) p.push(`${g.b}×${g.h}`);
  if (g.L != null) p.push(`L=${g.L}`);
  if (g.Lx != null && g.Ly != null) p.push(`${g.Lx}×${g.Ly}`);
  if (g.t != null) p.push(`t=${g.t}`);
  if (g.D != null) p.push(`Φ${g.D}`);
  if (g.hc != null) p.push(`hc=${g.hc}`);
  return p.join(" mm, ") + (p.length ? " mm" : "");
}

function PatchField({ name, value }: { name: string; value: any }) {
  if (name === "rebars" && Array.isArray(value)) {
    return (
      <div className="mt-1">
        <span className="font-medium text-on-surface">钢筋：</span>
        <ul className="mt-0.5 ml-3 space-y-0.5">
          {value.map((r: any, i: number) => (
            <li key={i} className="text-on-surface-variant">
              <span className="font-mono">{rebarLabel(r)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (name === "geometry" && typeof value === "object") {
    return (
      <div className="mt-0.5 flex gap-1.5">
        <span className="font-medium text-on-surface">尺寸：</span>
        <span className="text-on-surface-variant font-mono">{geomLabel(value)}</span>
      </div>
    );
  }
  if (name === "concrete" && typeof value === "object") {
    const parts = [value.grade, value.seismic !== "NONE" ? `抗震${value.seismic}级` : "非抗震", value.cover ? `c=${value.cover}mm` : ""].filter(Boolean);
    return (
      <div className="mt-0.5 flex gap-1.5">
        <span className="font-medium text-on-surface">混凝土：</span>
        <span className="text-on-surface-variant">{parts.join(" / ")}</span>
      </div>
    );
  }
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  const display = str.length > 80 ? str.slice(0, 80) + "…" : str;
  return (
    <div className="mt-0.5 flex gap-1.5">
      <span className="font-medium text-on-surface">{name}：</span>
      <span className="text-on-surface-variant font-mono break-all">{display}</span>
    </div>
  );
}

function OpItem({ op }: { op: any }) {
  if (op.action === "create") {
    const c = op.component ?? {};
    return (
      <div className="px-3 py-2 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5">
          <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-400">新建</span>
          <span className="font-medium text-on-surface">{c.name ?? "—"}</span>
          {c.type && <span className="text-on-surface-variant">({c.type})</span>}
        </div>
        {c.geometry && <PatchField name="geometry" value={c.geometry} />}
        {c.concrete && <PatchField name="concrete" value={c.concrete} />}
        {c.rebars && <PatchField name="rebars" value={c.rebars} />}
      </div>
    );
  }
  if (op.action === "delete") {
    return (
      <div className="px-3 py-2 text-xs flex items-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="font-semibold text-red-400">删除</span>
        <span className="font-mono text-on-surface-variant">{op.id}</span>
      </div>
    );
  }
  if (op.action === "update" && op.patch) {
    return (
      <div className="px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-400">更新</span>
          <span className="font-mono text-on-surface-variant">{op.id}</span>
        </div>
        <div className="ml-5 mt-0.5 space-y-0.5">
          {Object.entries(op.patch).map(([k, v]) => (
            <PatchField key={k} name={k} value={v} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="px-3 py-2 text-xs font-mono text-on-surface-variant">{JSON.stringify(op)}</div>
  );
}

function OpsCard({ ops }: { ops: any[] }) {
  return (
    <div className="my-2 rounded-lg border border-primary/25 bg-primary/5 overflow-hidden">
      <div className="px-3 py-1.5 bg-primary/10 text-xs font-semibold text-primary flex items-center gap-1.5 border-b border-primary/20">
        <Zap className="w-3.5 h-3.5" />
        AI 操作指令（共 {ops.length} 条）
      </div>
      <div className="divide-y divide-outline-variant/20">
        {ops.map((op: any, i: number) => <OpItem key={i} op={op} />)}
      </div>
    </div>
  );
}

/** Markdown 渲染组件（AI 消息专用） */
function MdContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:       ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        h1:      ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 border-b border-outline-variant/20 pb-1">{children}</h1>,
        h2:      ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>,
        h3:      ({ children }) => <h3 className="text-xs font-semibold mb-1 mt-2 first:mt-0 text-primary">{children}</h3>,
        ul:      ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol:      ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
        li:      ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong:  ({ children }) => <strong className="font-semibold text-on-surface">{children}</strong>,
        em:      ({ children }) => <em className="italic text-on-surface-variant">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-on-surface-variant italic">{children}</blockquote>
        ),
        code: ({ inline, className, children, ...props }: any) => {
          if (!inline) {
            if (className === "language-json") {
              const raw = String(children).replace(/\n$/, "");
              try {
                const ops = JSON.parse(raw);
                if (Array.isArray(ops) && ops.length > 0 && ops[0]?.action) {
                  return <OpsCard ops={ops} />;
                }
              } catch {}
            }
            return (
              <code className="block bg-surface-container rounded p-2 my-2 text-[11px] font-mono leading-relaxed overflow-x-auto border border-outline-variant/20 whitespace-pre" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="bg-surface-container px-1 py-0.5 rounded text-[11px] font-mono text-primary border border-outline-variant/20" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-surface-container">{children}</thead>,
        th:    ({ children }) => <th className="border border-outline-variant/30 px-2 py-1 font-semibold text-left">{children}</th>,
        td:    ({ children }) => <td className="border border-outline-variant/30 px-2 py-1">{children}</td>,
        hr:    () => <hr className="border-outline-variant/20 my-3" />,
        a:     ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function AIPanel() {
  const components = useStore((s) => s.components);
  const updateComponent = useStore((s) => s.updateComponent);
  const addFromComponent = (c: Component) => {
    useStore.setState((s) => ({ components: [...s.components, c] }));
    useStore.getState().revalidate();
  };
  const removeComponent = useStore((s) => s.removeComponent);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const [showConfigInline, setShowConfigInline] = useState(false);
  const [inlineModel, setInlineModel] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    const cfg = loadAIConfig();

    const userMsg: Msg = { role: "user", content: text };
    const context = `当前模型 JSON：\n${JSON.stringify(components, null, 2)}`;
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...next.map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: context }],
          model: cfg.model,
          temperature: cfg.temperature,
          stream: true,
        }),
      });

      if (!r.ok) {
        let errMsg = "请求失败";
        try {
          const errJson = await r.json();
          errMsg = errJson.error || JSON.stringify(errJson);
        } catch {
          errMsg = await r.text().catch(() => "请求失败");
        }
        setMsgs((m) => [...m, { role: "assistant", content: `错误：${errMsg}` }]);
        setBusy(false);
        return;
      }

      // 流式读取
      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let streamEnded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk === "__STREAM_DONE__") {
          streamEnded = true;
          break;
        }
        full += chunk;
        setStreamingContent(full);
      }

      setMsgs((m) => [...m, { role: "assistant", content: full }]);
      setStreamingContent("");
      applyOps(full);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setMsgs((m) => [...m, { role: "assistant", content: `请求失败：${e.message}` }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const applyOps = (text: string) => {
    const m = text.match(/```json\s*([\s\S]*?)```/);
    if (!m) return;
    try {
      const ops = JSON.parse(m[1]);
      if (!Array.isArray(ops)) return;
      for (const op of ops) {
        if (op.action === "update" && op.id && op.patch) updateComponent(op.id, op.patch);
        else if (op.action === "create" && op.component) addFromComponent(op.component);
        else if (op.action === "delete" && op.id) removeComponent(op.id);
      }
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-title-sm text-title-sm font-semibold text-on-surface">AI 助手</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">结构计算智能助手</p>
          </div>
        </div>
        <button
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
          onClick={() => {
            const cfg = loadAIConfig();
            setInlineModel(cfg.model);
            setShowConfigInline(true);
          }}
          title="修改 API 配置"
        >
          <Settings className="w-3.5 h-3.5" />配置
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-3 text-xs text-on-surface-variant">
          AI Key 由服务器环境变量管理；如需切换模型，请点击右上角配置。
        </div>

        {msgs.length === 0 && (
          <div className="text-on-surface-variant text-xs bg-surface-container-high/30 rounded-lg p-4">
            <p className="font-medium mb-2">示例指令：</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>把 KL1 的梁高改为 700mm，并重新校验配筋</li>
              <li>新建一根 C40 C 级钢筋的柱 KZ2，500x500x3600</li>
              <li>解释 22G101 中 LaE 抗震锚固的计算</li>
            </ul>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="mt-0.5 shrink-0">
              {m.role === "user" ? (
                <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-on-surface-variant" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
            <div className={`flex-1 max-w-[85%] ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block rounded-lg px-3 py-2 break-words leading-relaxed ${
                m.role === "user"
                  ? "bg-primary/10 text-on-surface border border-primary/20 whitespace-pre-wrap"
                  : "bg-surface-container-high/50 text-on-surface border border-outline-variant/10 w-full"
              }`}>
                {m.role === "user" ? m.content : (
                  <MdContent content={m.content} />
                )}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2 text-on-surface-variant items-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">思考中...</span>
          </div>
        )}
        {streamingContent && (
          <div className="flex gap-2">
            <div className="mt-0.5 shrink-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="flex-1 max-w-[85%]">
              <div className="rounded-lg px-3 py-2 break-words leading-relaxed bg-surface-container-high/50 text-on-surface border border-outline-variant/10 w-full">
                <MdContent content={streamingContent} />
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline Config */}
      {showConfigInline && (
        <div className="border-t border-outline-variant/20 p-3 bg-amber-500/10 space-y-2">
          <div className="text-xs text-amber-400 font-medium">AI Key 已由服务器托管，可按需覆盖模型</div>
          <div className="flex gap-2">
            <input className="input-eng flex-1 text-xs" placeholder="Model" value={inlineModel} onChange={(e) => setInlineModel(e.target.value)} />
            <button
              className="btn-primary text-xs whitespace-nowrap"
              onClick={() => {
                saveAIConfig({ model: inlineModel, temperature: 0.3 });
                setShowConfigInline(false);
                send();
              }}
            >
              保存并使用
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-outline-variant/20 p-3 flex gap-2 bg-surface-container-low">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="描述要修改的构件或咨询平法规则..."
          className="input-eng flex-1 resize-none"
        />
        <button className="btn-primary self-end" onClick={send} disabled={busy}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

