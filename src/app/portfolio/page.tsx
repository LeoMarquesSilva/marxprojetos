import { redirect } from "next/navigation";

// O portfólio virou a página inicial do domínio. Este redirect mantém
// funcionando qualquer link /portfolio já enviado para um lead, e concentra
// o conteúdo em uma URL só. Temporário (307) de propósito: um permanente
// fica em cache no navegador e é difícil de desfazer.
export default function LegacyPortfolioPage() {
  redirect("/");
}
