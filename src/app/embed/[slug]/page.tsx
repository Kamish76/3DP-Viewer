"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ThreeViewer } from "@/components/viewer/ThreeViewer";

export default function EmbedPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [format, setFormat] = useState<"stl" | "3mf">("stl");
  const [title, setTitle] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/models/${slug}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error("This 3D model is private.");
          if (res.status === 404) throw new Error("3D model not found.");
          throw new Error("Failed to load model.");
        }
        return res.json();
      })
      .then((data) => {
        if (data.model) {
          setFormat(data.model.format);
          setTitle(data.model.title);
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        console.error("Embed error:", err);
        setError(err instanceof Error ? err.message : "Failed to load model");
      });
  }, [slug]);

  if (error) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono text-xs p-4 text-center">
        <span className="text-amber-400 mb-1 font-bold">⚠️ Embed Unavailable</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs">
        Loading 3D asset...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950">
      <ThreeViewer
        fileUrl={`/api/models/${slug}/file`}
        format={format}
        title={title}
        className="w-full h-full"
      />
    </div>
  );
}
