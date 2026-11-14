"use client";

import React, { useState } from "react";
import {
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Camera,
  Grid,
  Palette,
  Info,
  Box,
  Play,
  Pause,
  X,
} from "lucide-react";
import { FilamentSlotInfo, ModelStats } from "./loaders";

export type ShadingMode = "shaded" | "wireframe" | "edges" | "transparent";

function FilamentPillList({
  filaments,
  onSelect,
}: {
  filaments: FilamentSlotInfo[];
  onSelect?: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {filaments.map((f) => {
        const inactive = f.active === false;
        const content = (
          <>
            <span
              className={`${onSelect ? "w-3 h-3" : "w-2.5 h-2.5"} rounded-full border border-white/25 shrink-0`}
              style={{ backgroundColor: f.color }}
            />
            <span>#{f.slot}</span>
            {f.type && <span className="text-neutral-400">{f.type}</span>}
          </>
        );
        const title = `Slot #${f.slot}${f.type ? ` (${f.type})` : ""}: ${f.color}`;
        return onSelect ? (
          <button
            key={f.slot}
            onClick={() => onSelect(f.color)}
            title={title}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono transition-colors ${
              inactive
                ? "border-neutral-800 bg-neutral-950/60 text-neutral-500 hover:text-neutral-300"
                : "border-neutral-700 bg-neutral-800/80 text-neutral-200 hover:border-neutral-500"
            }`}
          >
            {content}
          </button>
        ) : (
          <span
            key={f.slot}
            title={title}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] ${
              inactive
                ? "border-neutral-800/70 bg-neutral-950/50 text-neutral-500 opacity-65"
                : "border-neutral-700 bg-neutral-800/80 text-neutral-200"
            }`}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

interface ViewerControlsProps {
  stats: ModelStats | null;
  format: string;
  title?: string;
  onResetCamera: () => void;
  onSetCameraView: (view: "iso" | "top" | "front" | "right") => void;
  onRotateModel: (axis: "x" | "y" | "z") => void;
  shadingMode: ShadingMode;
  onChangeShadingMode: (mode: ShadingMode) => void;
  modelColor: string;
  onChangeModelColor: (color: string) => void;
  onResetModelColor: () => void;
  isColorOverridden: boolean;
  showGrid: boolean;
  onToggleGrid: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onTakeScreenshot: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  compact?: boolean;
  activePlate?: number | null;
  onSelectPlate?: (plateIndex: number | null) => void;
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
  onRotateModel,
  shadingMode,
  onChangeShadingMode,
  modelColor,
  onChangeModelColor,
  onResetModelColor,
  isColorOverridden,
  showGrid,
  onToggleGrid,
  autoRotate,
  onToggleAutoRotate,
  onTakeScreenshot,
  onToggleFullscreen,
  isFullscreen,
  compact = false,
  activePlate = null,
  onSelectPlate,
}: ViewerControlsProps) {
  const [showStats, setShowStats] = useState(!compact);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const canResetProfileColors =
    isColorOverridden && (format === "3mf" || stats?.hasColors);

  const toolbarBtnClass = compact
    ? "px-1.5 py-1 rounded-md text-[10px] font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
    : "px-2 py-1 rounded-md text-xs font-mono font-medium hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors";
  const shadingBtnClass = (active: boolean) =>
    `${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-xs"} rounded-md font-medium transition-colors ${
      active
        ? "bg-sky-500/20 text-sky-400 font-semibold"
        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
    }`;

  return (
    <>
      {/* Top Left: Title & Format Badge */}
      {title && (
        <div
          className={`absolute z-20 flex items-center bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-xl text-white shadow-xl pointer-events-auto ${
            compact
              ? "top-2.5 left-2.5 gap-2 px-3 py-1.5 max-w-[calc(100%-8.5rem)]"
              : "top-4 left-4 gap-2.5 px-4 py-2 max-w-[calc(100%-13rem)]"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <h1
            className={`font-semibold tracking-wide truncate ${
              compact ? "text-xs max-w-[140px] sm:max-w-[200px]" : "text-sm max-w-[200px] sm:max-w-[340px]"
            }`}
          >
            {title}
          </h1>
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold tracking-wider shrink-0 ${
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

      {/* Top Left (below title): Multi-Plate Selector */}
      {stats?.plates && stats.plates.length > 1 && onSelectPlate && (
        <div
          className={`absolute z-20 flex flex-wrap items-center gap-1 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-xl p-1 text-xs shadow-xl pointer-events-auto max-w-[calc(100%-1.5rem)] ${
            compact
              ? title
                ? "top-12 left-2.5"
                : "top-2.5 left-2.5"
              : title
              ? "top-16 left-4"
              : "top-4 left-4"
          }`}
        >
          <button
            onClick={() => onSelectPlate(null)}
            className={`rounded-lg font-mono font-medium transition-colors cursor-pointer ${
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
            } ${
              activePlate === null
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
            }`}
          >
            All Plates ({stats.plates.length})
          </button>
          {stats.plates.map((plate) => (
            <button
              key={plate.index}
              onClick={() => onSelectPlate(plate.index)}
              title={
                plate.name
                  ? `${plate.name} (${plate.bbox.width} × ${plate.bbox.depth} × ${plate.bbox.height} mm)`
                  : `Plate ${plate.index} (${plate.bbox.width} × ${plate.bbox.depth} × ${plate.bbox.height} mm)`
              }
              className={`flex items-center gap-1.5 rounded-lg font-mono font-medium transition-colors cursor-pointer ${
                compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
              } ${
                activePlate === plate.index
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
              }`}
            >
              <span>Plate {plate.index}</span>
              {plate.colors.length > 0 && (
                <span className="flex items-center gap-0.5">
                  {plate.colors.slice(0, 4).map((c, idx) => (
                    <span
                      key={idx}
                      className="w-2 h-2 rounded-full border border-white/25"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Top Right: Viewport Quick Actions */}
      <div
        className={`absolute z-20 flex items-center bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-xl text-neutral-300 shadow-xl pointer-events-auto ${
          compact ? "top-2.5 right-2.5 gap-1 p-1" : "top-4 right-4 gap-1.5 p-1.5"
        }`}
      >
        <button
          onClick={onToggleAutoRotate}
          title={autoRotate ? "Pause Turntable" : "Start Turntable"}
          className={`${compact ? "p-1.5" : "p-2"} rounded-lg transition-colors ${
            autoRotate ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
          }`}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleGrid}
          title={showGrid ? "Hide Grid Floor" : "Show Grid Floor"}
          className={`${compact ? "p-1.5" : "p-2"} rounded-lg transition-colors ${
            showGrid ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          onClick={onTakeScreenshot}
          title="Save High-Res PNG Screenshot"
          className={`${compact ? "p-1.5" : "p-2"} rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white`}
        >
          <Camera className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          className={`${compact ? "p-1.5" : "p-2"} rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300 hover:text-white`}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Floating Toolbar: Camera, Orientation, Shading, Colors */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto ${
          compact ? "bottom-2.5 max-w-[calc(100%-1rem)]" : "bottom-6 max-w-[calc(100%-1.5rem)]"
        }`}
      >
        {showColorPicker && (
          <div className="mb-2 mx-auto w-fit max-w-full bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-xl p-3 shadow-2xl space-y-2.5 text-xs text-neutral-200">
            {stats?.filaments && stats.filaments.length > 0 && (
              <div className="space-y-1.5 border-b border-neutral-800 pb-2">
                <div className="flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  <span>3MF Profile Filaments</span>
                  {canResetProfileColors && (
                    <button
                      onClick={() => {
                        onResetModelColor();
                        setShowColorPicker(false);
                      }}
                      className="text-sky-400 hover:text-sky-300 font-semibold normal-case"
                    >
                      Reset to Profile Colors
                    </button>
                  )}
                </div>
                <FilamentPillList
                  filaments={stats.filaments}
                  onSelect={(color) => {
                    onChangeModelColor(color);
                    setShowColorPicker(false);
                  }}
                />
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
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
              {canResetProfileColors && (!stats?.filaments || stats.filaments.length === 0) && (
                <button
                  onClick={() => {
                    onResetModelColor();
                    setShowColorPicker(false);
                  }}
                  className="ml-1 px-2 py-1 rounded-md bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-[10px] font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className={`flex items-center bg-neutral-900/85 backdrop-blur-md border border-neutral-700/70 text-white shadow-2xl overflow-x-auto ${
            compact ? "gap-1 rounded-xl p-1.5" : "gap-2 rounded-2xl p-2"
          }`}
        >
          {/* Camera Views */}
          <div
            className={`flex items-center border-r border-neutral-800 shrink-0 ${
              compact ? "gap-0.5 pr-1.5" : "gap-1 pr-2"
            }`}
          >
            <button
              onClick={onResetCamera}
              title="Reset Camera Framing"
              className={`${compact ? "p-1.5" : "p-2"} rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors`}
            >
              <RotateCcw className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </button>
            <button
              onClick={() => onSetCameraView("iso")}
              className={toolbarBtnClass}
            >
              ISO
            </button>
            <button
              onClick={() => onSetCameraView("top")}
              className={toolbarBtnClass}
            >
              TOP
            </button>
            <button
              onClick={() => onSetCameraView("front")}
              className={toolbarBtnClass}
            >
              FRONT
            </button>
            <button
              onClick={() => onSetCameraView("right")}
              className={toolbarBtnClass}
            >
              SIDE
            </button>
          </div>

          {/* Model Orientation (90° step rotation) */}
          <div
            className={`flex items-center border-r border-neutral-800 shrink-0 ${
              compact ? "gap-0.5 pr-1.5" : "gap-1 pr-2"
            }`}
            title="Rotate Model Orientation 90°"
          >
            <RotateCw className="w-3.5 h-3.5 text-neutral-500 mx-0.5" />
            <button
              onClick={() => onRotateModel("x")}
              title="Rotate Model +90° around X axis"
              className={toolbarBtnClass}
            >
              X
            </button>
            <button
              onClick={() => onRotateModel("y")}
              title="Rotate Model +90° around Vertical Y axis"
              className={toolbarBtnClass}
            >
              Y
            </button>
            <button
              onClick={() => onRotateModel("z")}
              title="Rotate Model +90° around Z axis"
              className={toolbarBtnClass}
            >
              Z
            </button>
          </div>

          {/* Shading Modes */}
          <div
            className={`flex items-center border-r border-neutral-800 shrink-0 ${
              compact ? "gap-0.5 pr-1.5" : "gap-1 pr-2"
            }`}
          >
            <button
              onClick={() => onChangeShadingMode("shaded")}
              className={shadingBtnClass(shadingMode === "shaded")}
            >
              Solid
            </button>
            <button
              onClick={() => onChangeShadingMode("edges")}
              className={shadingBtnClass(shadingMode === "edges")}
            >
              Edges
            </button>
            <button
              onClick={() => onChangeShadingMode("wireframe")}
              className={shadingBtnClass(shadingMode === "wireframe")}
            >
              Wire
            </button>
            <button
              onClick={() => onChangeShadingMode("transparent")}
              className={shadingBtnClass(shadingMode === "transparent")}
            >
              X-Ray
            </button>
          </div>

          {/* Color Palette Toggle */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Material Color & Profile Filaments"
            className={`${compact ? "p-1.5 gap-1" : "p-2 gap-1.5"} rounded-lg transition-colors flex items-center shrink-0 ${
              showColorPicker
                ? "bg-sky-500/20 text-sky-300"
                : "hover:bg-neutral-800 text-neutral-300 hover:text-white"
            }`}
          >
            <Palette className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
            <span
              className="w-3 h-3 rounded-full border border-white/40"
              style={{ backgroundColor: modelColor }}
            />
          </button>

          {/* Toggle Stats Panel */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`${compact ? "p-1.5" : "p-2"} rounded-lg transition-colors shrink-0 ${
              showStats ? "bg-sky-500/20 text-sky-400" : "hover:bg-neutral-800 text-neutral-300"
            }`}
            title="Toggle Dimensions & Telemetry"
          >
            <Info className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </button>
        </div>
      </div>

      {/* Bottom Right: Dimensional Telemetry HUD */}
      {showStats && stats && (
        <div
          className={`absolute z-30 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/60 rounded-xl p-3 text-xs text-neutral-300 shadow-xl pointer-events-auto overflow-y-auto ${
            compact
              ? "bottom-16 right-2.5 w-60 max-h-[calc(100%-7.5rem)]"
              : "bottom-20 xl:bottom-6 right-4 w-64 max-h-[calc(100%-9rem)]"
          }`}
        >
          <div className="flex items-center justify-between font-mono text-[11px] text-neutral-400 mb-2 border-b border-neutral-800 pb-1">
            <span className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider">
              <Box className="w-3.5 h-3.5 text-sky-400" /> Metrology HUD
            </span>
            <div className="flex items-center gap-1.5">
              <span>MM</span>
              <button
                onClick={() => setShowStats(false)}
                title="Close Telemetry HUD"
                className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
            {stats.partCount !== undefined && stats.partCount > 1 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Parts:</span>
                <span className="text-white font-medium">{stats.partCount}</span>
              </div>
            )}
            {stats.plates && stats.plates.length > 1 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Build Plates:</span>
                <span className="text-purple-300 font-medium">
                  {activePlate ? `Plate ${activePlate} of ${stats.plates.length}` : `${stats.plates.length} plates`}
                </span>
              </div>
            )}

            {/* Display 3MF profile filaments */}
            {stats.filaments && stats.filaments.length > 0 ? (
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-neutral-500 block mb-1.5">Profile Filaments:</span>
                <FilamentPillList filaments={stats.filaments} />
              </div>
            ) : (
              stats.colors.length > 0 &&
              stats.colors[0] !== "vertex-colors" && (
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
                      <span className="text-[9px] text-neutral-400">
                        +{stats.colors.length - 10}
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
