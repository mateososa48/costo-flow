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

const IMAGE_MAX_DIMENSION = 1600; // px — keeps quality high while halving most phone photos
const IMAGE_QUALITY = 0.85;

/**
 * Resize + compress an image file client-side using Canvas.
 * Returns the original file unchanged if it's already small or not a raster image.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") {
    return file; // HEIC can't be decoded by Canvas; return as-is
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
      // Skip compression if image is already small enough
      if (scale === 1 && file.size < 800 * 1024) {
        resolve(file);
        return;
      }
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
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-red-900/30 border border-red-800/40 flex items-center justify-center">
        <span className="text-[10px] font-bold text-red-400">PDF</span>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-[var(--navy)]/60 border border-[var(--navy-bright)]/40 flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--gold)]">
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
      // Compress images before adding
      const processed = await Promise.all(
        valid.map((f) => f.type.startsWith("image/") ? compressImage(f) : Promise.resolve(f))
      );
      const newFiles: UploadFile[] = processed.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }));
      // Deduplicate by name+size
      const existing = new Set(files.map((f) => `${f.file.name}-${f.file.size}`));
      const unique = newFiles.filter((f) => !existing.has(`${f.file.name}-${f.file.size}`));
      onChange([...files, ...unique]);
    },
    [files, onChange]
  );

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          "relative rounded-[var(--radius-lg)] border-2 border-dashed",
          "flex flex-col items-center justify-center gap-3 p-8 text-center",
          "transition-all duration-200 cursor-pointer",
          dragActive
            ? "border-[var(--gold)] bg-[var(--gold-glow)] scale-[1.01]"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold-dim)] hover:bg-[var(--surface-raised)]",
        ].join(" ")}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Upload icon */}
        <div
          className={[
            "w-12 h-12 rounded-full flex items-center justify-center",
            "transition-all duration-200",
            dragActive
              ? "bg-[var(--gold)]/20 text-[var(--gold)]"
              : "bg-[var(--surface-raised)] text-[var(--text-muted)]",
          ].join(" ")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div>
          <p className="text-[var(--text)] font-medium text-sm">
            {dragActive ? "Suelta aquí" : "Arrastra facturas o haz clic"}
          </p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            PDF, JPG, PNG, WEBP, HEIC — hasta varios archivos
          </p>
        </div>

        {/* Hidden file input */}
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

      {/* Mobile: scan / photo button — no capture= so iOS shows full picker including document scanner */}
      <label
        htmlFor="mobile-input"
        className="w-full py-2.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] text-sm flex flex-col items-center justify-center gap-0.5 hover:border-[var(--gold-dim)] hover:text-[var(--text)] transition-all duration-150 active:scale-[0.99] cursor-pointer select-none"
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Escanear o fotografiar factura
        </span>
        <span className="text-[10px] text-[var(--text-dim)] leading-tight">
          En iPhone: elige "Escanear documentos" para mejor calidad
        </span>
      </label>
      <input
        id="mobile-input"
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider px-1">
            {files.length} archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {files.map(({ file, id }) => (
              <div
                key={id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-subtle)] group animate-fade-up"
              >
                <FileIcon mimeType={file.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text)] truncate leading-tight">{file.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(id)}
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-red-900/20 transition-all duration-150 opacity-0 group-hover:opacity-100"
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
