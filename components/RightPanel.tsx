"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PanelRightOpen, PanelRight, Settings2, Sparkles, X } from "lucide-react";
import ParamForm from "./ParamForm";
import ValidationPanel from "./ValidationPanel";
import QuantityPanel from "./QuantityPanel";
import SectionView from "./SectionView";
import AIPanel from "./AIPanel";
import { useStore } from "@/lib/store";

type Tab = "params" | "validate" | "quantity" | "section";

const TABS: { k: Tab; label: string }[] = [
  { k: "params",   label: "参数" },
  { k: "validate", label: "校验" },
  { k: "quantity", label: "工程量" },
  { k: "section",  label: "剖面" },
];

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function RightPanel({ collapsed, onToggle }: Props) {
  const [tab, setTab] = useState<Tab>("params");
  const aiOpen    = useStore((s) => s.aiOpen);
  const setAiOpen = useStore((s) => s.setAiOpen);

  if (collapsed) {
    return (
      <aside className="w-full h-full flex flex-col items-center py-panel-padding gap-stack-gap bg-surface-container-low">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          title="展开面板"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => setAiOpen(true)}
          className={cn(
            "p-2 rounded-lg transition-colors",
            aiOpen
              ? "bg-primary/20 text-primary"
              : "hover:bg-surface-container-high text-on-surface-variant"
          )}
          title="AI 助手"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <>
      {/* ── AI 助手抽屉 ── */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          onClick={() => setAiOpen(false)}
        >
          <div
            className="h-full w-[400px] bg-surface-container-low border-l border-outline-variant/30 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideInRight 0.22s ease-out" }}
          >
            <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-bold text-on-surface text-sm">AI 助手</span>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIPanel />
            </div>
          </div>
        </div>
      )}

      {/* ── 右侧面板 ── */}
      <aside className="w-full h-full flex flex-col bg-surface-container-low">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface">参数设置</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">构件属性调整</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAiOpen(true)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  aiOpen
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-surface-container-high text-on-surface-variant"
                )}
                title="AI 助手"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                title="收起"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-outline-variant/20 bg-surface-container-low flex items-center">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors border-b-2",
                tab === t.k
                  ? "text-primary border-primary bg-surface-container"
                  : "text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-high/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "params"   && <ParamForm />}
          {tab === "validate" && <ValidationPanel />}
          {tab === "quantity" && <QuantityPanel />}
          {tab === "section"  && <SectionView />}
        </div>
      </aside>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
