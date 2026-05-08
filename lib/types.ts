// 核心类型定义

export type ComponentType = "BEAM" | "SLAB" | "COLUMN" | "PILE";

export type RebarGrade = "HPB300" | "HRB400" | "HRB500";
export type ConcreteGrade =
  | "C20" | "C25" | "C30" | "C35" | "C40" | "C45" | "C50" | "C55" | "C60" | "C65" | "C70" | "C75" | "C80";
export type SeismicLevel = "NONE" | "ONE" | "TWO" | "THREE" | "FOUR";
export type EnvClass = "Ia" | "Ib" | "IIa" | "IIb" | "IIIa" | "IIIb";

/** 钢筋描述（简化版原位标注） */
export interface Rebar {
  id: string;
  role: "TOP" | "BOTTOM" | "SIDE" | "STIRRUP" | "MAIN" | "DIST" | "SPIRAL" | "NEG";
  grade: RebarGrade;
  diameter: number;   // mm
  count?: number;     // 根数（纵筋）
  spacing?: number;   // 间距 mm（箍筋非加密区 / 分布筋）
  /** 加密区间距 mm（梁柱端部箍筋加密区） */
  densifySpacing?: number;
  /** 加密区长度 mm（每端） */
  densifyLength?: number;
  /** 板支座负筋自支座边外伸长度 mm */
  extension?: number;
  /** 原位标记字符串，如 "2Φ25+2Φ22" 或 "Φ8@100/200(4)" */
  label?: string;
}

/** 构件几何（单位：mm） */
export interface Geometry {
  // BEAM/COLUMN: b × h × L
  // SLAB: Lx × Ly × t
  // PILE: D(直径) × L
  b?: number;
  h?: number;
  L?: number;
  Lx?: number;
  Ly?: number;
  t?: number;
  D?: number;
}

/** 混凝土参数 */
export interface ConcreteSpec {
  grade: ConcreteGrade;
  impermeability?: string; // P6/P8/P10/P12
  seismic: SeismicLevel;
  cover: number;           // 保护层厚度 mm
  env: EnvClass;
}

/** 构件放置（场景坐标, mm） */
export interface Placement {
  x: number;
  y: number;
  z: number;
  rot?: number; // 绕 Y 旋转（度）
}

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  geometry: Geometry;
  concrete: ConcreteSpec;
  rebars: Rebar[];
  placement: Placement;
}

export type Severity = "pass" | "warn" | "error";

export interface ValidationItem {
  componentId: string;
  rule: string;
  severity: Severity;
  message: string;
}

export interface AIConfigDTO {
  baseUrl: string;
  model: string;
  temperature: number;
  hasKey: boolean;
}

export interface QuantityResult {
  componentId: string;
  name: string;
  type: ComponentType;
  concreteVolume: number;   // m³
  formworkArea: number;     // m²
  rebarByDia: Record<string, { weight: number; length: number; grade: RebarGrade }>; // key: "HRB400-20"
  totalRebarWeight: number; // kg
}
