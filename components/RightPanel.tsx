"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PanelRightOpen, PanelRight } from "lucide-react";
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
      <aside className="w-full h-full border-l border-eng-border bg-eng-panel flex flex-col items-center py-2 gap-2">
        <button onClick={onToggle} className="p-1 rounded hover:bg-eng-panel2 text-eng-muted" title="展开">
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full h-full border-l border-eng-border bg-eng-panel flex flex-col">
      <div className="border-b border-eng-border flex items-center justify-between">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => { useStore.getState().setAiOpen(t.k === "ai"); setTab(t.k); }}
              className={cn("tab-btn", active === t.k && "tab-btn-active")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onToggle} className="p-1 mr-1 rounded hover:bg-eng-panel2 text-eng-muted" title="收起">
          <PanelRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {active === "params" && <ParamForm />}
        {active === "validate" && <ValidationPanel />}
        {active === "quantity" && <QuantityPanel />}
        {active === "section" && <SectionView />}
        {active === "ai" && <AIPanel />}
      </div>
    </aside>
  );
}
