export type DetailNodeType = "beam-column" | "transfer" | "wall-boundary" | "custom";

export interface DetailReference {
  nodeType: DetailNodeType;
  title: string;
  reference: string;
  scope: string;
}

export const DETAIL_REFERENCES: DetailReference[] = [
  {
    nodeType: "beam-column",
    title: "梁柱节点核心区箍筋构造",
    reference: "22G101-1 梁柱节点核心区构造详图",
    scope: "用于框架梁、框架柱交接处核心区箍筋加密、纵筋锚固和节点区钢筋排布复核。",
  },
  {
    nodeType: "transfer",
    title: "转换梁/转换板节点构造",
    reference: "22G101-1 转换构件节点构造详图",
    scope: "用于转换层梁板深度、箍筋加密、上下部纵筋锚固及构件交接冲突复核。",
  },
  {
    nodeType: "wall-boundary",
    title: "剪力墙边缘构件节点",
    reference: "22G101-1 剪力墙边缘构件构造详图",
    scope: "用于约束边缘构件长度、箍筋加密、墙身分布筋与边缘纵筋连接复核。",
  },
  {
    nodeType: "custom",
    title: "自定义特殊节点",
    reference: "施工图专项详图或设计说明",
    scope: "用于项目自定义复杂节点，应结合施工图详图编号、设计说明和专项审查意见复核。",
  },
];

export function recommendedDetailReference(nodeType: DetailNodeType = "beam-column") {
  return DETAIL_REFERENCES.find((item) => item.nodeType === nodeType) ?? DETAIL_REFERENCES[0];
}
