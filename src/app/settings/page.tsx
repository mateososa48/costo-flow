"use client";

import React, { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import type { DropdownsResponse } from "@/types";

/* ─── Types ───────────────────────────────────────────────────────────── */

type Tab = "equipo" | "sucursales" | "hojas";

type Member = {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "member" | "readonly";
  name: string;
  avatar?: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
};

type Restaurant = {
  id: string;
  slug: string;
  label: string;
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseRegistryKey(key: string): { restaurant: string; period: string } {
  const parts = key.split("_");
  const month = parts[parts.length - 1];
  const year = parts[parts.length - 2];
  const periodLabel = `${year} · ${month}`;
  const restaurantSlug = parts.slice(0, -2).join("_");
  return { restaurant: restaurantSlug, period: periodLabel };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Role badge ──────────────────────────────────────────────────────── */

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Miembro",
  readonly: "Solo lectura",
};

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    admin: { background: "var(--blue-light)", color: "var(--blue)", border: "1px solid color-mix(in srgb, var(--blue) 20%, transparent)" },
    member: { background: "var(--surface-raised)", color: "var(--text-muted)", border: "1px solid var(--border)" },
    readonly: { background: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border-subtle)" },
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={styles[role] ?? styles.member}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────────── */

function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const px = `${size}px`;
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white select-none"
      style={{ width: px, height: px, fontSize: size * 0.38, background: "var(--blue)" }}
    >
      {initials(name || "?")}
    </div>
  );
}

