"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidEmailAddress,
  validateAndNormalizeBriefingAnswers,
} from "@/lib/flow-utils";

export type PublicBriefing = {
  id: string;
  title: string;
  welcome_message: string | null;
  questions: unknown;
  status: string;
  client_name: string | null;
  client_email: string | null;
  already_submitted: boolean;
};

export async function fetchBriefingByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_briefing_by_token", {
    p_token: token,
  });

  if (error || !data) return null;
  return data as PublicBriefing;
}

export async function submitBriefing(input: {
  token: string;
  answers: Record<string, unknown>;
  clientName?: string;
  clientEmail?: string;
}): Promise<
  | { error: string; submissionId?: never }
  | { error?: never; submissionId: string }
> {
  // A RPC de gravação aceita apenas service_role. A validação pública passa
  // obrigatoriamente por esta Server Action antes de tocar no banco.
  const supabase = createAdminClient();

  const { data: briefingData, error: briefingError } = await supabase.rpc(
    "get_briefing_by_token",
    {
      p_token: input.token,
    },
  );
  if (briefingError || !briefingData) {
    return { error: "Briefing indisponível ou link inválido." };
  }

  const briefing = briefingData as Partial<PublicBriefing>;
  if (briefing.already_submitted) {
    return { error: "Este briefing já foi respondido." };
  }

  const validation = validateAndNormalizeBriefingAnswers(
    briefing.questions,
    input.answers,
  );
  if ("error" in validation) return validation;

  const clientEmail =
    typeof input.clientEmail === "string" ? input.clientEmail.trim() : "";
  if (clientEmail && !isValidEmailAddress(clientEmail)) {
    return { error: "Informe um e-mail válido em: Seus dados" };
  }

  const { data, error } = await supabase.rpc("submit_briefing", {
    p_token: input.token,
    p_answers: validation.answers,
    p_client_name:
      typeof input.clientName === "string" ? input.clientName : null,
    p_client_email: clientEmail || null,
  });

  if (error) {
    return {
      error:
        "Não foi possível enviar o briefing. Verifique o link e tente novamente.",
    };
  }
  return { submissionId: data as string };
}
