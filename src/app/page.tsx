"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Box,
  UploadCloud,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Ruler,
  Eye,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white flex items-center gap-2">
              3D Share
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                v1.0
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Owner Sign In
            </Link>
            <Link
              href="/admin"
              className="py-2 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5"
            >
              <span>Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 mb-8 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Multi-Color 3MF & Precision STL CAD Viewing</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-tight">
          Upload 3D Models. <br />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Share Public 3D Previews Instantly.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed">
          A single-account 3D asset platform powered by Next.js and Neon Serverless PostgreSQL. Upload <code>.stl</code> and <code>.3mf</code> models with complete multi-color fidelity and millimeter metrology HUDs.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/admin"
            className="py-3 px-6 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-sky-500/25 flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Open Upload Dashboard</span>
          </Link>
          <Link
            href="/login"
            className="py-3 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-sm rounded-xl transition-colors"
          >
            Owner Login
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Engineered for Makers, Engineers & CAD Designers
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Everything needed to inspect and showcase 3D physical models in the browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Multi-Color 3MF Fidelity</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reads 3MF XML color groups, base materials, and sub-mesh components directly from Bambu Studio, PrusaSlicer, OrcaSlicer, or Fusion 360 without losing color channels.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4">
                <Ruler className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Automated CAD Metrology</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculates precise millimeter bounding box dimensions (W × D × H), triangle counts, and estimated volume (cm³) on every model load.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Frictionless Public Sharing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate clean, shareable URLs (<code>/share/[slug]</code>) with 1 click. Zero login walls or download gates for your clients, teammates, or visitors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-sky-400" />
            <span>3D Share &bull; Next.js + Neon Serverless PostgreSQL</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Owner Sign In
            </Link>
            <Link href="/admin" className="hover:text-slate-300 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
