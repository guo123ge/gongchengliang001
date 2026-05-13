"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useStore } from "@/lib/store";
import type { Component } from "@/lib/types";
import { buildComponentObject } from "@/lib/three/geometry";
import { endpointsToScene } from "@/lib/dxf/parser";

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const tcompRef = useRef<TransformControls | null>(null);
  const tclipRef = useRef<TransformControls | null>(null);
  const clipMeshRef = useRef<THREE.Mesh | null>(null);

  const components = useStore((s) => s.components);
  const showConcrete = useStore((s) => s.showConcrete);
  const showRebar = useStore((s) => s.showRebar);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateComponent = useStore((s) => s.updateComponent);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const blueprint = useStore((s) => s.blueprint);
  const updateBlueprint = useStore((s) => s.updateBlueprint);
  const blueprintMeshRef = useRef<THREE.Mesh | null>(null);
  const tbpRef = useRef<TransformControls | null>(null);
  const snapPointsRef = useRef<{ x: number; z: number }[]>([]);
  const snapMarkerRef = useRef<THREE.Mesh | null>(null);
  const dimGroupRef = useRef<THREE.Group | null>(null);

  // 初始化
  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 30, 200);

    const w = mount.clientWidth, h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(10, 8, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    const grid = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(3));

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;

    const group = new THREE.Group();
    scene.add(group);

    const dimGroup = new THREE.Group();
    dimGroup.name = "dimensions";
    scene.add(dimGroup);
    dimGroupRef.current = dimGroup;

    // 构件 TransformControls
    const tcomp = new TransformControls(camera, renderer.domElement);
    tcomp.setMode("translate");
    tcomp.setTranslationSnap(50 / 1000); // 50mm 吸附
    tcomp.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        // 拖拽结束：写回 store
        const obj = tcomp.object as THREE.Object3D | undefined;
        if (obj && obj.userData.componentId) {
          updateComponent(obj.userData.componentId, {
            placement: {
              x: Math.round(obj.position.x * 1000),
              y: Math.round(obj.position.y * 1000),
              z: Math.round(obj.position.z * 1000),
              rot: (obj.rotation.y * 180) / Math.PI,
            },
          });
        }
        // 隐藏吸附标记
        if (snapMarkerRef.current) snapMarkerRef.current.visible = false;
      }
    });
    // 拖拽过程中吸附到最近端点
    tcomp.addEventListener("objectChange", () => {
      const obj = tcomp.object as THREE.Object3D | undefined;
      if (!obj || !(tcomp as any).dragging) return;
      const bp = useStore.getState().blueprint;
      if (!bp || !bp.snapEnabled || snapPointsRef.current.length === 0) return;
      const SNAP = 0.3; // 米
      let best: { x: number; z: number; d: number } | null = null;
      for (const p of snapPointsRef.current) {
        const dx = p.x - obj.position.x, dz = p.z - obj.position.z;
        const d = Math.hypot(dx, dz);
        if (d < SNAP && (!best || d < best.d)) best = { ...p, d };
      }
      const marker = snapMarkerRef.current;
      if (best) {
        obj.position.x = best.x;
        obj.position.z = best.z;
        if (marker) {
          marker.position.set(best.x, 0.05, best.z);
          marker.visible = true;
        }
      } else if (marker) {
        marker.visible = false;
      }
    });
    scene.add((tcomp as any).getHelper ? (tcomp as any).getHelper() : (tcomp as any));
    tcompRef.current = tcomp;

    // 剖切面可视化 + TransformControls
    const clipMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    clipMesh.userData.kind = "clip";
    clipMesh.visible = false;
    scene.add(clipMesh);
    clipMeshRef.current = clipMesh;

    const tclip = new TransformControls(camera, renderer.domElement);
    tclip.setMode("translate");
    tclip.setTranslationSnap(50 / 1000);
    tclip.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        const c = useStore.getState().clip;
        const pos =
          c.axis === "x" ? clipMesh.position.x :
          c.axis === "y" ? clipMesh.position.y :
          clipMesh.position.z;
        setClip({ position: Math.round(pos * 1000) });
      }
    });
    tclip.attach(clipMesh);
    (tclip as any).visible = false;
    tclip.enabled = false;
    scene.add((tclip as any).getHelper ? (tclip as any).getHelper() : (tclip as any));
    tclipRef.current = tclip;

    // 蓝图 TransformControls（仅在底图存在且未锁定时启用）
    const tbp = new TransformControls(camera, renderer.domElement);
    tbp.setMode("translate");
    tbp.setTranslationSnap(50 / 1000);
    tbp.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        const obj = tbp.object as THREE.Object3D | undefined;
        if (obj) {
          useStore.getState().updateBlueprint({
            offsetX: Math.round(obj.position.x * 1000),
            offsetZ: Math.round(obj.position.z * 1000),
            rotation: Math.round(((obj.rotation.z * 180) / Math.PI) * 10) / 10,
          });
        }
      }
    });
    (tbp as any).visible = false;
    tbp.enabled = false;
    scene.add((tbp as any).getHelper ? (tbp as any).getHelper() : (tbp as any));
    tbpRef.current = tbp;

    // 吸附标记（黄色十字小圆）
    const snapMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.1, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }),
    );
    snapMarker.rotation.x = -Math.PI / 2;
    snapMarker.visible = false;
    snapMarker.renderOrder = 999;
    scene.add(snapMarker);
    snapMarkerRef.current = snapMarker;

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    groupRef.current = group;
    orbitRef.current = orbit;

    const onResize = () => {
      const W = mount.clientWidth, H = mount.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // 点击拾取构件
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0, downY = 0;
    const onDown = (e: MouseEvent) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e: MouseEvent) => {
      // 拖动则不触发选择
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) return;
      // 当 TransformControls 正在交互时不处理
      if ((tcomp as any).dragging || (tclip as any).dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(group.children, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.componentId) obj = obj.parent;
        if (obj?.userData.componentId) select(obj.userData.componentId);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      orbit.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      try { tcomp.detach(); (tcomp as any).dispose?.(); } catch {}
      try { tclip.detach(); (tclip as any).dispose?.(); } catch {}
      try { tbp.detach(); (tbp as any).dispose?.(); } catch {}
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [select, updateComponent, setClip]);

  // 重建构件
  useEffect(() => {
    const group = groupRef.current;
    const tcomp = tcompRef.current;
    if (!group || !tcomp) return;
    // 拖拽时不重建（避免对象被替换）
    if ((tcomp as any).dragging) return;

    // 清空
    while (group.children.length) {
      const obj = group.children[0];
      group.remove(obj);
      obj.traverse((o: any) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
        else o.material?.dispose?.();
      });
    }
    let selectedObj: THREE.Object3D | null = null;
    for (const c of components) {
      const obj = buildComponentObject(c, { showConcrete, showRebar });
      if (c.id === selectedId) {
        selectedObj = obj;
        obj.traverse((o: any) => {
          if (o.isMesh && o.material) {
            o.material = o.material.clone();
            o.material.emissive = new THREE.Color(0x2563eb);
            o.material.emissiveIntensity = 0.4;
          }
        });
      }
      const clipPlanes = clip.enabled ? [getClipPlane(clip.axis, clip.position)] : [];
      obj.traverse((o: any) => {
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m: any) => (m.clippingPlanes = clipPlanes));
          else o.material.clippingPlanes = clipPlanes;
        }
      });
      group.add(obj);
    }

    // 附加变换控制器到选中构件
    if (selectedObj) {
      tcomp.attach(selectedObj);
      tcomp.setMode(gizmoMode);
      (tcomp as any).visible = true;
      tcomp.enabled = true;
    } else {
      tcomp.detach();
      (tcomp as any).visible = false;
      tcomp.enabled = false;
    }
  }, [components, showConcrete, showRebar, selectedId, clip, gizmoMode]);

  // 同步 DXF 蓝图底图（地面平面贴图） + 蓝图 TransformControls + 吸附端点
  useEffect(() => {
    const scene = sceneRef.current;
    const tbp = tbpRef.current;
    if (!scene || !tbp) return;

    // 清理旧的
    if (blueprintMeshRef.current) {
      tbp.detach();
      scene.remove(blueprintMeshRef.current);
      const m = blueprintMeshRef.current;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      blueprintMeshRef.current = null;
    }
    snapPointsRef.current = [];
    (tbp as any).visible = false;
    tbp.enabled = false;

    if (!blueprint || !blueprint.visible) return;

    const loader = new THREE.TextureLoader();
    loader.load(
      blueprint.imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const W = (blueprint.widthMm * blueprint.scale) / 1000;
        const H = (blueprint.heightMm * blueprint.scale) / 1000;
        const geo = new THREE.PlaneGeometry(W, H);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = (blueprint.rotation * Math.PI) / 180;
        mesh.position.set(blueprint.offsetX / 1000, 0.001, blueprint.offsetZ / 1000);
        mesh.userData.kind = "blueprint";
        mesh.renderOrder = -1;
        scene.add(mesh);
        blueprintMeshRef.current = mesh;

        // 蓝图 TransformControls
        if (!blueprint.locked) {
          tbp.attach(mesh);
          (tbp as any).visible = true;
          tbp.enabled = true;
        }
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error("蓝图贴图加载失败:", err);
      },
    );

    // 计算端点（场景坐标，米）
    if (blueprint.snapEnabled && blueprint.endpoints && blueprint.endpoints.length > 0) {
      snapPointsRef.current = endpointsToScene(blueprint.endpoints, blueprint.bbox, {
        offsetX: blueprint.offsetX,
        offsetZ: blueprint.offsetZ,
        rotation: blueprint.rotation,
        scale: blueprint.scale,
      });
    }
  }, [blueprint]);

  // 同步剖切面可视化与控制器
  useEffect(() => {
    const mesh = clipMeshRef.current;
    const tclip = tclipRef.current;
    if (!mesh || !tclip) return;
    if (!clip.enabled) {
      mesh.visible = false;
      (tclip as any).visible = false;
      tclip.enabled = false;
      return;
    }
    mesh.visible = true;
    (tclip as any).visible = true;
    tclip.enabled = true;
    const pos = clip.position / 1000;
    // 重置朝向
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, 0, 0);
    if (clip.axis === "x") {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.x = pos;
      tclip.showX = true; tclip.showY = false; tclip.showZ = false;
    } else if (clip.axis === "y") {
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = pos;
      tclip.showX = false; tclip.showY = true; tclip.showZ = false;
    } else {
      mesh.position.z = pos;
      tclip.showX = false; tclip.showY = false; tclip.showZ = true;
    }
  }, [clip]);

  // 同步尺寸标注
  const showDimensions = useStore((s) => s.showDimensions);
  useEffect(() => {
    const dimGroup = dimGroupRef.current;
    if (!dimGroup) return;
    while (dimGroup.children.length) {
      const child = dimGroup.children[0];
      dimGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        const mat = (child as any).material;
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    }
    if (!showDimensions || !selectedId) return;
    const c = components.find((x) => x.id === selectedId);
    if (!c) return;
    const dims = buildDimensionLabels(c);
    for (const d of dims) dimGroup.add(d);
  }, [components, selectedId, showDimensions]);

  // 蓝图首次导入后自动适配相机
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!blueprint || !blueprint.visible) {
      didFitRef.current = false;
      return;
    }
    if (didFitRef.current) return;
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;

    const box = new THREE.Box3();
    const W = (blueprint.widthMm * blueprint.scale) / 1000;
    const H = (blueprint.heightMm * blueprint.scale) / 1000;
    const cx = blueprint.offsetX / 1000;
    const cz = blueprint.offsetZ / 1000;
    box.expandByPoint(new THREE.Vector3(cx - W / 2, 0, cz - H / 2));
    box.expandByPoint(new THREE.Vector3(cx + W / 2, 0, cz + H / 2));

    for (const c of components) {
      const g = c.geometry;
      const p = c.placement;
      const px = (p.x || 0) / 1000;
      const py = (p.y || 0) / 1000;
      const pz = (p.z || 0) / 1000;
      let sx = 0, sy = 0, sz = 0;
      if (c.type === "BEAM") { sx = (g.b ?? 300) / 1000; sy = (g.h ?? 600) / 1000; sz = (g.L ?? 6000) / 1000; }
      else if (c.type === "COLUMN") { sx = (g.b ?? 500) / 1000; sy = (g.h ?? 500) / 1000; sz = (g.L ?? 3600) / 1000; }
      else if (c.type === "SLAB") { sx = (g.Lx ?? 6000) / 1000; sy = (g.t ?? 120) / 1000; sz = (g.Ly ?? 4000) / 1000; }
      else if (c.type === "PILE") { sx = (g.D ?? 800) / 1000; sy = (g.D ?? 800) / 1000; sz = (g.L ?? 12000) / 1000; }
      box.expandByPoint(new THREE.Vector3(px - sx / 2, py - sy / 2, pz - sz / 2));
      box.expandByPoint(new THREE.Vector3(px + sx / 2, py + sy / 2, pz + sz / 2));
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0.01) {
      const dist = maxDim * 1.2;
      orbit.target.copy(center);
      camera.position.set(center.x + dist, center.y + dist * 0.6, center.z + dist);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      orbit.update();
    }
    didFitRef.current = true;
  }, [blueprint, components]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

