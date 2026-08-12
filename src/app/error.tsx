"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Não foi possível carregar</h1>
      <p className="text-muted-foreground">
        Ocorreu um erro inesperado. Tente novamente.
      </p>
      <button
        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        onClick={() => unstable_retry()}
        type="button"
      >
        Tentar novamente
      </button>
    </main>
  );
}
