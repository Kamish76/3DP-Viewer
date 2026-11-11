"use client";

import React, { useState } from "react";
import {
  RotateCcw,
  Maximize2,
  Camera,
  Grid,
  Layers,
  Palette,
  Info,
  Box,
  Compass,
  Play,
  Pause,
} from "lucide-react";
import { ModelStats } from "./loaders";

export type ShadingMode = "shaded" | "wireframe" | "edges" | "transparent";

interface ViewerControlsProps {
  stats: ModelStats | null;
  format: string;
  title?: string;
  onResetCamera: () => void;
  onSetCameraView: (view: "iso" | "top" | "front" | "right") => void;
  shadingMode: ShadingMode;
  onChangeShadingMode: (mode: ShadingMode) => void;
  modelColor: string;
  onChangeModelColor: (color: string) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onTakeScreenshot: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

const PRESET_COLORS = [
  "#38bdf8", // Sky Cyan
  "#f59e0b", // Amber Orange
  "#10b981", // Emerald Green
  "#ef4444", // Crimson Red
  "#a855f7", // Royal Purple
  "#e2e8f0", // Clean Slate
  "#64748b", // Gunmetal
];

export function ViewerControls({
  stats,
  format,
  title,
  onResetCamera,
  onSetCameraView,
  shadingMode,
  onChangeShadingMode,
  modelColor,
  onChangeModelColor,
  showGrid,
  onToggleGrid,
  autoRotate,
  onToggleAutoRotate,
  onTakeScreenshot,
  onToggleFullscreen,
  isFullscreen,
}: ViewerControlsProps) {
  const [showStats, setShowStats] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <>
      {/* Top Left: Title & Format Badge */}
      {title && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-xl px-4 py-2 text-white shadow-xl pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="font-semibold text-sm tracking-wide max-w-[200px] sm:max-w-[340px] truncate">
            {title}
          </h1>
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold tracking-wider ${
              format === "3mf"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
            }`}
          >
            {format.toUpperCase()}
            {stats?.hasColors ? " (Color)" : ""}
          </span>
        </div>
      )}

      {/* Top Right: Viewport Quick Actions */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-xl p-1.5 text-neutral-300 shadow-xl pointer-events-auto">
        <button
          onClick={onToggleAutoRotate}
          title={autoRotate ? "Pause Turntable" : "Start Turntable"}
          className={`p-2 rounded-lg transition-colors ${
            autoRotate ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
          }`}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleGrid}
          title={showGrid ? "Hide Grid Floor" : "Show Grid Floor"}
          className={`p-2 rounded-lg transition-colors ${
            showGrid ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={onTakeScreenshot}
          title="Save High-Res PNG Screenshot"
          className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white"
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Toolbar: Camera, Shading, Colors */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-neutral-900/85 backdrop-blur-md border border-neutral-700/70 rounded-2xl p-2 text-white shadow-2xl pointer-events-auto max-w-[95vw] overflow-x-auto">
        {/* Camera Views */}
        <div className="flex items-center gap-1 border-r border-neutral-800 pr-2">
          <button
            onClick={onResetCamera}
            title="Reset Camera Framing"
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetCameraView("iso")}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            ISO
          </button>
          <button
            onClick={() => onSetCameraView("top")}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            TOP
          </button>
          <button
            onClick={() => onSetCameraView("front")}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            FRONT
          </button>
          <button
            onClick={() => onSetCameraView("right")}
            className="px-2 py-1 rounded-md text-xs font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            SIDE
          </button>
        </div>

        {/* Shading Modes */}
        <div className="flex items-center gap-1 border-r border-neutral-800 pr-2">
          <button
            onClick={() => onChangeShadingMode("shaded")}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              shadingMode === "shaded"
                ? "bg-sky-500/20 text-sky-400 font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            Solid
          </button>
          <button
            onClick={() => onChangeShadingMode("edges")}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              shadingMode === "edges"
                ? "bg-sky-500/20 text-sky-400 font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            Edges
          </button>
          <button
            onClick={() => onChangeShadingMode("wireframe")}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              shadingMode === "wireframe"
                ? "bg-sky-500/20 text-sky-400 font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            Wire
          </button>
          <button
            onClick={() => onChangeShadingMode("transparent")}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              shadingMode === "transparent"
                ? "bg-sky-500/20 text-sky-400 font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            X-Ray
          </button>
        </div>

        {/* Color Palette Toggle (useful for STL or tint) */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Material Color"
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Palette className="w-4 h-4" />
            <span
              className="w-3 h-3 rounded-full border border-white/40"
              style={{ backgroundColor: modelColor }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 shadow-2xl flex items-center gap-2 z-30">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onChangeModelColor(c);
                    setShowColorPicker(false);
                  }}
                  className="w-5 h-5 rounded-full border border-white/20 hover:scale-125 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={modelColor}
                onChange={(e) => onChangeModelColor(e.target.value)}
                className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                title="Custom Color"
              />
            </div>
          )}
        </div>

        {/* Toggle Stats Panel */}
        <button
          onClick={() => setShowStats(!showStats)}
          className={`p-2 rounded-lg transition-colors ${
            showStats ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
          }`}
          title="Toggle Dimensions & Telemetry"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Right: Dimensional Telemetry HUD */}
      {showStats && stats && (
        <div className="absolute bottom-6 right-4 z-20 bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl p-3 text-xs text-neutral-300 shadow-xl w-60 pointer-events-auto">
          <div className="flex items-center justify-between font-mono text-[11px] text-neutral-400 mb-2 border-b border-neutral-800 pb-1">
            <span className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
              <Box className="w-3.5 h-3.5 text-sky-400" /> Metrology HUD
            </span>
            <span>MM</span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-500">Width (X):</span>
              <span className="text-white font-medium">{stats.bbox.width} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Depth (Y):</span>
              <span className="text-white font-medium">{stats.bbox.depth} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Height (Z):</span>
              <span className="text-white font-medium">{stats.bbox.height} mm</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-neutral-800/80">
              <span className="text-neutral-500">Triangles:</span>
              <span className="text-white font-medium">
                {stats.triangleCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Volume:</span>
              <span className="text-white font-medium">{stats.volumeCm3} cm³</span>
            </div>

            {/* Display detected 3MF color swatches */}
            {stats.colors.length > 0 && stats.colors[0] !== "vertex-colors" && (
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-neutral-500 block mb-1">Color Palette:</span>
                <div className="flex flex-wrap gap-1">
                  {stats.colors.slice(0, 10).map((c, i) => (
                    <span
                      key={i}
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {stats.colors.length > 10 && (
                    <span className="text-[9px] text-neutral-400">+{stats.colors.length - 10}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