function getClipPlane(axis: "x" | "y" | "z", pos: number): THREE.Plane {
  const n = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  return new THREE.Plane(n, -pos / 1000);
}

function buildDimensionLabels(c: Component): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const g = c.geometry;
  const p = c.placement;
  const rebars = c.rebars;
  const cover = c.concrete.cover;

  const textSprite = (lines: string[], pos: THREE.Vector3, scale = 0.22) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = 28;
    const pad = 12;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const lineH = fontSize + 6;
    canvas.width = Math.ceil(maxW);
    canvas.height = Math.ceil(lineH * lines.length + pad * 2);
    // 半透明深蓝背景
    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    lines.forEach((line, i) => {
      ctx.fillText(line, pad, pad + lineH * (i + 1) - 4);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 1000;
    return sprite;
  };

  const line = (a: THREE.Vector3, b: THREE.Vector3, color = 0xfacc15) => {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 });
    const l = new THREE.Line(geo, mat);
    l.renderOrder = 999;
    return l;
  };

  const px = (p.x || 0) / 1000;
  const py = (p.y || 0) / 1000;
  const pz = (p.z || 0) / 1000;

  // 辅助：格式化纵筋 label
  const barLabel = (r: { label?: string; count?: number; diameter: number }) => {
    if (r.label) return r.label;
    const d = `Φ${r.diameter}`;
    return r.count && r.count > 1 ? `${r.count}${d}` : d;
  };
  // 辅助：格式化箍筋/分布筋 label
  const tieLabel = (r: { label?: string; diameter: number; spacing?: number; densifySpacing?: number; count?: number }) => {
    if (r.label) return r.label;
    const d = `Φ${r.diameter}`;
    const leg = r.count ? `(${r.count})` : "";
    if (r.densifySpacing && r.spacing) return `${d}@${r.densifySpacing}/${r.spacing}${leg}`;
    if (r.spacing) return `${d}@${r.spacing}${leg}`;
    return d;
  };
  // 辅助：收集某角色的钢筋，合并用 + 连接
  const collect = (...roles: string[]) => {
    const list = rebars.filter((r) => roles.includes(r.role));
    if (list.length === 0) return "";
    return list.map(barLabel).join("+");
  };
  const collectTie = (...roles: string[]) => {
    const list = rebars.filter((r) => roles.includes(r.role));
    if (list.length === 0) return "";
    return list.map(tieLabel).join("+");
  };

  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const top = collect("TOP");
    const bot = collect("BOTTOM");
    const side = collect("SIDE");
    const stir = collectTie("STIRRUP");
    const erect = collect("ERECTION");
    const lines: string[] = [`截面 ${g.b ?? 0}×${g.h ?? 0}  L=${g.L ?? 0}`];
    if (top) lines.push(`顶筋: ${top}`);
    if (bot) lines.push(`底筋: ${bot}`);
    if (side) lines.push(`腰筋: ${side}`);
    if (stir) lines.push(`箍筋: ${stir}`);
    if (erect) lines.push(`架立筋: ${erect}`);
    lines.push(`保护层: ${cover}mm`);
    out.push(textSprite(lines, new THREE.Vector3(px, py + h / 2 + 0.7, pz)));
    out.push(line(new THREE.Vector3(px - L / 2, py + h / 2 + 0.4, pz), new THREE.Vector3(px + L / 2, py + h / 2 + 0.4, pz), 0xfacc15));
  } else if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const main = collect("MAIN", "LONGITUDINAL");
    const stir = collectTie("STIRRUP");
    const stiff = collectTie("STIFFEN");
    const lines: string[] = [`截面 ${g.b ?? 0}×${g.h ?? 0}  L=${g.L ?? 0}`];
    if (main) lines.push(`纵筋: ${main}`);
    if (stir) lines.push(`箍筋: ${stir}`);
    if (stiff) lines.push(`加劲箍: ${stiff}`);
    lines.push(`保护层: ${cover}mm`);
    out.push(textSprite(lines, new THREE.Vector3(px, py + L / 2 + 0.5, pz)));
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const neg = collectTie("NEG");
    const dist = collectTie("DIST");
    const construct = collect("CONSTRUCT");
    const stool = collectTie("STOOL");
    const lines: string[] = [`板 ${g.Lx ?? 0}×${g.Ly ?? 0}  厚${g.t ?? 0}`];
    if (neg) lines.push(`负筋: ${neg}`);
    if (dist) lines.push(`分布筋: ${dist}`);
    if (construct) lines.push(`构造筋: ${construct}`);
    if (stool) lines.push(`马凳筋: ${stool}`);
    lines.push(`保护层: ${cover}mm`);
    out.push(textSprite(lines, new THREE.Vector3(px, py + t / 2 + 0.6, pz)));
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const main = collect("MAIN", "LONGITUDINAL");
    const spiral = collectTie("SPIRAL");
    const stiff = collectTie("STIFFEN");
    const sonic = collect("SONIC");
    const lines: string[] = [`桩 D${g.D ?? 0}  L=${g.L ?? 0}`];
    if (main) lines.push(`主筋: ${main}`);
    if (spiral) lines.push(`螺旋箍: ${spiral}`);
    if (stiff) lines.push(`加劲箍: ${stiff}`);
    if (sonic) lines.push(`声测管: ${sonic}`);
    lines.push(`保护层: ${cover}mm`);
    out.push(textSprite(lines, new THREE.Vector3(px + D / 2 + 0.4, py + L / 2, pz)));
  }

  return out;
}
