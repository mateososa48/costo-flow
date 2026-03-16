"use client";

import React, { useCallback, useRef, useState } from "react";

interface UploadFile {
  file: File;
  id: string;
}

interface UploadZoneProps {
  files: UploadFile[];
  onChange: (files: UploadFile[]) => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_QUALITY = 0.85;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 800 * 1024) { resolve(file); return; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        IMAGE_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center border"
        style={{ background: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.2)" }}>
        <span className="text-[10px] font-bold" style={{ color: "var(--danger)" }}>PDF</span>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center border"
      style={{ background: "var(--blue-light)", borderColor: "rgba(3,80,169,0.2)" }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "var(--blue)" }}>
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
        <path d="M1 10l3.5-3 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function UploadZone({ files, onChange }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const valid = arr.filter((f) => ALLOWED_TYPES.includes(f.type));
      const processed = await Promise.all(
        valid.map((f) => f.type.startsWith("image/") ? compressImage(f) : Promise.resolve(f))
      );
      const newFiles: UploadFile[] = processed.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));
      const existing = new Set(files.map((f) => `${f.file.name}-${f.file.size}`));
      const unique = newFiles.filter((f) => !existing.has(`${f.file.name}-${f.file.size}`));
      onChange([...files, ...unique]);
    },
    [files, onChange]
  );

  const removeFile = (id: string) => onChange(files.filter((f) => f.id !== id));

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false); }}
        onClick={() => fileInputRef.current?.click()}
        className="relative rounded-[var(--radius-lg)] border-2 border-dashed flex flex-col items-center justify-center gap-3 p-8 text-center transition-all duration-200 cursor-pointer"
        style={{
          borderColor: dragActive ? "var(--blue)" : "var(--border)",
          background: dragActive ? "var(--blue-light)" : "var(--surface)",
          transform: dragActive ? "scale(1.01)" : "scale(1)",
        }}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            background: dragActive ? "var(--blue-light)" : "var(--pink-glow)",
            color: dragActive ? "var(--blue)" : "var(--pink-dark)",
          }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {dragActive ? "Suelta aquí" : (
              <>
                <span className="hidden sm:inline">Arrastra facturas o </span>
                <span>Toca para seleccionar</span>
              </>
            )}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            PDF, JPG, PNG, WEBP, HEIC — varios archivos
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Camera button — mobile only */}
      <label
        htmlFor="camera-input"
        className="md:hidden w-full py-2.5 rounded-[var(--radius)] border text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.99] cursor-pointer select-none"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)"; (e.currentTarget as HTMLElement).style.color = "var(--blue)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>Tomar foto</span>
      </label>
      <input
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider px-1" style={{ color: "var(--text-muted)" }}>
            {files.length} archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {files.map(({ file, id }) => (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] border group animate-fade-up"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <FileIcon mimeType={file.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate leading-tight" style={{ color: "var(--text)" }}>{file.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 sm:opacity-0 sm:group-hover:opacity-100"
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.background = "var(--danger-dim)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                  aria-label="Quitar archivo"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
