type EvolutionMessageKey = {
  remoteJid?: unknown;
  remoteJidAlt?: unknown;
  senderPn?: unknown;
};

type EvolutionMessagePage = {
  records: unknown[];
  totalPages: number;
  currentPage: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asJid(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const jid = value.trim();
  if (jid.includes("@")) return jid;
  return /^\d+$/.test(jid) ? `${jid}@s.whatsapp.net` : null;
}

export function resolveEvolutionMessageJid(
  key: EvolutionMessageKey,
): { remoteJid: string; lidJid: string | null } | null {
  const primary = asJid(key.remoteJid);
  if (!primary) return null;
  if (!primary.endsWith("@lid")) {
    return { remoteJid: primary, lidJid: null };
  }

  const phoneJid = [key.remoteJidAlt, key.senderPn]
    .map(asJid)
    .find((candidate) => candidate && !candidate.endsWith("@lid"));

  return {
    remoteJid: phoneJid ?? primary,
    lidJid: primary,
  };
}

export function buildFindMessagesBody(
  remoteJid: string,
  offset: number,
  page: number,
) {
  return {
    where: { key: { remoteJid } },
    offset,
    page,
  };
}

export function latestEvolutionMessageStatus(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) return null;

  const updates = Array.isArray(record.MessageUpdate)
    ? record.MessageUpdate
    : Array.isArray(record.messageUpdate)
      ? record.messageUpdate
      : [];
  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const status = asRecord(updates[index])?.status;
    if (typeof status === "string" && status) return status.toLowerCase();
  }

  return typeof record.status === "string"
    ? record.status.toLowerCase()
    : null;
}

export function normalizeEvolutionMessagePage(
  data: unknown,
): EvolutionMessagePage {
  if (Array.isArray(data)) {
    return { records: data, totalPages: 1, currentPage: 1 };
  }

  const root = asRecord(data);
  if (!root) return { records: [], totalPages: 1, currentPage: 1 };

  const messages = asRecord(root.messages);
  if (messages && Array.isArray(messages.records)) {
    return {
      records: messages.records,
      totalPages:
        typeof messages.pages === "number" && messages.pages > 0
          ? messages.pages
          : 1,
      currentPage:
        typeof messages.currentPage === "number" &&
        messages.currentPage > 0
          ? messages.currentPage
          : 1,
    };
  }

  const records = [root.messages, root.data, root.records].find(Array.isArray);
  return {
    records: records ?? [],
    totalPages: 1,
    currentPage: 1,
  };
}
