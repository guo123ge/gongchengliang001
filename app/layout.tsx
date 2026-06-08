import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "钢筋混凝土工程量计算平台",
  description: "基于 22G101 平法的工程量统计与 3D 可视化",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`dark ${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="font-body-md text-on-background bg-background">{children}</body>
    </html>
  );
}
