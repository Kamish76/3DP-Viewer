import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Share — Instant STL & Multi-Color 3MF Web Viewer",
  description:
    "Upload and publicly share STL and multi-color 3MF files with high-fidelity interactive WebGL preview.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
