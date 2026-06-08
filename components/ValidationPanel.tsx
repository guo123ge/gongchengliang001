"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { isValidationFocused, validationFocusKey } from "@/lib/validationFocus";
import { filterValidations, groupValidationsByComponent, VALIDATION_FILTER_OPTIONS } from "@/lib/validationFilter";

export default function ValidationPanel() {
  const validations = useStore((s) => s.validations);
  const components = useStore((s) => s.components);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const focusedValidation = useStore((s) => s.focusedValidation);
  const setFocusedValidation = useStore((s) => s.setFocusedValidation);
  const validationFilter = useStore((s) => s.validationFilter);
  const setValidationFilter = useStore((s) => s.setValidationFilter);
  const validationSearch = useStore((s) => s.validationSearch);
  const setValidationSearch = useStore((s) => s.setValidationSearch);

  const scopeList = useMemo(
    () => selectedId ? validations.filter((v) => v.componentId === selectedId) : validations,
    [selectedId, validations],
  );
  const list = useMemo(
    () => filterValidations(scopeList, validationFilter, validationSearch, components),
    [scopeList, validationFilter, validationSearch, components],
  );
  const nameOf = (id: string) => components.find((c) => c.id === id)?.name ?? id;
  const groupedList = useMemo(() => groupValidationsByComponent(list), [list]);
  const focusedItem = useMemo(
    () => list.find((v) => isValidationFocused(v, focusedValidation)),
    [list, focusedValidation],
  );
  const focusedKey = focusedItem ? validationFocusKey(focusedItem) : null;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusedItem) return;
    setCollapsedGroups((prev) => prev[focusedItem.componentId] ? { ...prev, [focusedItem.componentId]: false } : prev);
  }, [focusedItem]);

  useEffect(() => {
    if (!focusedKey) return;
    const target = itemRefs.current[focusedKey];
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedKey]);

  if (scopeList.length === 0) return <div className="p-4 text-on-surface-variant text-sm">暂无校验项，请先创建构件。</div>;

  return (
    <div className="p-4 space-y-2 text-sm">
      <div className="text-label-code text-on-surface-variant mb-2">
        {selectedId ? `当前构件：${nameOf(selectedId)}` : "全部构件"}
      </div>
      <div className="flex flex-wrap gap-1.5 pb-2">
        {VALIDATION_FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setValidationFilter(option.key)}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
              validationFilter === option.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="pb-2">
        <input
          value={validationSearch}
          onChange={(e) => setValidationSearch(e.target.value)}
          placeholder="搜索规则、提示或构件名称"
          className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-high/40 px-3 py-2 text-xs text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary"
        />
      </div>
      {list.length === 0 && (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high/30 p-3 text-xs text-on-surface-variant">
          当前筛选或搜索条件下暂无校验项，可清空搜索或切换到“全部”查看完整结果。
        </div>
      )}
      {groupedList.map((group) => {
        const collapsed = collapsedGroups[group.componentId] ?? false;
        return (
          <section key={group.componentId} className="rounded-xl border border-outline-variant/20 bg-surface-container-high/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.componentId]: !collapsed }))}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-surface-container-high/50 transition-colors"
            >
              <span className="min-w-0 flex items-center gap-2">
                {collapsed ? <ChevronRight className="w-4 h-4 shrink-0 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 shrink-0 text-on-surface-variant" />}
                <span className="font-medium text-on-surface truncate">{nameOf(group.componentId)}</span>
                <span className="text-[11px] text-on-surface-variant font-mono">{group.items.length} 项</span>
              </span>
              <span className="shrink-0 flex items-center gap-1 text-[11px]">
                {group.error > 0 && <span className="px-1.5 py-0.5 rounded-full bg-error/10 text-error">错 {group.error}</span>}
                {group.warn > 0 && <span className="px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary">警 {group.warn}</span>}
                {group.pass > 0 && <span className="px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary">通 {group.pass}</span>}
              </span>
            </button>
            {!collapsed && (
              <div className="p-2 space-y-2">
                {group.items.map((v, i) => {
                  const Icon = v.severity === "pass" ? CheckCircle2 : v.severity === "warn" ? AlertTriangle : XCircle;
                  const color = v.severity === "pass" ? "text-tertiary" : v.severity === "warn" ? "text-secondary" : "text-error";
                  const bgColor = v.severity === "pass" ? "bg-tertiary/5" : v.severity === "warn" ? "bg-secondary/5" : "bg-error/5";
                  const isFocused = isValidationFocused(v, focusedValidation);
                  const key = validationFocusKey(v);
                  return (
                    <div
                      key={`${key}-${i}`}
                      ref={(node) => {
                        itemRefs.current[key] = node;
                      }}
                      className={`bg-surface-container-high/50 rounded-lg p-3 flex items-start gap-2 cursor-pointer hover:bg-surface-container-high transition-colors border ${isFocused ? "border-primary shadow-[0_0_0_1px_rgba(56,189,248,0.45)]" : "border-outline-variant/10"} ${bgColor}`}
                      onClick={() => {
                        select(v.componentId);
                        setFocusedValidation({ componentId: v.componentId, rule: v.rule, message: v.message });
                      }}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-on-surface">{v.rule}</span>
                          <span className="text-xs text-on-surface-variant font-mono">{nameOf(v.componentId)}</span>
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5">{v.message}</div>
                        {isFocused && <div className="text-[11px] text-primary mt-1">已定位到当前校验项，可在 3D 场景查看对应问题标记。</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