/* ─── Section wrapper ─────────────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </p>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

/* ─── Tab bar ─────────────────────────────────────────────────────────── */

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "equipo", label: "Equipo" },
    { id: "sucursales", label: "Sucursales" },
    { id: "hojas", label: "Hojas de cálculo" },
  ];
  return (
    <div
      className="flex gap-0.5 p-1 rounded-[var(--radius)] w-fit"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className="px-4 py-1.5 rounded-[calc(var(--radius)-3px)] text-sm font-medium transition-all duration-150"
          style={
            active === t.id
              ? {
                  background: "var(--surface)",
                  color: "var(--text)",
                  boxShadow: "var(--shadow-card)",
                }
              : { color: "var(--text-muted)" }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Equipo tab ──────────────────────────────────────────────────────── */

function EquipoTab({
  isAdmin,
  myUserId,
}: {
  isAdmin: boolean;
  myUserId?: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Role change in-flight
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/settings/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members ?? []);
        setInvites(d.invites ?? []);
      })
      .catch(() => setError("No se pudo cargar el equipo"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRoleChange(id: string, role: string) {
    setUpdatingId(id);
    try {
      const r = await fetch(`/api/settings/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error ?? "Error al cambiar el rol");
      } else {
        setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: role as Member["role"] } : m)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("¿Seguro que quieres eliminar a este usuario del equipo?")) return;
    setRemovingId(id);
    try {
      const r = await fetch(`/api/settings/team/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error ?? "Error al eliminar el usuario");
      } else {
        load();
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const r = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await r.json();
      if (!r.ok) {
        setInviteMsg({ type: "error", text: d.error ?? "Error al invitar" });
      } else {
        setInviteMsg({
          type: d.warning ? "error" : "success",
          text: d.warning ?? `Invitación enviada a ${inviteEmail.trim()}`,
        });
        setInviteEmail("");
        load();
      }
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 rounded-[var(--radius)] animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm py-4 text-center" style={{ color: "var(--danger)" }}>{error}</p>;
  }

  const isSoleAdmin = members.filter((m) => m.role === "admin").length === 1;

  return (
    <div className="space-y-6">
      {/* Member table */}
      <Section
        title="Miembros del equipo"
        description={`${members.length} miembro${members.length !== 1 ? "s" : ""} activo${members.length !== 1 ? "s" : ""}`}
      >
        {members.length === 1 && members[0].user_id === myUserId ? (
          <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
            Eres el único miembro de tu equipo. Invita a alguien para que pueda subir facturas.
          </p>
        ) : (
          <div
            className="rounded-[var(--radius)] border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div
              className="grid gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
                gridTemplateColumns: "1fr 1fr auto auto",
              }}
            >
              <span>Usuario</span>
              <span>Rol</span>
              <span />
              <span />
            </div>
            {members.map((m) => {
              const isMe = m.user_id === myUserId;
              const canModify = isAdmin && !(isMe && isSoleAdmin);
              return (
                <div
                  key={m.id}
                  className="grid items-center gap-3 px-4 py-3"
                  style={{
                    borderTop: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                    gridTemplateColumns: "1fr 1fr auto auto",
                  }}
                >
                  {/* Identity */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={m.name} src={m.avatar} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {m.name}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-dim)" }}>
                            (tú)
                          </span>
                        )}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {m.email}
                      </p>
                    </div>
                  </div>

                  {/* Role */}
                  {isAdmin && canModify ? (
                    <select
                      value={m.role}
                      disabled={updatingId === m.id}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-[var(--radius-sm)] border appearance-none cursor-pointer"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        color: "var(--text)",
                        maxWidth: 140,
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Miembro</option>
                      <option value="readonly">Solo lectura</option>
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}

                  {/* Spinner or spacer */}
                  <div className="w-5 flex items-center justify-center">
                    {updatingId === m.id && (
                      <span
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"
                        style={{ color: "var(--text-dim)" }}
                      />
                    )}
                  </div>

                  {/* Remove */}
                  {isAdmin && canModify ? (
                    <button
                      type="button"
                      disabled={removingId === m.id}
                      onClick={() => handleRemove(m.id)}
                      className="p-1.5 rounded-md transition-colors duration-150 disabled:opacity-40"
                      style={{ color: "var(--text-dim)" }}
                      title="Eliminar del equipo"
                    >
                      {removingId === m.id ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <path d="M3 3l9 9M12 3l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className="w-7" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <Section title="Invitaciones pendientes" description="Expiran en 7 días">
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[var(--radius-sm)]"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                    {inv.email}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Invitado por {inv.invited_by} · <RoleBadge role={inv.role} />
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "var(--warning-dim)", color: "var(--warning)" }}
                >
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Invite form */}
      {isAdmin && (
        <Section title="Invitar a alguien" description="El invitado recibirá un correo con un enlace de acceso">
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nombre@correo.com"
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] text-sm border focus:outline-none focus:ring-2 focus:border-[var(--blue)] focus:ring-[var(--blue)]/15 placeholder:text-[var(--text-dim)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                  Rol
                </label>
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-[var(--radius-sm)] text-sm border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:border-[var(--blue)] focus:ring-[var(--blue)]/15"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Miembro</option>
                    <option value="readonly">Solo lectura</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {inviteMsg && (
              <p
                className="text-sm"
                style={{ color: inviteMsg.type === "error" ? "var(--danger)" : "var(--success)" }}
              >
                {inviteMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--blue)", color: "white" }}
            >
              {inviting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Enviar invitación
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}

/* ─── Sucursales tab ──────────────────────────────────────────────────── */

function SucursalesTab({ isAdmin }: { isAdmin: boolean }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // New restaurant form
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/settings/restaurants")
      .then((r) => r.json())
      .then((d) => setRestaurants(d.restaurants ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(r: Restaurant) {
    setEditingId(r.id);
    setEditLabel(r.label);
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return;
    setSavingId(id);
    try {
      const resp = await fetch(`/api/settings/restaurants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      const d = await resp.json();
      if (!resp.ok) {
        alert(d.error ?? "Error al guardar");
      } else {
        setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, label: editLabel.trim() } : r)));
        setEditingId(null);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newSlug.trim()) return;
    setAdding(true);
    setAddMsg(null);
    try {
      const resp = await fetch("/api/settings/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), slug: newSlug.trim() }),
      });
      const d = await resp.json();
      if (!resp.ok) {
        setAddMsg({ type: "error", text: d.error ?? "Error al crear la sucursal" });
      } else {
        setNewLabel("");
        setNewSlug("");
        setAddMsg({ type: "success", text: "Sucursal creada correctamente" });
        load();
      }
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-[var(--radius)] animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Sucursales activas"
        description="El slug es permanente para no romper registros existentes"
      >
        {restaurants.length === 0 ? (
          <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
            No hay sucursales registradas.
          </p>
        ) : (
          <div
            className="rounded-[var(--radius)] border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="grid gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
                gridTemplateColumns: "1fr 1fr auto",
              }}
            >
              <span>Nombre</span>
              <span>Slug</span>
              {isAdmin && <span />}
            </div>
            {restaurants.map((r) => (
              <div
                key={r.id}
                className="grid items-center gap-3 px-4 py-3"
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  background: "var(--surface)",
                  gridTemplateColumns: "1fr 1fr auto",
                }}
              >
                {editingId === r.id ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(r.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="text-sm px-2 py-1 rounded-[var(--radius-sm)] border focus:outline-none focus:ring-2 focus:border-[var(--blue)] focus:ring-[var(--blue)]/15"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                ) : (
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {r.label}
                  </span>
                )}

                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {r.slug}
                </span>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    {editingId === r.id ? (
                      <>
                        <button
                          type="button"
                          disabled={savingId === r.id}
                          onClick={() => saveEdit(r.id)}
                          className="p-1.5 rounded-md text-xs font-medium transition-colors duration-150 disabled:opacity-40"
                          style={{ background: "var(--blue)", color: "white" }}
                        >
                          {savingId === r.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-md transition-colors duration-150"
                          style={{ color: "var(--text-dim)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="p-1.5 rounded-md transition-colors duration-150"
                        style={{ color: "var(--text-dim)" }}
                        title="Editar nombre"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {isAdmin && (
        <Section title="Agregar sucursal" description="El slug se genera automáticamente y no se puede cambiar después">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                  Nombre visible
                </label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setNewSlug(slugify(e.target.value));
                  }}
                  placeholder="Ej. Sucursal Norte"
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] text-sm border focus:outline-none focus:ring-2 focus:border-[var(--blue)] focus:ring-[var(--blue)]/15 placeholder:text-[var(--text-dim)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                  Slug (URL interna)
                </label>
                <input
                  type="text"
                  required
                  value={newSlug}
                  onChange={(e) => setNewSlug(slugify(e.target.value))}
                  placeholder="sucursal-norte"
                  className="w-full px-3 py-1.5 rounded-[var(--radius-sm)] text-sm border font-mono focus:outline-none focus:ring-2 focus:border-[var(--blue)] focus:ring-[var(--blue)]/15 placeholder:text-[var(--text-dim)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            </div>

            {addMsg && (
              <p className="text-sm" style={{ color: addMsg.type === "error" ? "var(--danger)" : "var(--success)" }}>
                {addMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={adding || !newLabel.trim() || !newSlug.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--blue)", color: "white" }}
            >
              {adding && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Agregar sucursal
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}

/* ─── Theme toggle ────────────────────────────────────────────────────── */

function ThemeSection() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setIsDark(next);
  }

  return (
    <Section title="Apariencia" description="Cambia entre modo claro y oscuro">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {isDark ? "Modo oscuro" : "Modo claro"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            La preferencia se guarda en este dispositivo
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Cambiar modo oscuro"
          role="switch"
          aria-checked={isDark}
          className="relative flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none focus-visible:ring-2"
          style={{ background: isDark ? "#1C1C20" : "#E4E4E7", gap: "2px" }}
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300"
            style={{
              background: !isDark ? "var(--blue)" : "transparent",
              color: !isDark ? "white" : "var(--text-dim)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </span>
          <span
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300"
            style={{
              background: isDark ? "var(--blue)" : "transparent",
              color: isDark ? "white" : "var(--text-dim)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
        </button>
      </div>
    </Section>
  );
}

/* ─── Hojas tab ───────────────────────────────────────────────────────── */

function HojasTab() {
  const [registry, setRegistry] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/config/dropdowns")
      .then((r) => r.json())
      .then((d: DropdownsResponse) => setRegistry(d.sheetRegistry ?? {}))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="space-y-3">
        <div className="h-40 rounded-[var(--radius-lg)] animate-pulse" style={{ background: "var(--surface-raised)" }} />
      </div>
    );
  }

  const entries = Object.entries(registry);

  return (
    <div className="space-y-6">
      <Section title="Tutorial" description="Aprende a usar el sistema paso a paso">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Guía interactiva
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Repasa todas las funciones del sistema en menos de 2 minutos
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("startTutorial"))}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold text-white transition-colors duration-150 active:scale-[0.97] flex-shrink-0"
            style={{ background: "var(--blue)" }}
          >
            <span>✨</span>
            Iniciar tutorial
          </button>
        </div>
      </Section>

      <ThemeSection />

      {entries.length === 0 ? (
        <Section title="Hojas de cálculo" description="Hojas de Google Sheets configuradas por sucursal y mes">
          <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
            No hay hojas de cálculo registradas para este grupo.
          </p>
        </Section>
      ) : (
        <Section
          title="Hojas de cálculo registradas"
          description="Hojas de Google Sheets configuradas por sucursal y mes"
        >
          <div
            className="rounded-[var(--radius)] border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="grid gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
                gridTemplateColumns: "1fr 1fr 1fr auto",
              }}
            >
              <span>Sucursal</span>
              <span>Periodo</span>
              <span>ID de hoja</span>
              <span />
            </div>
            {entries.map(([key, spreadsheetId]) => {
              const { restaurant, period } = parseRegistryKey(key);
              const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
              return (
                <div
                  key={key}
                  className="grid items-center gap-3 px-3 py-2.5"
                  style={{
                    background: "var(--surface)",
                    borderTop: "1px solid var(--border-subtle)",
                    gridTemplateColumns: "1fr 1fr 1fr auto",
                  }}
                >
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
                    {restaurant}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {period}
                  </span>
                  <span className="text-xs font-mono truncate" style={{ color: "var(--text-dim)" }}>
                    {spreadsheetId.substring(0, 20)}…
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded transition-colors duration-150 flex-shrink-0 hover-blue-bg"
                    style={{ color: "var(--text-muted)" }}
                    title="Abrir hoja de cálculo"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M2 2h4M11 2v4M11 2L6 7M3.5 5.5H2v5.5h5.5V9"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("equipo");
  const [myUserId, setMyUserId] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    document.title = "Configuración — BOH";
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.role === "admin");
        if (d.userId) setMyUserId(d.userId);
      })
      .catch(() => {});
  }, []);

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="font-display text-3xl md:text-4xl font-bold" style={{ color: "var(--text)" }}>
            Configuración
          </h1>
          <p className="text-base mt-2" style={{ color: "var(--text-muted)" }}>
            Gestiona tu equipo, sucursales y configuración del sistema
          </p>
        </div>

        {/* Tab bar */}
        <div className="animate-fade-up" style={{ animationDelay: "0.03s" }}>
          <TabBar active={tab} onChange={setTab} />
        </div>

        {/* Tab content */}
        <div className="animate-fade-up" style={{ animationDelay: "0.06s" }}>
          {tab === "equipo" && <EquipoTab isAdmin={isAdmin} myUserId={myUserId} />}
          {tab === "sucursales" && <SucursalesTab isAdmin={isAdmin} />}
          {tab === "hojas" && <HojasTab />}
        </div>
      </div>
    </Shell>
  );
}
