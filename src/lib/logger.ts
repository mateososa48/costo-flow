/**
 * Structured logger for API routes.
 *
 * In production (Vercel) it emits single-line JSON so logs are indexable.
 * In development it prints human-readable lines.
 */

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  /** Short identifier, e.g. "submit", "parse", "audit-log" */
  ctx: string;
  /** Human-readable message */
  msg: string;
  /** Optional structured data */
  data?: Record<string, unknown>;
  /** Error object (stack is extracted automatically) */
  err?: unknown;
}

const isProd = process.env.NODE_ENV === "production";

function serialize(level: LogLevel, p: LogPayload) {
  const errMsg =
    p.err instanceof Error ? p.err.message : p.err ? String(p.err) : undefined;
  const stack =
    p.err instanceof Error ? p.err.stack?.split("\n").slice(1, 4).join("\n") : undefined;

  if (isProd) {
    // Vercel ingests JSON lines
    return JSON.stringify({
      level,
      ts: new Date().toISOString(),
      ctx: p.ctx,
      msg: p.msg,
      ...(p.data ? { data: p.data } : {}),
      ...(errMsg ? { error: errMsg } : {}),
      ...(stack ? { stack } : {}),
    });
  }

  // Dev: readable format
  const parts = [`[${p.ctx}] ${p.msg}`];
  if (p.data) parts.push(JSON.stringify(p.data));
  if (errMsg) parts.push(`Error: ${errMsg}`);
  return parts.join(" — ");
}

const log = {
  info(p: LogPayload) {
    console.log(serialize("info", p));
  },
  warn(p: LogPayload) {
    console.warn(serialize("warn", p));
  },
  error(p: LogPayload) {
    console.error(serialize("error", p));
  },
};

export default log;
