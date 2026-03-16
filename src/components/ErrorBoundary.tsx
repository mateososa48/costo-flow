"use client";

import React, { Component } from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "32px",
            textAlign: "center",
            fontFamily: "var(--font-body)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--danger-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            Algo salió mal
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: 400, lineHeight: 1.5 }}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          {this.state.error && (
            <pre
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--text-muted)",
                maxWidth: "100%",
                overflow: "auto",
                textAlign: "left",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: "var(--radius-sm)",
              background: "var(--blue)",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
