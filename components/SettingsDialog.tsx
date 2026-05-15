"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "rebar-quant.aiConfig.v3";

export interface AIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
}

export function loadAIConfig(): AIConfig {
  if (typeof window === "undefined") return { baseUrl: "", model: "", apiKey: "", temperature: 0.3 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        baseUrl: c.baseUrl || "",
        model: c.model || "",
        apiKey: c.apiKey || "",
        temperature: typeof c.temperature === "number" ? c.temperature : 0.3,
      };
    }
  } catch {}
  return { baseUrl: "", model: "", apiKey: "", temperature: 0.3 };
}

export function saveAIConfig(cfg: AIConfig) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const c = loadAIConfig();
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setApiKey(c.apiKey);
    setTemperature(c.temperature);
  }, []);

  const save = () => {
    const cfg: AIConfig = { baseUrl, model, apiKey, temperature };
    saveAIConfig(cfg);
    setMsg("已保存（保存在本地浏览器）");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[480px] p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">AI 接口设置</div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-eng-muted mb-1">Base URL（OpenAI 兼容）</div>
            <input className="input-eng" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1" />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">Model</div>
            <input className="input-eng" value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat / qwen-plus" />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">API Key</div>
            <input className="input-eng" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..." />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">Temperature：{temperature}</div>
            <input type="range" min={0} max={1} step={0.1} value={temperature}
              onChange={(e) => setTemperature(+e.target.value)} className="w-full" />
          </div>
          <div className="text-xs text-eng-muted">
            配置保存在浏览器 localStorage（下次打开无需重新输入）。
            <br />请求经 <code>/api/ai/chat</code> 服务端代理转发以避开 CORS。
            <br />部署者可在环境变量 <code>AI_BASE_URL / AI_API_KEY / AI_MODEL</code> 中预配置 Key，用户无需输入。
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <span className="flex-1 text-xs text-eng-ok self-center">{msg}</span>
          <button className="btn-eng" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
