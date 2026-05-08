import ExcelJS from "exceljs";
import type { Component, QuantityResult } from "../types";
import { aggregate } from "../quantity/calc";

export async function exportExcel(components: Component[], results: QuantityResult[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rebar Quant";
  wb.created = new Date();

  // 汇总
  const sum = wb.addWorksheet("汇总");
  sum.columns = [
    { header: "项目", key: "k", width: 24 },
    { header: "数值", key: "v", width: 16 },
    { header: "单位", key: "u", width: 10 },
  ];
  const agg = aggregate(results);
  sum.addRows([
    { k: "混凝土总量", v: agg.volume.toFixed(3), u: "m³" },
    { k: "模板总面积", v: agg.formwork.toFixed(2), u: "m²" },
    { k: "钢筋总重", v: agg.rebarTotal.toFixed(2), u: "kg" },
  ]);
  sum.addRow([]);
  sum.addRow(["按规格钢筋汇总"]);
  sum.addRow(["等级-直径", "总长(m)", "重量(kg)"]);
  for (const [k, v] of Object.entries(agg.rebar)) {
    sum.addRow([k, v.length.toFixed(2), v.weight.toFixed(2)]);
  }

  // 构件明细
  const detail = wb.addWorksheet("构件明细");
  detail.columns = [
    { header: "名称", key: "name", width: 14 },
    { header: "类型", key: "type", width: 10 },
    { header: "混凝土(m³)", key: "v", width: 14 },
    { header: "模板(m²)", key: "f", width: 14 },
    { header: "钢筋(kg)", key: "r", width: 14 },
  ];
  for (const r of results) {
    detail.addRow({
      name: r.name,
      type: r.type,
      v: r.concreteVolume.toFixed(3),
      f: r.formworkArea.toFixed(2),
      r: r.totalRebarWeight.toFixed(2),
    });
  }

  // 钢筋下料单
  const sheet = wb.addWorksheet("钢筋下料单");
  sheet.columns = [
    { header: "构件", key: "c", width: 14 },
    { header: "等级", key: "g", width: 10 },
    { header: "直径(mm)", key: "d", width: 10 },
    { header: "总长(m)", key: "l", width: 12 },
    { header: "重量(kg)", key: "w", width: 12 },
  ];
  for (const r of results) {
    for (const [k, v] of Object.entries(r.rebarByDia)) {
      const [grade, dia] = k.split("-");
      sheet.addRow({ c: r.name, g: grade, d: dia, l: v.length.toFixed(2), w: v.weight.toFixed(2) });
    }
  }

  [sum, detail, sheet].forEach((ws) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
