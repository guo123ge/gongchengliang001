"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import TopBar from "@/components/TopBar";
import LeftTree from "@/components/LeftTree";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import SceneToolbar from "@/components/SceneToolbar";
import LegendOverlay from "@/components/LegendOverlay";
import { useStore } from "@/lib/store";

const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

export default function Home() {
  const addComponent = useStore((s) => s.addComponent);
  const components = useStore((s) => s.components);

  // 首次进入，自动示例：一梁一柱
  useEffect(() => {
    if (components.length === 0) {
      addComponent("COLUMN");
      addComponent("BEAM");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col">
      <TopBar />
      <main className="flex-1 flex overflow-hidden">
        <LeftTree />
        <div className="flex-1 relative">
          <Scene3D />
          <SceneToolbar />
          <LegendOverlay />
        </div>
        <RightPanel />
      </main>
      <BottomBar />
    </div>
  );
}
