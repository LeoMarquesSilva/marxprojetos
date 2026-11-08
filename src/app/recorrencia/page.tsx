import { redirect } from "next/navigation";

// A recorrência virou uma aba de Finanças; o endereço antigo continua valendo.
export default function RecorrenciaRedirect() {
  redirect("/financas/recorrencia");
}
