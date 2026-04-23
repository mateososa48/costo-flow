export default function OnboardPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Bienvenido a BOH
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Tu cuenta fue verificada, pero aún no tienes acceso a ningún grupo de restaurantes.
          Contacta a tu administrador para que te agregue al equipo.
        </p>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Si crees que esto es un error, escribe a soporte.
        </p>
      </div>
    </main>
  );
}
