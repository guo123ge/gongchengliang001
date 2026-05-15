"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User as UserIcon, Sparkles, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component } from "@/lib/types";
import { loadAIConfig, saveAIConfig } from "./SettingsDialog";

interface Msg { role: "user" | "assistant"; content: string }

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
  const [inlineBaseUrl, setInlineBaseUrl] = useState("");
  const [inlineModel, setInlineModel] = useState("");
  const [inlineApiKey, setInlineApiKey] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    const cfg = loadAIConfig();
    if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) {
      setShowConfigInline(true);
      setInlineBaseUrl(cfg.baseUrl);
      setInlineModel(cfg.model);
      setInlineApiKey(cfg.apiKey);
      return;
    }

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
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
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
            setInlineBaseUrl(cfg.baseUrl);
            setInlineModel(cfg.model);
            setInlineApiKey(cfg.apiKey);
            setShowConfigInline(true);
          }}
          title="修改 API 配置"
        >
          <Settings className="w-3.5 h-3.5" />配置
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {(() => {
          const cfg = loadAIConfig();
          const missing = !cfg.apiKey || !cfg.baseUrl || !cfg.model;
          if (missing) {
            return (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-3">
                <div className="text-amber-400 text-xs font-medium mb-2">AI 接口尚未配置</div>
                <div className="text-on-surface-variant text-xs mb-3">
                  请在下方输入 Base URL、Model 和 API Key，或点击右上角「配置」按钮。
                </div>
                <button
                  className="btn-primary text-xs"
                  onClick={() => {
                    setInlineBaseUrl(cfg.baseUrl);
                    setInlineModel(cfg.model);
                    setInlineApiKey(cfg.apiKey);
                    setShowConfigInline(true);
                  }}
                >
                  立即配置
                </button>
              </div>
            );
          }
          return null;
        })()}

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
              <div className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap break-words leading-relaxed ${
                m.role === "user"
                  ? "bg-primary/10 text-on-surface border border-primary/20"
                  : "bg-surface-container-high/50 text-on-surface border border-outline-variant/10"
              }`}>
                {m.content}
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
              <div className="inline-block rounded-lg px-3 py-2 whitespace-pre-wrap break-words leading-relaxed bg-surface-container-high/50 text-on-surface border border-outline-variant/10">
                {streamingContent}
                <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inline Config */}
      {showConfigInline && (
        <div className="border-t border-outline-variant/20 p-3 bg-amber-500/10 space-y-2">
          <div className="text-xs text-amber-400 font-medium">首次使用 AI 助手，请补充接口配置</div>
          <div className="flex gap-2">
            <input className="input-eng flex-1 text-xs" placeholder="Base URL" value={inlineBaseUrl} onChange={(e) => setInlineBaseUrl(e.target.value)} />
            <input className="input-eng flex-1 text-xs" placeholder="Model" value={inlineModel} onChange={(e) => setInlineModel(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <input className="input-eng flex-1 text-xs" type="password" placeholder="API Key" value={inlineApiKey} onChange={(e) => setInlineApiKey(e.target.value)} />
            <button
              className="btn-primary text-xs whitespace-nowrap"
              onClick={() => {
                saveAIConfig({ baseUrl: inlineBaseUrl, model: inlineModel, apiKey: inlineApiKey, temperature: 0.3 });
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
