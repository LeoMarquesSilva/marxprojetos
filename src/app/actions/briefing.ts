"use server";

import { createClient } from "@/lib/supabase/server";

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
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_briefing", {
    p_token: input.token,
    p_answers: input.answers,
    p_client_name: input.clientName ?? null,
    p_client_email: input.clientEmail ?? null,
  });

  if (error) return { error: error.message };
  return { submissionId: data as string };
}
