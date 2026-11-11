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

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/models/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.model) {
          setFormat(data.model.format);
          setTitle(data.model.title);
          setReady(true);
        }
      })
      .catch((err) => console.error("Embed error:", err));
  }, [slug]);

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
