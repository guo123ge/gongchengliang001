"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
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

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>("params");
  const aiOpen = useStore((s) => s.aiOpen);
  const active = aiOpen ? "ai" : tab;

  return (
    <aside className="w-[420px] shrink-0 h-full border-l border-eng-border bg-eng-panel flex flex-col">
      <div className="border-b border-eng-border flex">
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
