"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Share2,
  Check,
  Code,
  Box,
  Eye,
  Calendar,
  AlertCircle,
  ExternalLink,
  Lock,
} from "lucide-react";
import { ThreeViewer } from "@/components/viewer/ThreeViewer";

interface ModelData {
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
  viewCount: number;
  createdAt: string;
}

export default function SharePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [model, setModel] = useState<ModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/models/${slug}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) {
            setIsPrivate(true);
            throw new Error(
              "This 3D model is currently set to Private by the owner. Make it public in the Admin dashboard to share."
            );
          }
          if (res.status === 404) {
            setIsNotFound(true);
            throw new Error(
              "3D model not found. The model may have been deleted or the link is incorrect."
            );
          }
          throw new Error("Failed to load model details from server.");
        }
        return res.json();
      })
      .then((data) => {
        setModel(data.model);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error loading model");
        setLoading(false);
      });
  }, [slug]);

  const handleCopyShare = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/embed/${slug}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-mono text-sm text-slate-400">Loading 3D asset from Neon...</p>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 p-6 text-center">
        {isPrivate ? (
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/10">
            <AlertCircle className="w-8 h-8" />
          </div>
        )}

        <h1 className="text-2xl font-bold text-white mb-2">
          {isPrivate
            ? "3D Model is Private"
            : isNotFound
            ? "3D Model Not Found"
            : "3D Model Unavailable"}
        </h1>

        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          {error || "This model may have been deleted or set to private by the owner."}
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-sm font-medium text-white transition-colors"
          >
            Return to 3D Share
          </Link>
          {isPrivate && (
            <Link
              href="/login"
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-sm transition-colors"
            >
              Sign In as Owner
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Canvas */}
      <ThreeViewer
        fileUrl={`/api/models/${slug}/file`}
        format={model.format}
        title={model.title}
        className="w-full h-full"
      />

      {/* Top Floating Actions Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-2xl p-1.5 shadow-2xl pointer-events-auto">
        <button
          onClick={handleCopyShare}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            copiedLink
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "hover:bg-neutral-800 text-neutral-300 hover:text-white"
          }`}
          title="Copy Public Link"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">
            {copiedLink ? "Link Copied!" : "Share Link"}
          </span>
        </button>

        <a
          href={`/api/models/${slug}/file`}
          download={model.fileName}
          className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="Download original file"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>

        <button
          onClick={() => setShowEmbedModal(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="Get embed iframe code"
        >
          <Code className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Embed</span>
        </button>

        <Link
          href="/"
          className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="3D Share Home"
        >
          <Box className="w-4 h-4" />
        </Link>
      </div>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Code className="w-5 h-5 text-sky-400" />
              Embed 3D Viewer
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste this responsive iframe code into your website, documentation, or blog to embed this interactive 3D model.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-sky-300 break-all select-all mb-4">
              {embedCode}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEmbedModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopyEmbed}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                {copiedEmbed ? "Copied!" : "Copy Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
