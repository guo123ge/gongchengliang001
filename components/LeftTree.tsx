"use client";
import { Plus, Trash2, Box, Square, Columns, Circle, PanelLeftOpen, PanelLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ComponentType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: { t: ComponentType; label: string; icon: any }[] = [
  { t: "BEAM", label: "梁", icon: Box },
  { t: "COLUMN", label: "柱", icon: Columns },
  { t: "SLAB", label: "板", icon: Square },
  { t: "PILE", label: "桩基", icon: Circle },
];

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function LeftTree({ collapsed, onToggle }: Props) {
  const components = useStore((s) => s.components);
  const selectedId = useStore((s) => s.selectedId);
  const addComponent = useStore((s) => s.addComponent);
  const removeComponent = useStore((s) => s.removeComponent);
  const select = useStore((s) => s.select);

  const groups = TYPES.map((t) => ({
    ...t,
    items: components.filter((c) => c.type === t.t),
  }));

  if (collapsed) {
    return (
      <aside className="w-full h-full border-r border-eng-border bg-eng-panel flex flex-col items-center py-2 gap-2">
        <button onClick={onToggle} className="p-1 rounded hover:bg-eng-panel2 text-eng-muted" title="展开">
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.t} className="p-1 rounded hover:bg-eng-panel2 text-eng-muted" title={t.label} onClick={() => addComponent(t.t)}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-full h-full border-r border-eng-border bg-eng-panel flex flex-col">
      <div className="px-3 py-2 border-b border-eng-border flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-eng-muted">构件树</span>
        <button onClick={onToggle} className="p-1 rounded hover:bg-eng-panel2 text-eng-muted" title="收起">
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-2 grid grid-cols-2 gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.t} className="btn-eng justify-center" onClick={() => addComponent(t.t)}>
              <Plus className="w-3.5 h-3.5" />
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.t} className="mt-3">
            <div className="flex items-center gap-1.5 text-xs text-eng-muted px-1 mb-1">
              <g.icon className="w-3.5 h-3.5" />
              {g.label}（{g.items.length}）
            </div>
            <div className="space-y-0.5">
              {g.items.map((c) => (
                <div
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-1 text-sm rounded cursor-pointer",
                    selectedId === c.id ? "bg-eng-accent/20 text-white" : "hover:bg-eng-panel2 text-eng-text",
                  )}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-eng-err"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除 ${c.name}？`)) removeComponent(c.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
