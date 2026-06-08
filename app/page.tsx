"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import LeftTree from "@/components/LeftTree";
import RightPanel from "@/components/RightPanel";
import BottomBar from "@/components/BottomBar";
import SceneToolbar from "@/components/SceneToolbar";
import LegendOverlay from "@/components/LegendOverlay";
import WelcomeEmpty from "@/components/WelcomeEmpty";
import LandingOverlay from "@/components/LandingOverlay";
import RebarInfoPopup from "@/components/RebarInfoPopup";
import { useStore } from "@/lib/store";
import LoginGate from "@/components/LoginGate";

const Scene3D = dynamic(() => import("@/components/Scene3D"), { ssr: false });

const STORAGE_KEY = "bimcore_landing_seen";

export default function Home() {
  const components = useStore((s) => s.components);
  const leftPanelOpen = useStore((s) => s.leftPanelOpen);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  const toggleLeftPanel = useStore((s) => s.toggleLeftPanel);
  const toggleBottomPanel = useStore((s) => s.toggleBottomPanel);
  const landingOpen = useStore((s) => s.landingOpen);
  const setLandingOpen = useStore((s) => s.setLandingOpen);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setLandingOpen(true);
      }
    } catch {}
  }, [setLandingOpen]);

  const [leftWidth, setLeftWidth] = useState(288);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(250);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewportRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const prevLeft = useRef(288);
  const prevRight = useRef(320);
  const prevBottom = useRef(250);

  const toggleLeft = () => {
    if (!leftPanelOpen) {
      setLeftWidth(prevLeft.current);
    } else {
      prevLeft.current = leftWidth;
    }
    toggleLeftPanel();
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
    if (!bottomPanelOpen) {
      setBottomHeight(prevBottom.current);
    } else {
      prevBottom.current = bottomHeight;
    }
    toggleBottomPanel();
  };

  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!leftPanelOpen) return;
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
    if (!bottomPanelOpen) return;
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
    <LoginGate>
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-on-background">
      <LandingOverlay open={landingOpen} onClose={() => setLandingOpen(false)} />
      {/* ─── TopNavBar ─── */}
      <TopBar />

      {/* ─── Main Workspace ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div
          className="shrink-0 flex border-r border-outline-variant/20"
          style={{ width: leftPanelOpen ? leftWidth : 40 }}
        >
          <div className="flex-1 overflow-hidden bg-surface-container-low">
            <LeftTree collapsed={!leftPanelOpen} onToggle={toggleLeft} />
          </div>
          {leftPanelOpen && (
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
          <div ref={viewportRef} className="flex-1 relative overflow-hidden">
            {components.length === 0 ? (
              <WelcomeEmpty />
            ) : (
              <>
                <Scene3D />
                <SceneToolbar />
                <LegendOverlay />
                <RebarInfoPopup />
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-2 right-2 z-30 p-1.5 rounded bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors"
                  title={isFullscreen ? "退出全屏" : "全屏显示"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>

          {/* Bottom Data Panel */}
          {bottomPanelOpen && (
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
          {!bottomPanelOpen && (
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
    </LoginGate>
  );
}
