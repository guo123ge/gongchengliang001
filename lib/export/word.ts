import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType,
} from "docx";
import type { QuantityResult, ValidationItem } from "../types";
import { aggregate } from "../quantity/calc";

function row(cells: string[], bold = false) {
  return new TableRow({
    children: cells.map(
      (t) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: t, bold })] })],
          width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        }),
    ),
  });
}

export async function exportWord(
  projectName: string,
  results: QuantityResult[],
  validations: ValidationItem[],
): Promise<Blob> {
  const agg = aggregate(results);
  const children: (Paragraph | Table)[] = [];
  children.push(new Paragraph({ text: projectName + " — 工程量计算书", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({ text: `生成时间：${new Date().toLocaleString("zh-CN")}`, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({ text: "一、总量汇总", heading: HeadingLevel.HEADING_1 }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(["项目", "数值", "单位"], true),
        row(["混凝土总量", agg.volume.toFixed(3), "m³"]),
        row(["模板总面积", agg.formwork.toFixed(2), "m²"]),
        row(["钢筋总重", agg.rebarTotal.toFixed(2), "kg"]),
      ],
    }),
  );

  children.push(new Paragraph({ text: "二、构件明细", heading: HeadingLevel.HEADING_1 }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(["名称", "类型", "混凝土(m³)", "模板(m²)", "钢筋(kg)"], true),
        ...results.map((r) => row([r.name, r.type, r.concreteVolume.toFixed(3), r.formworkArea.toFixed(2), r.totalRebarWeight.toFixed(2)])),
      ],
    }),
  );

  children.push(new Paragraph({ text: "三、钢筋规格汇总", heading: HeadingLevel.HEADING_1 }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row(["等级-直径", "总长(m)", "重量(kg)"], true),
        ...Object.entries(agg.rebar).map(([k, v]) => row([k, v.length.toFixed(2), v.weight.toFixed(2)])),
      ],
    }),
  );

  children.push(new Paragraph({ text: "四、22G101 平法校验结论", heading: HeadingLevel.HEADING_1 }));
  if (validations.length === 0) {
    children.push(new Paragraph({ text: "无校验项。" }));
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          row(["构件", "规则", "级别", "说明"], true),
          ...validations.map((v) => row([v.componentId, v.rule, v.severity, v.message])),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return blob;
}
