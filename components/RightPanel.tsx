"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PanelRightOpen, PanelRight, Settings2 } from "lucide-react";
import ParamForm from "./ParamForm";
import ValidationPanel from "./ValidationPanel";
import QuantityPanel from "./QuantityPanel";
import SectionView from "./SectionView";
import AIPanel from "./AIPanel";
import { useStore } from "@/lib/store";

type Tab = "params" | "validate" | "quantity" | "section" | "ai";

const TABS: { k: Tab; label: string }[] = [
  { k: "params", label: "参数" },
  { k: "validate", label: "校验" },
  { k: "quantity", label: "工程量" },
  { k: "section", label: "剖面" },
  { k: "ai", label: "AI 助手" },
];

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function RightPanel({ collapsed, onToggle }: Props) {
  const [tab, setTab] = useState<Tab>("params");
  const aiOpen = useStore((s) => s.aiOpen);
  const active = aiOpen ? "ai" : tab;

  if (collapsed) {
    return (
      <aside className="w-full h-full flex flex-col items-center py-panel-padding gap-stack-gap bg-surface-container-low">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="展开">
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
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
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="收起">
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-outline-variant/20 bg-surface-container-low flex items-center">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => { useStore.getState().setAiOpen(t.k === "ai"); setTab(t.k); }}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors border-b-2",
              active === t.k
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
        {active === "params" && <ParamForm />}
        {active === "validate" && <ValidationPanel />}
        {active === "quantity" && <QuantityPanel />}
        {active === "section" && <SectionView />}
        {active === "ai" && <AIPanel />}
      </div>
    </aside>
  );
}
