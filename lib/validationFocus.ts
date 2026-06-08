import type { ValidationFocus } from "./store";
import type { ValidationItem } from "./types";

export function validationFocusKey(v: Pick<ValidationItem, "componentId" | "rule" | "message">) {
  return `${v.componentId}::${v.rule}::${v.message}`;
}

export function isValidationFocused(
  item: Pick<ValidationItem, "componentId" | "rule" | "message">,
  focus: ValidationFocus | null,
) {
  if (!focus || focus.componentId !== item.componentId) return false;
  if (validationFocusKey(item) === validationFocusKey({
    componentId: focus.componentId,
    rule: focus.rule ?? "",
    message: focus.message ?? "",
  })) {
    return true;
  }

  const itemText = `${item.rule} ${item.message}`;
  const focusText = `${focus.rule ?? ""} ${focus.message ?? ""}`;
  if (focus.rule && (item.rule.includes(focus.rule) || focus.rule.includes(item.rule))) return true;
  if (focus.message && (item.message.includes(focus.message) || focus.message.includes(item.message))) return true;

  const keywords = ["洞口", "变截面", "特殊抗震节点", "抗震节点", "碰撞"];
  return keywords.some((keyword) => itemText.includes(keyword) && focusText.includes(keyword));
}
