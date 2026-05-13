import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIM.Core Reinforced - 钢筋混凝土工程量计算",
  description: "基于 22G101 平法的工程量统计与 3D 可视化",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body-md text-on-background bg-background">{children}</body>
    </html>
  );
}
