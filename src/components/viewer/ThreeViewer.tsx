"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  loadSTLModel,
  load3MFModel,
  ModelStats,
  Loaded3DModel,
} from "./loaders";
import { ViewerControls, ShadingMode } from "./ViewerControls";

interface ThreeViewerProps {
  fileUrl?: string;
  fileBuffer?: ArrayBuffer;
  format: "stl" | "3mf";
  title?: string;
  onStatsLoaded?: (stats: ModelStats) => void;
  className?: string;
}

export function ThreeViewer({
  fileUrl,
  fileBuffer,
  format,
  title,
  onStatsLoaded,
  className = "",
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentModelRef = useRef<THREE.Group | null>(null);
  const edgesGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const modelRadiusRef = useRef<number>(50);
  const modelColorRef = useRef<string>("#38bdf8");
  const shadingModeRef = useRef<ShadingMode>("shaded");

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Initializing 3D viewport...");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [shadingMode, setShadingMode] = useState<ShadingMode>("shaded");
  const [modelColor, setModelColor] = useState<string>("#38bdf8");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Initialize Scene, Camera, Renderer, Controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep CAD slate navy
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(100, 100, 100);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 3000;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // 5. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(150, 250, 150);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 1.0);
    dirLight2.position.set(-150, 150, -150);
    scene.add(dirLight2);

    const groundLight = new THREE.DirectionalLight(0x334155, 0.6);
    groundLight.position.set(0, -100, 0);
    scene.add(groundLight);

    // 6. Grid Helper
    const gridHelper = new THREE.GridHelper(300, 30, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 7. Ground Shadow Plane
    const shadowPlaneGeom = new THREE.PlaneGeometry(1000, 1000);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 8. Edges Group
    const edgesGroup = new THREE.Group();
    scene.add(edgesGroup);
    edgesGroupRef.current = edgesGroup;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Frame Camera nicely around model
  const frameCameraToModel = useCallback((radius: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const dist = Math.max(radius * 2.5, 20);
    const targetY = radius * 0.5;

    camera.position.set(dist * 0.8, dist * 0.7, dist * 0.8);
    controls.target.set(0, targetY, 0);
    camera.lookAt(0, targetY, 0);
    controls.update();
  }, []);

  // Set Camera View Angles
  const handleSetCameraView = useCallback(
    (view: "iso" | "top" | "front" | "right") => {
      if (!cameraRef.current || !controlsRef.current) return;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const radius = modelRadiusRef.current;
      const dist = Math.max(radius * 2.5, 20);
      const targetY = radius * 0.5;

      controls.target.set(0, targetY, 0);

      switch (view) {
        case "iso":
          camera.position.set(dist * 0.8, dist * 0.7, dist * 0.8);
          break;
        case "top":
          camera.position.set(0, dist * 1.5, 0.001);
          break;
        case "front":
          camera.position.set(0, targetY, dist * 1.3);
          break;
        case "right":
          camera.position.set(dist * 1.3, targetY, 0);
          break;
      }
      camera.lookAt(0, targetY, 0);
      controls.update();
    },
    []
  );

  // Load Model Buffer
  const processBuffer = useCallback(
    (buffer: ArrayBuffer) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;

      try {
        // Remove previous model
        if (currentModelRef.current) {
          scene.remove(currentModelRef.current);
          currentModelRef.current = null;
        }
        if (edgesGroupRef.current) {
          edgesGroupRef.current.clear();
        }

        let loaded: Loaded3DModel;
        if (format === "3mf") {
          loaded = load3MFModel(buffer);
        } else {
          loaded = loadSTLModel(buffer, new THREE.Color(modelColorRef.current).getHex());
        }

        const model = loaded.root;
        scene.add(model);
        currentModelRef.current = model;
        setStats(loaded.stats);
        if (onStatsLoaded) {
          onStatsLoaded(loaded.stats);
        }

        // Lazily build edge highlights only if user is already in "edges" mode
        if (edgesGroupRef.current && shadingModeRef.current === "edges") {
          model.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
              const edgesGeom = new THREE.EdgesGeometry(child.geometry, 28);
              const edgesMat = new THREE.LineBasicMaterial({
                color: 0x0f172a,
                linewidth: 1,
              });
              const line = new THREE.LineSegments(edgesGeom, edgesMat);
              line.position.copy(child.position);
              line.rotation.copy(child.rotation);
              line.scale.copy(child.scale);
              edgesGroupRef.current?.add(line);
            }
          });
          edgesGroupRef.current.visible = true;
        }

        // Adjust grid floor sizing to match model
        const maxDim = Math.max(
          loaded.stats.bbox.width,
          loaded.stats.bbox.depth,
          loaded.stats.bbox.height
        );
        const radius = Math.max(maxDim, 20);
        modelRadiusRef.current = radius;

        if (gridHelperRef.current) {
          const gridSize = Math.max(Math.ceil(radius * 3 / 50) * 50, 100);
          scene.remove(gridHelperRef.current);
          const newGrid = new THREE.GridHelper(
            gridSize,
            Math.max(10, Math.floor(gridSize / 10)),
            0x38bdf8,
            0x1e293b
          );
          newGrid.position.y = 0;
          newGrid.visible = true;
          scene.add(newGrid);
          gridHelperRef.current = newGrid;
        }

        frameCameraToModel(radius);
        setLoading(false);
      } catch (err: unknown) {
        console.error("Error parsing 3D model:", err);
        setError(err instanceof Error ? err.message : "Failed to parse 3D model");
        setLoading(false);
      }
    },
    [format, onStatsLoaded, frameCameraToModel]
  );

  // Fetch or Load from Buffer
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (fileBuffer) {
      setLoadingMessage(`Parsing ${format.toUpperCase()} geometry & materials...`);
      const timer = setTimeout(() => {
        processBuffer(fileBuffer);
      }, 30);
      return () => clearTimeout(timer);
    }

    if (fileUrl) {
      setLoadingMessage("Downloading 3D asset from server...");
      let active = true;

      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) {
            if (res.status === 403) {
              throw new Error("Private model: Access denied");
            }
            throw new Error(`HTTP ${res.status}: Failed to download model`);
          }
          if (active) {
            setLoadingMessage(`Parsing ${format.toUpperCase()} geometry & materials...`);
          }
          return res.arrayBuffer();
        })
        .then((buf) => {
          if (active) {
            setTimeout(() => {
              if (active) processBuffer(buf);
            }, 30);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            console.error("Failed to load file:", err);
            setError(err instanceof Error ? err.message : "Network error");
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }

    setLoading(false);
  }, [fileUrl, fileBuffer, format, processBuffer]);

  // Handle Shading Mode Change
  const handleChangeShadingMode = (mode: ShadingMode) => {
    setShadingMode(mode);
    shadingModeRef.current = mode;
    if (!currentModelRef.current) return;

    if (edgesGroupRef.current) {
      // Lazily build edges geometry on demand if switching to 'edges'
      if (mode === "edges" && edgesGroupRef.current.children.length === 0) {
        currentModelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            const edgesGeom = new THREE.EdgesGeometry(child.geometry, 28);
            const edgesMat = new THREE.LineBasicMaterial({
              color: 0x0f172a,
              linewidth: 1,
            });
            const line = new THREE.LineSegments(edgesGeom, edgesMat);
            line.position.copy(child.position);
            line.rotation.copy(child.rotation);
            line.scale.copy(child.scale);
            edgesGroupRef.current?.add(line);
          }
        });
      }
      edgesGroupRef.current.visible = mode === "edges";
    }

    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (mode === "wireframe") {
            mat.wireframe = true;
            mat.transparent = false;
            mat.opacity = 1.0;
          } else if (mode === "transparent") {
            mat.wireframe = false;
            mat.transparent = true;
            mat.opacity = 0.45;
          } else {
            mat.wireframe = false;
            mat.transparent = false;
            mat.opacity = 1.0;
          }
        }
      }
    });
  };

  // Handle Custom Model Color Change
  const handleChangeModelColor = (hex: string) => {
    setModelColor(hex);
    modelColorRef.current = hex;
    if (!currentModelRef.current) return;

    // If format is STL or user overrides single color
    currentModelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if ("color" in mat && mat.color instanceof THREE.Color) {
            mat.color.set(hex);
          }
        }
      }
    });
  };

  // Toggle Grid
  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = next;
    }
  };

  // Toggle Auto Rotate
  const handleToggleAutoRotate = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    if (controlsRef.current) {
      controlsRef.current.autoRotate = next;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  };

  // Take High-Res Screenshot
  const handleTakeScreenshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL("image/png");

    const a = document.createElement("a");
    a.download = `${title || "model"}-screenshot.png`;
    a.href = dataUrl;
    a.click();
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 ${className}`}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-white">
          <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-mono text-sm tracking-wide text-neutral-300">
            {loadingMessage}
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 text-red-400 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
            ⚠️
          </div>
          <h3 className="font-bold text-lg text-white mb-1">Failed to render model</h3>
          <p className="text-sm font-mono text-neutral-400 max-w-md">{error}</p>
        </div>
      )}

      {/* Controls Overlay */}
      {!loading && !error && (
        <ViewerControls
          stats={stats}
          format={format}
          title={title}
          onResetCamera={() => frameCameraToModel(modelRadiusRef.current)}
          onSetCameraView={handleSetCameraView}
          shadingMode={shadingMode}
          onChangeShadingMode={handleChangeShadingMode}
          modelColor={modelColor}
          onChangeModelColor={handleChangeModelColor}
          showGrid={showGrid}
          onToggleGrid={handleToggleGrid}
          autoRotate={autoRotate}
          onToggleAutoRotate={handleToggleAutoRotate}
          onTakeScreenshot={handleTakeScreenshot}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
        />
      )}
    </div>
  );
}
