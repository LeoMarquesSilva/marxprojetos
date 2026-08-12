export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando conteúdo"
      className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col gap-6 px-6 py-10"
    >
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="h-36 animate-pulse rounded-2xl border bg-muted/50"
            key={index}
          />
        ))}
      </div>
    </main>
  );
}
