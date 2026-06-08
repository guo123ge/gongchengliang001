import ExcelJS from "exceljs";
import type { Component, ComponentType, QuantityResult } from "../types";
import { aggregate } from "../quantity/calc";

const TYPE_LABELS: Record<ComponentType, string> = {
  BEAM: "框架梁",
  COLUMN: "框架柱",
  SHEAR_WALL: "剪力墙",
  SLAB: "楼板",
  STAIR: "AT型楼梯",
  FOUND: "独立基础",
  STRIP_FOUND: "条形基础",
  PILE_CAP: "桩基承台",
  PILE: "灌注桩",
  RAFT: "筏板基础",
};

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
}

export async function exportExcel(components: Component[], results: QuantityResult[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "钢筋混凝土工程量计算平台";
  wb.created = new Date();

  const summary = wb.addWorksheet("总量汇总");
  summary.columns = [
    { header: "项目", key: "k", width: 24 },
    { header: "数值", key: "v", width: 16 },
    { header: "单位", key: "u", width: 10 },
  ];
  const agg = aggregate(results);
  summary.addRows([
    { k: "构件数量", v: components.length.toString(), u: "个" },
    { k: "混凝土总量", v: agg.volume.toFixed(3), u: "m³" },
    { k: "模板总面积", v: agg.formwork.toFixed(2), u: "m²" },
    { k: "钢筋总重", v: agg.rebarTotal.toFixed(2), u: "kg" },
  ]);
  summary.addRow([]);
  summary.addRow(["按规格钢筋汇总"]);
  summary.addRow(["等级-直径", "总长(m)", "重量(kg)"]);
  for (const [k, v] of Object.entries(agg.rebar)) {
    summary.addRow([k, v.length.toFixed(2), v.weight.toFixed(2)]);
  }

  const detail = wb.addWorksheet("构件明细");
  detail.columns = [
    { header: "名称", key: "name", width: 18 },
    { header: "类型", key: "type", width: 14 },
    { header: "混凝土(m³)", key: "v", width: 14 },
    { header: "模板(m²)", key: "f", width: 14 },
    { header: "钢筋(kg)", key: "r", width: 14 },
  ];
  for (const r of results) {
    detail.addRow({
      name: r.name,
      type: TYPE_LABELS[r.type] ?? r.type,
      v: r.concreteVolume.toFixed(3),
      f: r.formworkArea.toFixed(2),
      r: r.totalRebarWeight.toFixed(2),
    });
  }

  const notes = wb.addWorksheet("计算说明");
  notes.columns = [
    { header: "构件", key: "component", width: 18 },
    { header: "说明", key: "note", width: 80 },
  ];
  for (const r of results) {
    for (const note of r.notes ?? []) {
      notes.addRow({ component: r.name, note });
    }
  }
  if (notes.rowCount === 1) notes.addRow({ component: "-", note: "暂无专项计算说明。" });

  const rebarSheet = wb.addWorksheet("钢筋下料汇总");
  rebarSheet.columns = [
    { header: "构件", key: "c", width: 18 },
    { header: "等级", key: "g", width: 10 },
    { header: "直径(mm)", key: "d", width: 10 },
    { header: "总长(m)", key: "l", width: 12 },
    { header: "重量(kg)", key: "w", width: 12 },
  ];
  for (const r of results) {
    for (const [k, v] of Object.entries(r.rebarByDia)) {
      const [grade, dia] = k.split("-");
      rebarSheet.addRow({ c: r.name, g: grade, d: dia, l: v.length.toFixed(2), w: v.weight.toFixed(2) });
    }
  }

  [summary, detail, notes, rebarSheet].forEach(styleHeader);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
