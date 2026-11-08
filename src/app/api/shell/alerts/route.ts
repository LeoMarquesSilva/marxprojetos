import { NextResponse } from "next/server";
import { getShellAlerts } from "@/lib/shell-data";

// Leitura em rota própria, não em server action: ações entram numa fila única e uma
// navigation pode descartá-las, deixando quem espera sem resposta.
export async function GET() {
  return NextResponse.json(await getShellAlerts());
}
