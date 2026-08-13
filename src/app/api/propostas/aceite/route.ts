import { after, NextResponse } from "next/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsAppText } from "@/lib/evolution";
import { phoneToRemoteJid } from "@/lib/phone";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// O aceite passou a vir por aqui, e não mais direto do navegador, porque
// aceitar agora dispara um aviso no meu WhatsApp — e a chave da Evolution
// não pode existir no bundle do cliente.
//
// O aceite em si continua saindo da mesma RPC pública de antes: a rota usa o
// client anônimo, sem service-role. Ou seja, esta rota não consegue fazer
// nada que o navegador já não pudesse; ela só ganha o lado do envio.

/** Onde o aviso cai. Cai no número do site se não houver variável própria. */
async function resolveNotifyNumber(): Promise<string | null> {
  const fromEnv = process.env.PROPOSAL_NOTIFY_WHATSAPP?.replace(/\D/g, "");
  if (fromEnv) return fromEnv;

  // Mesmo número que já aparece nos CTAs do portfólio — evita ter o telefone
  // escrito no código de um repositório público e uma variável a mais para
  // configurar.
  const admin = createAdminClient();
  const { data } = await admin
    .from("portfolio_site_settings")
    .select("whatsapp_number")
    .limit(1)
    .maybeSingle();

  return data?.whatsapp_number ?? null;
}

function buildMessage(proposal: {
  id: string;
  title: string;
  client_name: string;
  accepted_by_name: string | null;
  accepted_at: string;
}): string {
  const quando = format(
    new Date(proposal.accepted_at),
    "d 'de' MMMM 'às' HH:mm",
    { locale: ptBR },
  );

  return [
    "✅ Proposta aceita",
    "",
    proposal.client_name,
    proposal.title,
    "",
    proposal.accepted_by_name
      ? `Confirmada por ${proposal.accepted_by_name}`
      : "Confirmada",
    quando,
    "",
    absoluteUrl(`/propostas/${proposal.id}`),
  ].join("\n");
}

async function notifyAcceptance(token: string): Promise<void> {
  const admin = createAdminClient();

  // Reserva o aviso antes de mandar. `accept_proposal` devolve o accepted_at
  // atual mesmo quando a proposta já estava aceita, então ela não distingue
  // "aceitei agora" de "já estava aceita" — sem esta reserva, um reload ou
  // um retry de rede mandaria a mensagem de novo.
  const { data: claimed, error } = await admin
    .from("proposals")
    .update({ accept_notified_at: new Date().toISOString() })
    .eq("token", token)
    .not("accepted_at", "is", null)
    .is("accept_notified_at", null)
    .select("id, title, client_name, accepted_by_name, accepted_at")
    .maybeSingle();

  if (error) {
    console.error("[proposta] não consegui reservar o aviso de aceite:", error);
    return;
  }
  // Outra chamada já avisou — nada a fazer.
  if (!claimed) return;

  try {
    const number = await resolveNotifyNumber();
    if (!number) {
      throw new Error(
        "sem número de destino: defina PROPOSAL_NOTIFY_WHATSAPP ou o WhatsApp nas configurações do site",
      );
    }

    await sendWhatsAppText(
      phoneToRemoteJid(number),
      buildMessage({
        id: claimed.id,
        title: claimed.title,
        client_name: claimed.client_name,
        accepted_by_name: claimed.accepted_by_name,
        accepted_at: claimed.accepted_at,
      }),
    );
  } catch (sendError) {
    console.error("[proposta] falhei ao avisar o aceite no WhatsApp:", sendError);
    // Devolve a reserva: melhor a proposta ficar marcada como "não avisada"
    // — e a próxima tentativa poder mandar — do que constar avisada sem que
    // mensagem nenhuma tenha saído.
    await admin
      .from("proposals")
      .update({ accept_notified_at: null })
      .eq("id", claimed.id);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    name?: unknown;
  } | null;

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!token || !name) {
    return NextResponse.json(
      { error: "Informe o token da proposta e o seu nome." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_proposal", {
    p_token: token,
    p_name: name,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: "Não consegui registrar o aceite." },
      { status: 400 },
    );
  }

  // Depois da resposta: o cliente não fica olhando um spinner enquanto a
  // Evolution responde, e uma falha no envio nunca transforma um aceite que
  // deu certo em erro na tela dele.
  after(() => notifyAcceptance(token));

  return NextResponse.json({ acceptedAt: data as string });
}
