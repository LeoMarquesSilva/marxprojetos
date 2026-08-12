import type { CrmStage } from "@/types/crm";

type CrmStagePatch = {
  stage: CrmStage;
  updated_at: string;
  lost_reason?: string;
};

export function buildCrmStagePatch(
  stage: CrmStage,
  lostReason: string | null | undefined,
  updatedAt: string,
): { error: string } | { patch: CrmStagePatch } {
  if (stage !== "perdido") {
    return { patch: { stage, updated_at: updatedAt } };
  }

  const normalizedLostReason = lostReason?.trim() ?? "";
  if (!normalizedLostReason) {
    return { error: "Informe o motivo da perda." };
  }

  return {
    patch: {
      stage,
      lost_reason: normalizedLostReason,
      updated_at: updatedAt,
    },
  };
}

export type CrmClientUpdateFields = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  value?: number | null;
  lost_reason?: string | null;
};

type CrmClientUpdatePatch = CrmClientUpdateFields & {
  updated_at: string;
};

export function buildCrmClientUpdatePatch(
  input: CrmClientUpdateFields,
  currentStage: CrmStage | undefined,
  updatedAt: string,
):
  | { error: string }
  | { requiresCurrentStage: true }
  | { patch: CrmClientUpdatePatch; requiresNonLostStage?: true } {
  if (!Object.hasOwn(input, "lost_reason")) {
    return { patch: { ...input, updated_at: updatedAt } };
  }

  const normalizedLostReason =
    typeof input.lost_reason === "string" ? input.lost_reason.trim() : "";
  if (normalizedLostReason) {
    return {
      patch: {
        ...input,
        lost_reason: normalizedLostReason,
        updated_at: updatedAt,
      },
    };
  }

  if (currentStage === undefined) return { requiresCurrentStage: true };
  if (currentStage === "perdido") {
    return { error: "Informe o motivo da perda." };
  }

  return {
    patch: {
      ...input,
      lost_reason: null,
      updated_at: updatedAt,
    },
    requiresNonLostStage: true,
  };
}

export function getBrasiliaStoredDayStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const date = `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;

  // Datas de próximo passo são persistidas como YYYY-MM-DDT12:00:00Z.
  // O limite usa a data civil de Brasília no mesmo formato para que hoje
  // inteiro permaneça "próximo", independentemente do horário atual.
  return `${date}T12:00:00.000Z`;
}

type ProspectPhoneCandidate = {
  id: string;
  phone: string | null;
  phone_e164: string | null;
  crm_client_id: string | null;
};

function normalizePhoneE164(raw: string): string | null {
  let digits = raw.split("@")[0].replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : null;
}

export function findUnlinkedProspectIdByPhone(
  prospects: ProspectPhoneCandidate[],
  remoteJid: string,
  phone: string,
): string | null {
  const targetPhones = new Set(
    [remoteJid, phone]
      .map((candidate) => normalizePhoneE164(candidate))
      .filter((candidate): candidate is string => Boolean(candidate)),
  );

  if (targetPhones.size === 0) return null;

  for (const prospect of prospects) {
    if (prospect.crm_client_id) continue;
    const normalizedPhones = [prospect.phone_e164, prospect.phone]
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => normalizePhoneE164(candidate));
    if (normalizedPhones.some((candidate) => candidate && targetPhones.has(candidate))) {
      return prospect.id;
    }
  }

  return null;
}
