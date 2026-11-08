export type ShellAlert = {
  id: string;
  tone: "late" | "info";
  title: string;
  detail: string;
  href: string;
};

export type SearchResult = {
  id: string;
  kind: "Projeto" | "Cliente" | "Proposta";
  title: string;
  detail: string | null;
  href: string;
};
