"use client";
import { Plus, Trash2, Box, Square, Columns, Circle, PanelLeftOpen, PanelLeft, Layers } from "lucide-react";
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
      <aside className="w-full h-full flex flex-col items-center py-panel-padding gap-stack-gap bg-surface-container-low">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="展开">
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-outline-variant/20" />
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.t} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title={t.label} onClick={() => addComponent(t.t)}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col bg-surface-container-low">
      {/* Header */}
      <div className="px-panel-padding py-3 border-b border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">工程结构</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">构件管理</p>
          </div>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="收起">
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Add Component Buttons */}
      <div className="p-panel-padding">
        <button className="w-full bg-surface-container-high text-primary hover:bg-surface-container-highest/40 transition-colors py-2 rounded-lg border border-outline-variant/30 font-button flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          添加构件
        </button>
      </div>

      {/* Component Types Quick Add */}
      <div className="px-panel-padding grid grid-cols-2 gap-2">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.t}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md bg-surface-container-high/50 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors text-sm border border-outline-variant/20"
              onClick={() => addComponent(t.t)}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto px-panel-padding py-2">
        {groups.map((g) => (
          <div key={g.t} className="mt-3">
            {/* Category Header */}
            <div className="flex items-center gap-2 text-label-code text-on-surface-variant px-1 mb-2 uppercase tracking-wider">
              <g.icon className="w-3.5 h-3.5" />
              {g.label}
              <span className="quantity-chip">{g.items.length}</span>
            </div>
            {/* Guide Line + Items */}
            <div className="relative pl-3 border-l border-outline-variant/20">
              {g.items.map((c) => (
                <div
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded transition-colors",
                    selectedId === c.id
                      ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                      : "hover:bg-surface-container-high/50 text-on-surface border-l-2 border-l-transparent",
                  )}
                >
                  <span className="flex-1 truncate font-mono text-xs">{c.name}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-error hover:text-error-container transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`删除 ${c.name}？`)) removeComponent(c.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
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
