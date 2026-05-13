"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (components.length === 0) {
      addComponent("COLUMN");
      addComponent("BEAM");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(420);
  const [bottomHeight, setBottomHeight] = useState(160);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(true);

  const prevLeft = useRef(256);
  const prevRight = useRef(420);
  const prevBottom = useRef(160);

  const toggleLeft = () => {
    if (leftCollapsed) {
      setLeftCollapsed(false);
      setLeftWidth(prevLeft.current);
    } else {
      prevLeft.current = leftWidth;
      setLeftCollapsed(true);
    }
  };

  const toggleRight = () => {
    if (rightCollapsed) {
      setRightCollapsed(false);
      setRightWidth(prevRight.current);
    } else {
      prevRight.current = rightWidth;
      setRightCollapsed(true);
    }
  };

  const toggleBottom = () => {
    if (bottomCollapsed) {
      setBottomCollapsed(false);
      setBottomHeight(prevBottom.current);
    } else {
      prevBottom.current = bottomHeight;
      setBottomCollapsed(true);
    }
  };

  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    if (leftCollapsed) return;
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(180, Math.min(400, startW + (ev.clientX - startX)));
      setLeftWidth(w);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    if (rightCollapsed) return;
    const startX = e.clientX;
    const startW = rightWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(320, Math.min(600, startW - (ev.clientX - startX)));
      setRightWidth(w);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResizeBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    if (bottomCollapsed) return;
    const startY = e.clientY;
    const startH = bottomHeight;
    const onMove = (ev: MouseEvent) => {
      const h = Math.max(80, Math.min(400, startH - (ev.clientY - startY)));
      setBottomHeight(h);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="shrink-0 flex" style={{ width: leftCollapsed ? 36 : leftWidth }}>
          <div className="flex-1 overflow-hidden">
            <LeftTree collapsed={leftCollapsed} onToggle={toggleLeft} />
          </div>
          {!leftCollapsed && (
            <div
              className="w-1 shrink-0 cursor-col-resize bg-eng-border hover:bg-eng-accent transition-colors"
              onMouseDown={startResizeLeft}
              title="拖拽调整宽度"
            />
          )}
        </div>

        {/* Center 3D scene */}
        <div className="flex-1 relative min-w-0">
          <Scene3D />
          <SceneToolbar />
          <LegendOverlay />
        </div>

        {/* Right panel */}
        <div className="shrink-0 flex" style={{ width: rightCollapsed ? 36 : rightWidth }}>
          {!rightCollapsed && (
            <div
              className="w-1 shrink-0 cursor-col-resize bg-eng-border hover:bg-eng-accent transition-colors"
              onMouseDown={startResizeRight}
              title="拖拽调整宽度"
            />
          )}
          <div className="flex-1 overflow-hidden">
            <RightPanel collapsed={rightCollapsed} onToggle={toggleRight} />
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 flex flex-col" style={{ height: bottomCollapsed ? 28 : bottomHeight }}>
        {!bottomCollapsed && (
          <div
            className="h-1 w-full cursor-row-resize bg-eng-border hover:bg-eng-accent transition-colors"
            onMouseDown={startResizeBottom}
            title="拖拽调整高度"
          />
        )}
        <div className="flex-1 overflow-hidden">
          <BottomBar collapsed={bottomCollapsed} onToggle={toggleBottom} />
        </div>
      </div>
    </div>
  );
}
