import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "钢筋混凝土工程量计算 | Rebar Quant",
  description: "基于 22G101 平法的工程量统计与 3D 可视化",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
