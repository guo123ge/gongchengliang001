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

  const [leftWidth, setLeftWidth] = useState(288);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(250);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(true);

  const prevLeft = useRef(288);
  const prevRight = useRef(320);
  const prevBottom = useRef(250);

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
      const w = Math.max(260, Math.min(400, startW + (ev.clientX - startX)));
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
      const w = Math.max(280, Math.min(480, startW - (ev.clientX - startX)));
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
      const h = Math.max(180, Math.min(450, startH - (ev.clientY - startY)));
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-on-background">
      {/* ─── TopNavBar ─── */}
      <TopBar />

      {/* ─── Main Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div
          className="shrink-0 flex border-r border-outline-variant/20"
          style={{ width: leftCollapsed ? 40 : leftWidth }}
        >
          <div className="flex-1 overflow-hidden bg-surface-container-low">
            <LeftTree collapsed={leftCollapsed} onToggle={toggleLeft} />
          </div>
          {!leftCollapsed && (
            <div
              className="w-1 shrink-0 cursor-col-resize bg-outline-variant/30 hover:bg-primary transition-colors"
              onMouseDown={startResizeLeft}
              title="拖拽调整宽度"
            />
          )}
        </div>

        {/* Center Column (Viewport & Data) */}
        <div className="flex-1 relative min-w-0 flex flex-col bg-surface">
          {/* 3D Viewport */}
          <div className="flex-1 relative overflow-hidden">
            <Scene3D />
            <SceneToolbar />
            <LegendOverlay />

            {/* Breadcrumb / Context overlay */}
            <div className="absolute top-4 left-4 glass-panel rounded-lg px-4 py-2 z-10 flex items-center gap-2 font-label-code text-label-code">
              <span className="text-on-surface-variant">标高 2</span>
              <span className="text-outline-variant">/</span>
              <span className="text-primary">梁柱节点 J-42</span>
            </div>
          </div>

          {/* Bottom Data Panel */}
          {!bottomCollapsed && (
            <div
              className="shrink-0 border-t border-outline-variant/20 bg-surface-container-low flex flex-col"
              style={{ height: bottomHeight }}
            >
              <div
                className="h-1 w-full cursor-row-resize bg-outline-variant/30 hover:bg-primary transition-colors"
                onMouseDown={startResizeBottom}
                title="拖拽调整高度"
              />
              <div className="flex-1 overflow-hidden">
                <BottomBar collapsed={false} onToggle={toggleBottom} />
              </div>
            </div>
          )}
          {bottomCollapsed && (
            <div className="shrink-0 h-7 bg-surface-container-low border-t border-outline-variant/20 flex items-center px-2">
              <button
                onClick={toggleBottom}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                ▲ 展开面板
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div
          className="shrink-0 flex border-l border-outline-variant/20"
          style={{ width: rightCollapsed ? 40 : rightWidth }}
        >
          {!rightCollapsed && (
            <div
              className="w-1 shrink-0 cursor-col-resize bg-outline-variant/30 hover:bg-primary transition-colors"
              onMouseDown={startResizeRight}
              title="拖拽调整宽度"
            />
          )}
          <div className="flex-1 overflow-hidden bg-surface-container-low">
            <RightPanel collapsed={rightCollapsed} onToggle={toggleRight} />
          </div>
        </div>
      </div>
    </div>
  );
}
