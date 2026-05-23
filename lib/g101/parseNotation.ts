import type { RebarGrade } from "../types";

export interface ParsedNotation {
  grade?: RebarGrade;
  diameter?: number;
  count?: number;
  spacing?: number;
  densifySpacing?: number;
  legs?: number;       // 箍筋肢数
  valid: boolean;
  label: string;
}

/** 根据平法符号推断钢筋等级 */
function gradeFromSymbol(sym: string): RebarGrade {
  const s = sym.trim();
  if (s === "φ" || s === "ϕ" || /HPB300/i.test(s)) return "HPB300";
  if (s === "⑤" || /HRB500/i.test(s)) return "HRB500";
  return "HRB400"; // Φ, C, A/B/D shortcuts → default HRB400
}

/**
 * 解析 22G101 平法钢筋标注字符串，返回结构化字段。
 *
 * 支持格式举例：
 *  - "2Φ25"                 → count=2, HRB400, d=25
 *  - "4C25"                 → count=4, HRB400, d=25
 *  - "2φ8"                  → count=2, HPB300, d=8
 *  - "Φ8@100/200(2)"        → HRB400, d=8, densify=100, spacing=200, legs=2
 *  - "Φ8@200(4)"            → HRB400, d=8, spacing=200, legs=4
 *  - "Φ8@150"               → HRB400, d=8, spacing=150
 *  - "HRB400-20@200"        → HRB400, d=20, spacing=200
 *  - "4Φ25+2Φ22"            → first group only (count=4, HRB400, d=25)
 */
export function parseRebarNotation(raw: string): ParsedNotation {
  const s = raw.trim();
  const result: ParsedNotation = { label: s, valid: false };
  if (!s) return result;

  let work = s;

  // 1. 检测明确的等级前缀 HPB300 / HRB400 / HRB500
  if (/HRB500/i.test(work)) {
    result.grade = "HRB500";
    work = work.replace(/HRB500\s*[-_]?\s*/i, "");
  } else if (/HRB400/i.test(work)) {
    result.grade = "HRB400";
    work = work.replace(/HRB400\s*[-_]?\s*/i, "");
  } else if (/HPB300/i.test(work)) {
    result.grade = "HPB300";
    work = work.replace(/HPB300\s*[-_]?\s*/i, "");
  }

  // 2. 主模式: (count)(sym)(diameter)[@densify/spacing|(legs)]
  //    支持 Φ φ ϕ C ⑤ 作为等级符号
  const GRADE_SYM = /[Φφϕ⑤C]/u;
  const mainRe = new RegExp(
    "^(\\d+)?\\s*" +       // 可选根数
    "([Φφϕ⑤C])\\s*" +      // 等级符号 (Unicode)
    "(\\d+)" +             // 直径
    "(?:@(\\d+)" +         // @间距开头
    "(?:\\/(\\d+))?" +     // /非加密间距
    "(?:\\((\\d+)\\))?" +  // (肢数)
    ")?",
    "u"
  );

  const m = work.match(mainRe);
  if (m) {
    if (m[1]) result.count = parseInt(m[1], 10);
    if (!result.grade) result.grade = gradeFromSymbol(m[2]);
    result.diameter = parseInt(m[3], 10);

    if (m[4] && m[5]) {
      result.densifySpacing = parseInt(m[4], 10);
      result.spacing = parseInt(m[5], 10);
    } else if (m[4]) {
      result.spacing = parseInt(m[4], 10);
    }

    if (m[6]) result.legs = parseInt(m[6], 10);
    result.valid = true;
    return result;
  }

  // 3. 降级: 仅等级+直径 (无根数/间距) e.g. "Φ25" "C16"
  const simpleRe = /^([Φφϕ⑤C])\s*(\d+)/u;
  const sm = work.match(simpleRe);
  if (sm) {
    if (!result.grade) result.grade = gradeFromSymbol(sm[1]);
    result.diameter = parseInt(sm[2], 10);
    result.valid = true;
    return result;
  }

  // 4. 纯数字直径 (已知等级前缀 e.g. "HRB400-25@200")
  if (result.grade) {
    const dRe = /(\d+)(?:@(\d+)(?:\/(\d+))?(?:\((\d+)\))?)?/;
    const dm = work.match(dRe);
    if (dm) {
      result.diameter = parseInt(dm[1], 10);
      if (dm[2] && dm[3]) {
        result.densifySpacing = parseInt(dm[2], 10);
        result.spacing = parseInt(dm[3], 10);
      } else if (dm[2]) {
        result.spacing = parseInt(dm[2], 10);
      }
      if (dm[4]) result.legs = parseInt(dm[4], 10);
      result.valid = true;
    }
  }

  return result;
}

/** 将 ParsedNotation 转换为可读的平法标注文本摘要 */
export function notationSummary(p: ParsedNotation): string {
  if (!p.valid) return "—";
  const parts: string[] = [];
  if (p.count) parts.push(`${p.count}`);
  const sym = p.grade === "HPB300" ? "φ" : p.grade === "HRB500" ? "⑤Φ" : "Φ";
  if (p.diameter) parts.push(`${sym}${p.diameter}`);
  if (p.densifySpacing && p.spacing) parts.push(`@${p.densifySpacing}/${p.spacing}`);
  else if (p.spacing) parts.push(`@${p.spacing}`);
  if (p.legs) parts.push(`(${p.legs})`);
  return parts.join("") || "—";
}
