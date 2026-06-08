import type { ValidationFilter } from "./store";
import type { Component, ValidationItem } from "./types";

export const VALIDATION_FILTER_OPTIONS: { key: ValidationFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "issues", label: "仅问题" },
  { key: "error", label: "错误" },
  { key: "warn", label: "警告" },
  { key: "pass", label: "通过" },
];

export function filterValidations(
  items: ValidationItem[],
  filter: ValidationFilter,
  keyword = "",
  components: Component[] = [],
) {
  const bySeverity =
    filter === "issues" ? items.filter((v) => v.severity !== "pass") :
    filter === "all" ? items :
    items.filter((v) => v.severity === filter);

  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return bySeverity;

  return bySeverity.filter((v) => {
    const componentName = components.find((c) => c.id === v.componentId)?.name ?? "";
    const haystack = `${componentName} ${v.componentId} ${v.rule} ${v.message}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function groupValidationsByComponent(items: ValidationItem[]) {
  const groups = new Map<string, ValidationItem[]>();
  for (const item of items) {
    groups.set(item.componentId, [...(groups.get(item.componentId) ?? []), item]);
  }
  return Array.from(groups.entries()).map(([componentId, groupItems]) => ({
    componentId,
    items: groupItems,
    pass: groupItems.filter((v) => v.severity === "pass").length,
    warn: groupItems.filter((v) => v.severity === "warn").length,
    error: groupItems.filter((v) => v.severity === "error").length,
  }));
}
