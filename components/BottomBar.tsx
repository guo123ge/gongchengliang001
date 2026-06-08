"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, XCircle, Ruler, PanelBottom, PanelBottomOpen, ClipboardCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { isValidationFocused, validationFocusKey } from "@/lib/validationFocus";
import { filterValidations, groupValidationsByComponent, VALIDATION_FILTER_OPTIONS } from "@/lib/validationFilter";

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function BottomBar({ collapsed, onToggle }: Props) {
  const validations = useStore((s) => s.validations);
  const components = useStore((s) => s.components);
  const select = useStore((s) => s.select);
  const setRightPanelTab = useStore((s) => s.setRightPanelTab);
  const focusedValidation = useStore((s) => s.focusedValidation);
  const setFocusedValidation = useStore((s) => s.setFocusedValidation);
  const validationFilter = useStore((s) => s.validationFilter);
  const setValidationFilter = useStore((s) => s.setValidationFilter);
  const validationSearch = useStore((s) => s.validationSearch);
  const setValidationSearch = useStore((s) => s.setValidationSearch);
  const pass = validations.filter((v) => v.severity === "pass").length;
  const warn = validations.filter((v) => v.severity === "warn").length;
  const err = validations.filter((v) => v.severity === "error").length;
  const filteredValidations = filterValidations(validations, validationFilter, validationSearch, components);
  const groupedValidations = useMemo(() => groupValidationsByComponent(filteredValidations), [filteredValidations]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const nameOf = (id: string) => components.find((c) => c.id === id)?.name ?? id;

  if (collapsed) {
    return (
      <footer className="h-full w-full flex items-center justify-between px-3 text-xs text-on-surface-variant bg-surface-container-low">
        <span className="font-label-code">构件：{components.length} · 通过 {pass} / 警告 {warn} / 错误 {err}</span>
        <button onClick={onToggle} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors" title="展开">
          <PanelBottomOpen className="w-4 h-4" />
        </button>
      </footer>
    );
  }

  return (
    <footer className="h-full w-full flex flex-col bg-surface-container-low">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-label-code text-on-surface-variant">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>校验结果</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-tertiary"><CheckCircle2 className="w-3.5 h-3.5" />通过 {pass}</span>
            <span className="flex items-center gap-1 text-secondary"><AlertTriangle className="w-3.5 h-3.5" />警告 {warn}</span>
            <span className="flex items-center gap-1 text-error"><XCircle className="w-3.5 h-3.5" />错误 {err}</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <span className="flex items-center gap-1 text-label-code text-on-surface-variant">
            <Ruler className="w-3 h-3" />22G101 · 阶段 A+B，C 扩展中
          </span>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors" title="收起">
          <PanelBottom className="w-4 h-4" />
        </button>
      </div>

      {/* Validation List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {validations.length > 0 ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5 pb-2">
              {VALIDATION_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setValidationFilter(option.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-xs transition-colors",
                    validationFilter === option.key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              value={validationSearch}
              onChange={(e) => setValidationSearch(e.target.value)}
              placeholder="搜索规则、提示或构件名称"
              className="mb-2 w-full rounded-md border border-outline-variant/20 bg-surface-container-high/40 px-3 py-1.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
            />
            {filteredValidations.length === 0 && (
              <div className="rounded-md border border-outline-variant/20 bg-surface-container-high/30 px-3 py-2 text-xs text-on-surface-variant">
                当前筛选或搜索条件下暂无校验项。
              </div>
            )}
            {groupedValidations.map((group) => {
              const collapsed = collapsedGroups[group.componentId] ?? false;
              return (
                <section key={group.componentId} className="rounded-lg border border-outline-variant/20 bg-surface-container-high/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.componentId]: !collapsed }))}
                    className="w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left hover:bg-surface-container-high/50 transition-colors"
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      {collapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" />}
                      <span className="font-medium text-on-surface text-xs truncate">{nameOf(group.componentId)}</span>
                      <span className="text-[11px] text-on-surface-variant font-mono">{group.items.length} 项</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[10px]">
                      {group.error > 0 && <span className="px-1.5 py-0.5 rounded-full bg-error/10 text-error">错 {group.error}</span>}
                      {group.warn > 0 && <span className="px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary">警 {group.warn}</span>}
                      {group.pass > 0 && <span className="px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary">通 {group.pass}</span>}
                    </span>
                  </button>
                  {!collapsed && (
                    <div className="p-1.5 space-y-1">
                      {group.items.map((v, i) => {
                        const isFocused = isValidationFocused(v, focusedValidation);
                        return (
                          <button
                            key={`${validationFocusKey(v)}-${i}`}
                            type="button"
                            onClick={() => {
                              select(v.componentId);
                              setFocusedValidation({ componentId: v.componentId, rule: v.rule, message: v.message });
                              setRightPanelTab("validate");
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                              v.severity === "pass" && "text-tertiary bg-tertiary/10 border border-tertiary/20 hover:bg-tertiary/15",
                              v.severity === "warn" && "text-secondary bg-secondary/10 border border-secondary/20 hover:bg-secondary/15",
                              v.severity === "error" && "text-error bg-error/10 border border-error/20 hover:bg-error/15",
                              isFocused && "ring-1 ring-primary border-primary/60",
                            )}
                          >
                            {v.severity === "pass" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            {v.severity === "warn" && <AlertTriangle className="w-4 h-4 shrink-0" />}
                            {v.severity === "error" && <XCircle className="w-4 h-4 shrink-0" />}
                            <span className="truncate font-mono text-xs">{v.message}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
            暂无校验结果
          </div>
        )}
      </div>
    </footer>
  );
}
