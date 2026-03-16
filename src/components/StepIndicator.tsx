"use client";

import React from "react";

const STEPS = [
  { label: "Subir", path: "/upload" },
  { label: "Revisar", path: "/review" },
  { label: "Listo", path: "/success" },
];

interface StepIndicatorProps {
  currentPath: string;
}

export default function StepIndicator({ currentPath }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => currentPath.startsWith(s.path));

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;

        return (
          <React.Fragment key={step.path}>
            {i > 0 && (
              <div
                style={{
                  width: 32,
                  height: 2,
                  borderRadius: 1,
                  background: isCompleted || isActive ? "var(--blue)" : "var(--border)",
                  transition: "background 0.2s ease",
                }}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                  transition: "all 0.2s ease",
                  background: isCompleted
                    ? "var(--blue)"
                    : isActive
                    ? "var(--blue)"
                    : "var(--surface-raised)",
                  color: isCompleted || isActive ? "white" : "var(--text-dim)",
                  border: isActive ? "none" : isCompleted ? "none" : "1px solid var(--border)",
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--blue)" : isCompleted ? "var(--text)" : "var(--text-dim)",
                  transition: "color 0.2s ease",
                }}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
