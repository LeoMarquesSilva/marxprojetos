/** Só o conteúdo da aba: o menu e o cabeçalho continuam na tela. */
export default function FinanceLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-6">
      <div className="h-44 animate-pulse rounded-2xl bg-[var(--insyt-canvas)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-[var(--insyt-canvas)]" />
        <div className="h-72 animate-pulse rounded-2xl bg-[var(--insyt-canvas)]" />
      </div>
    </div>
  );
}
