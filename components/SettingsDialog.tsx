"use client";
import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

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

interface Preset {
  id: string;
  name: string;
  color: string;
  baseUrl: string;
  models: string[];
  keyPlaceholder: string;
  keyLink: string;
}

const PRESETS: Preset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyPlaceholder: "sk-...",
    keyLink: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "qwen",
    name: "通义千问",
    color: "border-violet-500/50 hover:border-violet-400 hover:bg-violet-500/10",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long"],
    keyPlaceholder: "sk-...",
    keyLink: "https://bailian.console.aliyun.com/?apiKey=1",
  },
  {
    id: "kimi",
    name: "Kimi",
    color: "border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-500/10",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyPlaceholder: "sk-...",
    keyLink: "https://platform.moonshot.cn/console/api-keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    color: "border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-500/10",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    keyPlaceholder: "sk-...",
    keyLink: "https://platform.openai.com/api-keys",
  },
];

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [msg, setMsg] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  useEffect(() => {
    const c = loadAIConfig();
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setApiKey(c.apiKey);
    setTemperature(c.temperature);
    const matched = PRESETS.find((p) => c.baseUrl.includes(p.baseUrl.replace("https://", "").split("/")[0]));
    if (matched) setActivePresetId(matched.id);
  }, []);

  const applyPreset = (p: Preset) => {
    setBaseUrl(p.baseUrl);
    setModel(p.models[0]);
    setActivePresetId(p.id);
  };

  const save = () => {
    const cfg: AIConfig = { baseUrl, model, apiKey, temperature };
    saveAIConfig(cfg);
    setMsg("已保存");
    setTimeout(() => setMsg(""), 2000);
  };

  const activePreset = PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[520px] p-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-on-surface">AI 接口设置</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high"><X className="w-4 h-4" /></button>
        </div>

        {/* Provider Quick-select */}
        <div className="mb-4">
          <div className="text-xs text-on-surface-variant mb-2">选择服务商（自动填写 Base URL 与推荐模型）</div>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${p.color} ${
                  activePresetId === p.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-outline-variant/30 text-on-surface-variant"
                }`}
              >
                {activePresetId === p.id && (
                  <span className="absolute top-1.5 right-1.5"><Check className="w-3 h-3 text-primary" /></span>
                )}
                <span className="font-semibold">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model quick-select (if preset chosen) */}
        {activePreset && (
          <div className="mb-3">
            <div className="text-xs text-on-surface-variant mb-1.5">快选模型</div>
            <div className="flex flex-wrap gap-1.5">
              {activePreset.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                    model === m
                      ? "bg-primary/15 border-primary/50 text-primary font-medium"
                      : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-on-surface-variant mb-1">Base URL</div>
            <input className="input-eng" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1" />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant mb-1">Model</div>
            <input className="input-eng" value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat / qwen-plus / gpt-4o-mini" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-on-surface-variant">API Key</div>
              {activePreset && (
                <a href={activePreset.keyLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">获取 {activePreset.name} Key →</a>
              )}
            </div>
            <input className="input-eng" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={activePreset?.keyPlaceholder ?? "sk-..."} />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant mb-1">Temperature：{temperature}</div>
            <input type="range" min={0} max={1} step={0.1} value={temperature}
              onChange={(e) => setTemperature(+e.target.value)} className="w-full accent-primary" />
          </div>
          <div className="text-xs text-on-surface-variant/60 leading-relaxed">
            配置存于浏览器 localStorage，请求经 <code className="text-primary/80">/api/ai/chat</code> 服务端代理转发。
            <br />部署时可用环境变量 <code className="text-primary/80">AI_BASE_URL / AI_API_KEY / AI_MODEL</code> 预置。
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <span className="flex-1 text-xs text-tertiary self-center">{msg}</span>
          <button className="btn-eng" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
