"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useStore } from "@/lib/store";
import { sceneCaptureRef } from "@/lib/sceneCapture";
import type { Component } from "@/lib/types";
import { buildComponentObject } from "@/lib/three/geometry";
import { buildInstancedScene, getComponentIdFromHit } from "@/lib/three/instanced";
import { endpointsToScene } from "@/lib/dxf/parser";
import { detectCollisions, collisionsToVisuals } from "@/lib/g101/collision";

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
  const showCollisions = useStore((s) => s.showCollisions);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateComponent = useStore((s) => s.updateComponent);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const cameraView = useStore((s) => s.cameraView);
  const setCameraView = useStore((s) => s.setCameraView);
  const blueprint = useStore((s) => s.blueprint);
  const updateBlueprint = useStore((s) => s.updateBlueprint);
  const blueprintMeshRef = useRef<THREE.Mesh | null>(null);
  const tbpRef = useRef<TransformControls | null>(null);
  const snapPointsRef = useRef<{ x: number; z: number }[]>([]);
  const snapMarkerRef = useRef<THREE.Mesh | null>(null);
  const dimGroupRef = useRef<THREE.Group | null>(null);
  const collisionGroupRef = useRef<THREE.Group | null>(null);

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

    const collisionGroup = new THREE.Group();
    collisionGroup.name = "collisions";
    scene.add(collisionGroup);
    collisionGroupRef.current = collisionGroup;

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
        // 先尝试 InstancedMesh 命中（instanceIndex → componentId）
        const first = hits[0];
        const obj = first.object;
        if (obj.userData.kind === "instanced-concrete" && obj.userData.componentIds) {
          const ids = obj.userData.componentIds as string[];
          const idx = first.instanceId;
          if (idx != null && ids[idx]) {
            select(ids[idx]);
            return;
          }
        }
        // 回退到传统 Object3D 遍历查找
        let target: THREE.Object3D | null = first.object;
        while (target && !target.userData.componentId) target = target.parent;
        if (target?.userData.componentId) select(target.userData.componentId);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // 注册截图函数
    sceneCaptureRef.current = (format) => {
      if (!rendererRef.current) return null;
      rendererRef.current.render(scene, camera);
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      return rendererRef.current.domElement.toDataURL(mime, 0.92);
    };

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

  // 重建构件（使用 InstancedMesh 提高性能）
  useEffect(() => {
    const group = groupRef.current;
    const tcomp = tcompRef.current;
    if (!group || !tcomp) return;
    // 拖拽时不重建
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

    // 选择策略：当构件数 < 20 时用传统方式（保留 TransformControls 精确拾取）
    // 当构件数 >= 20 时用 InstancedMesh（高性能，但 TransformControls 降级）
    const USE_INSTANCED = components.length >= 20;

    if (USE_INSTANCED) {
      // ═══ InstancedMesh 模式 ═══
      const { concreteInstances, rebarObjects } = buildInstancedScene(components, selectedId, {
        showConcrete,
        showRebar,
      });

      const clipPlanes = clip.enabled ? [getClipPlane(clip.axis, clip.position)] : [];

      for (const im of concreteInstances) {
        // 应用剖切面
        (im.material as THREE.MeshStandardMaterial).clippingPlanes = clipPlanes;
        group.add(im);
      }

      for (const ro of rebarObjects) {
        // 将钢筋放到正确位置
        ro.traverse((o: any) => {
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m: any) => (m.clippingPlanes = clipPlanes));
            else o.material.clippingPlanes = clipPlanes;
          }
        });
        group.add(ro);
      }

      // InstancedMesh 模式下 TransformControls 仅能控制整组，不精确附加到单体
      tcomp.detach();
      (tcomp as any).visible = false;
      tcomp.enabled = false;
    } else {
      // ═══ 传统模式（<20 构件，保留 TransformControls） ═══
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
    }

    // ═══ 碰撞区域可视化（22G101）═══
    const collisionGroup = collisionGroupRef.current;
    if (collisionGroup) {
      // 清空旧的碰撞标记
      while (collisionGroup.children.length) {
        const obj = collisionGroup.children[0];
        collisionGroup.remove(obj);
        obj.traverse((o: any) => {
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
          else o.material?.dispose?.();
        });
      }

      if (showCollisions && components.length >= 2) {
        const collisions = detectCollisions(components);
        const visuals = collisionsToVisuals(collisions);
        for (const v of visuals) {
          const geo = new THREE.BoxGeometry(v.size[0], v.size[1], v.size[2]);
          const mat = new THREE.MeshBasicMaterial({
            color: v.color,
            transparent: true,
            opacity: v.opacity,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(v.center[0], v.center[1], v.center[2]);
          mesh.userData = { kind: "collision", label: v.label };
          collisionGroup.add(mesh);

          // 添加边框线
          const edges = new THREE.EdgesGeometry(geo);
          const lineMat = new THREE.LineBasicMaterial({ color: v.color, transparent: true, opacity: 0.7 });
          const line = new THREE.LineSegments(edges, lineMat);
          line.position.copy(mesh.position);
          collisionGroup.add(line);
        }
      }
    }
  }, [components, showConcrete, showRebar, selectedId, clip, gizmoMode, showCollisions]);

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

    // eslint-disable-next-line no-console
    console.log("开始加载蓝图:", { widthMm: blueprint.widthMm, heightMm: blueprint.heightMm, scale: blueprint.scale });

    const loader = new THREE.TextureLoader();
    loader.load(
      blueprint.imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const W = (blueprint.widthMm * blueprint.scale) / 1000;
        const H = (blueprint.heightMm * blueprint.scale) / 1000;
        // eslint-disable-next-line no-console
        console.log("蓝图尺寸 (米):", { W, H });
        const geo = new THREE.PlaneGeometry(W, H);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = (blueprint.rotation * Math.PI) / 180;
        mesh.position.set(blueprint.offsetX / 1000, 0.005, blueprint.offsetZ / 1000);
        mesh.userData.kind = "blueprint";
        mesh.renderOrder = 1;
        scene.add(mesh);
        blueprintMeshRef.current = mesh;
        // eslint-disable-next-line no-console
        console.log("蓝图 mesh 已添加到场景");

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
    // 清除旧标注
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

  // 相机视角切换
  useEffect(() => {
    if (!cameraRef.current || !orbitRef.current || !cameraView) return;
    const cam = cameraRef.current;
    const orbit = orbitRef.current;

    if (cameraView === "tour") {
      orbit.autoRotate = true;
      orbit.autoRotateSpeed = 2.0;
      setCameraView(null);
      return;
    }

    orbit.autoRotate = false;

    const views: Record<string, [number, number, number]> = {
      front: [0, 0, 20],
      top: [0, 20, 0.001],
      side: [-20, 0, 0],
      nw: [-10, 10, -10],
      sw: [-10, 10, 10],
      ne: [10, 10, -10],
      se: [10, 10, 10],
    };

    const pos = views[cameraView];
    if (pos) {
      cam.position.set(pos[0], pos[1], pos[2]);
      orbit.target.set(0, 0, 0);
      orbit.update();
    }
    setCameraView(null);
  }, [cameraView, setCameraView]);

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

  const textSprite = (text: string, pos: THREE.Vector3, scale = 0.25) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = 40;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    const w = ctx.measureText(text).width + 20;
    canvas.width = w;
    canvas.height = fontSize + 20;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(text, 10, fontSize + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set((w / (fontSize + 20)) * scale, scale, 1);
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

  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const offset = 0.6;
    out.push(textSprite(`${(g.b ?? 0)}×${(g.h ?? 0)}×${(g.L ?? 0)}`, new THREE.Vector3(px, py + h / 2 + offset, pz)));
    out.push(line(new THREE.Vector3(px - L / 2, py + h / 2 + offset * 0.6, pz), new THREE.Vector3(px + L / 2, py + h / 2 + offset * 0.6, pz), 0xfacc15));
  } else if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const offset = 0.5;
    out.push(textSprite(`${(g.b ?? 0)}×${(g.h ?? 0)}×${(g.L ?? 0)}`, new THREE.Vector3(px + b / 2 + offset, py + L / 2, pz)));
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const offset = 0.5;
    out.push(textSprite(`${(g.Lx ?? 0)}×${(g.Ly ?? 0)}×${(g.t ?? 0)}`, new THREE.Vector3(px, py + t / 2 + offset, pz)));
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const offset = 0.5;
    out.push(textSprite(`D${(g.D ?? 0)}×${(g.L ?? 0)}`, new THREE.Vector3(px + D / 2 + offset, py + L / 2, pz)));
  }

  return out;
}
