"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  UploadCloud,
  Copy,
  Check,
  Trash2,
  Eye,
  ExternalLink,
  LogOut,
  Sparkles,
  Layers,
  HardDrive,
  Globe,
  Lock,
  Code,
  FileText,
} from "lucide-react";
import { ThreeViewer } from "@/components/viewer/ThreeViewer";
import { ModelStats } from "@/components/viewer/loaders";
import { authClient } from "@/lib/auth/client";

interface ModelRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  format: "stl" | "3mf";
  bboxX: number | null;
  bboxY: number | null;
  bboxZ: number | null;
  triangleCount: number | null;
  colorInfo: {
    hasColors?: boolean;
    colorCount?: number;
    colors?: string[];
  } | null;
  isPublic: boolean;
  viewCount: number;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [models, setModels] = useState<ModelRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
    email?: string;
    avatarUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileFormat, setFileFormat] = useState<"stl" | "3mf">("stl");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewStats, setPreviewStats] = useState<ModelStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch Models
  const fetchModels = async () => {
    try {
      const res = await fetch("/api/models");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setModels(data.models || []);
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.warn("Neon signOut error:", err);
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Handle File Selection
  const handleFileChange = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "stl" && ext !== "3mf") {
      setUploadError("Only .stl and .3mf files are supported.");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    setFileFormat(ext as "stl" | "3mf");
    setTitle(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        setFileBuffer(e.target.result);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Upload to Neon Handler
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("description", description);

      if (previewStats) {
        formData.append("bboxX", previewStats.bbox.width.toString());
        formData.append("bboxY", previewStats.bbox.depth.toString());
        formData.append("bboxZ", previewStats.bbox.height.toString());
        formData.append("triangleCount", previewStats.triangleCount.toString());
        formData.append(
          "colorInfo",
          JSON.stringify({
            hasColors: previewStats.hasColors,
            colorCount: previewStats.colors.length,
            colors: previewStats.colors,
          })
        );
      }

      const res = await fetch("/api/models/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Reset upload card & refresh list
      setSelectedFile(null);
      setFileBuffer(null);
      setPreviewStats(null);
      setTitle("");
      setDescription("");
      await fetchModels();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload model");
    } finally {
      setUploading(false);
    }
  };

  // Copy share URL with privacy check
  const copyShareLink = (model: ModelRecord) => {
    let shouldPublish = false;
    if (!model.isPublic) {
      shouldPublish = confirm(
        `"${model.title}" is currently Private.\n\nAnyone you share this link with will see "3D Model is Private" and cannot view it.\n\nWould you like to make it Public now before copying the share link?`
      );
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/share/${model.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(model.slug);
    setTimeout(() => setCopiedSlug(null), 2500);

    if (shouldPublish) {
      handleToggleVisibility(model);
    }
  };

  // Toggle Public/Private
  const handleToggleVisibility = async (model: ModelRecord) => {
    try {
      await fetch(`/api/models/${model.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !model.isPublic }),
      });
      setModels((prev) =>
        prev.map((m) => (m.slug === model.slug ? { ...m, isPublic: !m.isPublic } : m))
      );
    } catch (err) {
      console.error("Visibility toggle failed:", err);
    }
  };

  // Delete Model
  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to permanently delete this model?")) return;
    try {
      await fetch(`/api/models/${slug}`, { method: "DELETE" });
      setModels((prev) => prev.filter((m) => m.slug !== slug));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Aggregate Stats
  const totalViews = models.reduce((acc, m) => acc + m.viewCount, 0);
  const totalStorageMb = (
    models.reduce((acc, m) => acc + m.fileSize, 0) /
    (1024 * 1024)
  ).toFixed(2);
  const totalColor3mf = models.filter((m) => m.format === "3mf").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-white flex items-center gap-2">
                3D Share
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  Neon PostgreSQL
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                {currentUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
                <span className="max-w-[150px] truncate font-mono text-[11px]">
                  {currentUser.email || currentUser.username}
                </span>
              </div>
            )}
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Public Site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors border border-rose-500/20 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4.5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider">Models</span>
              <Box className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{models.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">STL & 3MF assets</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4.5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider">Total Views</span>
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {totalViews.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Public inspections</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4.5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider">Storage</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {totalStorageMb} <span className="text-sm font-normal text-slate-400">MB</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">PostgreSQL bytea</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4.5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider">Multi-Color 3MF</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{totalColor3mf}</div>
            <div className="text-[11px] text-slate-500 mt-1">Color fidelity models</div>
          </div>
        </div>

        {/* Upload Card / Dropzone */}
        <section className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-400" />
            Upload 3D Asset
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Drag and drop a <code>.stl</code> or <code>.3mf</code> file to generate a public share link. Multi-color 3MF files retain full slicer and CAD color data.
          </p>

          {uploadError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              {uploadError}
            </div>
          )}

          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? "border-sky-400 bg-sky-500/10 scale-[1.01]"
                  : "border-slate-700/80 hover:border-slate-500 bg-slate-950/50 hover:bg-slate-900/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,.3mf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg shadow-sky-500/10">
                <Box className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-white">Click or drag & drop 3D model here</p>
              <p className="text-xs text-slate-400 mt-1">Supports standard STL and multi-color 3MF files</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
              {/* Live 3D Preview in Upload Card */}
              <div className="h-72 sm:h-80 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative">
                {fileBuffer && (
                  <ThreeViewer
                    fileBuffer={fileBuffer}
                    format={fileFormat}
                    title={title}
                    onStatsLoaded={setPreviewStats}
                  />
                )}
              </div>

              {/* Upload Form Details */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                      Model Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 font-medium"
                      placeholder="e.g. Mechanical Bracket"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 resize-none"
                      placeholder="Add design notes, printing material, or revision history..."
                    />
                  </div>

                  {/* Metrology preview */}
                  {previewStats && (
                    <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 space-y-1">
                      <div className="text-[10px] text-sky-400 uppercase font-bold tracking-wider mb-1">
                        Pre-flight Metrology
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bounding Box:</span>
                        <span>
                          {previewStats.bbox.width} × {previewStats.bbox.depth} ×{" "}
                          {previewStats.bbox.height} mm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Triangles:</span>
                        <span>{previewStats.triangleCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Colors Detected:</span>
                        <span className={previewStats.hasColors ? "text-purple-400 font-bold" : ""}>
                          {previewStats.hasColors
                            ? `${previewStats.colors.length} palette colors (Multi-Color 3MF)`
                            : "Single material"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileBuffer(null);
                      setPreviewStats(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Save & Generate Public Share Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Models List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Uploaded Models ({models.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Loading models from Neon...
            </div>
          ) : models.length === 0 ? (
            <div className="p-12 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-center text-slate-400 text-sm">
              No models uploaded yet. Use the dropzone above to upload your first STL or 3MF model.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold tracking-wider ${
                            model.format === "3mf"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                          }`}
                        >
                          {model.format.toUpperCase()}
                          {model.colorInfo?.hasColors ? " (Color)" : ""}
                        </span>

                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold tracking-wider flex items-center gap-1 ${
                            model.isPublic
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {model.isPublic ? (
                            <>
                              <Globe className="w-3 h-3 text-emerald-400" />
                              <span>Public</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Private</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>{model.viewCount} views</span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-base text-white tracking-tight truncate group-hover:text-sky-300 transition-colors">
                      {model.title}
                    </h3>
                    {model.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {model.description}
                      </p>
                    )}

                    {/* Metadata specs */}
                    <div className="mt-4 p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">File size:</span>
                        <span>{(model.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                      {model.bboxX && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Dimensions:</span>
                          <span>
                            {model.bboxX} × {model.bboxY} × {model.bboxZ} mm
                          </span>
                        </div>
                      )}
                      {model.triangleCount && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Faces:</span>
                          <span>{model.triangleCount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Share Link Copy */}
                    <button
                      onClick={() => copyShareLink(model)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        copiedSlug === model.slug
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      }`}
                    >
                      {copiedSlug === model.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Link!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Open in Viewer */}
                    <Link
                      href={`/share/${model.slug}`}
                      target="_blank"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Open 3D Viewer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>

                    {/* Toggle Visibility */}
                    <button
                      onClick={() => handleToggleVisibility(model)}
                      className={`p-2 rounded-lg transition-colors ${
                        model.isPublic
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                          : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                      }`}
                      title={
                        model.isPublic
                          ? "Model is Public. Click to Make Private"
                          : "Model is Private. Click to Make Public"
                      }
                    >
                      {model.isPublic ? (
                        <Globe className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-400" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(model.slug)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
