const SAFE_SEND_ERROR = "Não foi possível enviar a mensagem pelo WhatsApp.";
const SAFE_RECONCILIATION_TIMEOUT_ERROR =
  "Não foi possível confirmar o envio da mensagem.";
const PERSISTENCE_ATTEMPTS = 3;
const RECONCILIATION_MATCH_WINDOW_MS = 5 * 60 * 1000;
const RECONCILIATION_TIMEOUT_MS = 30 * 60 * 1000;

type OutboxMessage = {
  id: string;
};

type OutboxDependencies<TMessage extends OutboxMessage> = {
  createPending: () => Promise<TMessage>;
  send: () => Promise<{ providerMessageId: string | null }>;
  markSent: (
    id: string,
    providerMessageId: string | null,
  ) => Promise<TMessage>;
  markError: (id: string, safeError: string) => Promise<TMessage>;
};

type FinalizationDependencies<TMessage> = {
  providerMessageId: string | null;
  finalizePending: () => Promise<TMessage>;
  findProviderMessage: () => Promise<TMessage | null>;
  adoptProviderMessage: (providerMessage: TMessage) => Promise<TMessage>;
  removePendingDuplicate: (providerMessage: TMessage) => Promise<void>;
};

export type PendingOutgoingReconciliationMessage = {
  id: string;
  remoteJid: string;
  clientId: string | null;
  text: string;
  createdAt: string;
  providerMessageId: string | null;
};

export type OutgoingReconciliationCandidate = {
  providerMessageId: string;
  remoteJid: string;
  fromMe: boolean;
  content: string | null;
  createdAt: string;
  status: string;
};

type PendingReconciliationDependencies = {
  now?: Date;
  listPending: () => Promise<PendingOutgoingReconciliationMessage[]>;
  findRecent: (
    remoteJid: string,
  ) => Promise<OutgoingReconciliationCandidate[]>;
  finalizeMatch: (
    pending: PendingOutgoingReconciliationMessage,
    match: OutgoingReconciliationCandidate,
  ) => Promise<void>;
  markExpired: (
    pending: PendingOutgoingReconciliationMessage,
    safeError: string,
  ) => Promise<void>;
};

const CONFIRMED_OUTGOING_STATUSES = new Set([
  "server_ack",
  "delivery_ack",
  "read",
  "played",
]);
const OUTGOING_STATUS_RANK: Record<string, number> = {
  server_ack: 1,
  delivery_ack: 2,
  read: 3,
  played: 4,
};

export function chooseFinalOutgoingStatus(currentStatus: string): string {
  return CONFIRMED_OUTGOING_STATUSES.has(currentStatus)
    ? currentStatus
    : "server_ack";
}

export function chooseMostAdvancedOutgoingStatus(
  currentStatus: string,
  nextStatus: string,
): string {
  const current = chooseFinalOutgoingStatus(currentStatus);
  const next = chooseFinalOutgoingStatus(nextStatus);
  return OUTGOING_STATUS_RANK[next] > OUTGOING_STATUS_RANK[current]
    ? next
    : current;
}

async function retryPersistence<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < PERSISTENCE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function finalizeOutgoingMessageIdempotently<TMessage>({
  providerMessageId,
  finalizePending,
  findProviderMessage,
  adoptProviderMessage,
  removePendingDuplicate,
}: FinalizationDependencies<TMessage>): Promise<TMessage> {
  try {
    return await finalizePending();
  } catch (finalizeError) {
    if (!providerMessageId) throw finalizeError;

    const providerMessage = await findProviderMessage();
    if (!providerMessage) throw finalizeError;

    const adopted = await adoptProviderMessage(providerMessage);
    await removePendingDuplicate(adopted);
    return adopted;
  }
}

function isWithinMatchWindow(
  pending: PendingOutgoingReconciliationMessage,
  candidate: OutgoingReconciliationCandidate,
): boolean {
  const pendingAt = new Date(pending.createdAt).getTime();
  const candidateAt = new Date(candidate.createdAt).getTime();
  return (
    Number.isFinite(pendingAt) &&
    Number.isFinite(candidateAt) &&
    Math.abs(candidateAt - pendingAt) <= RECONCILIATION_MATCH_WINDOW_MS
  );
}

function findUnequivocalMatches(
  pendingMessages: PendingOutgoingReconciliationMessage[],
  recentMessages: OutgoingReconciliationCandidate[],
): Map<string, OutgoingReconciliationCandidate> {
  const uniqueCandidates = [
    ...new Map(
      recentMessages.map((message) => [message.providerMessageId, message]),
    ).values(),
  ];
  const candidatesByPending = new Map<
    string,
    OutgoingReconciliationCandidate[]
  >();
  const pendingIdsByCandidate = new Map<string, string[]>();

  for (const pending of pendingMessages) {
    const candidates = uniqueCandidates.filter((candidate) => {
      if (
        !candidate.fromMe ||
        candidate.remoteJid !== pending.remoteJid ||
        candidate.content !== pending.text ||
        !isWithinMatchWindow(pending, candidate)
      ) {
        return false;
      }
      return (
        !pending.providerMessageId ||
        candidate.providerMessageId === pending.providerMessageId
      );
    });

    candidatesByPending.set(pending.id, candidates);
    for (const candidate of candidates) {
      const pendingIds =
        pendingIdsByCandidate.get(candidate.providerMessageId) ?? [];
      pendingIds.push(pending.id);
      pendingIdsByCandidate.set(candidate.providerMessageId, pendingIds);
    }
  }

  const matches = new Map<string, OutgoingReconciliationCandidate>();
  for (const pending of pendingMessages) {
    const candidates = candidatesByPending.get(pending.id) ?? [];
    const candidate = candidates[0];
    if (
      candidates.length === 1 &&
      candidate &&
      pendingIdsByCandidate.get(candidate.providerMessageId)?.length === 1
    ) {
      matches.set(pending.id, candidate);
    }
  }
  return matches;
}

export async function reconcilePendingOutgoingMessages({
  now = new Date(),
  listPending,
  findRecent,
  finalizeMatch,
  markExpired,
}: PendingReconciliationDependencies): Promise<{
  reconciled: number;
  expired: number;
  errors: string[];
}> {
  const pendingMessages = await listPending();
  const pendingByRemoteJid = new Map<
    string,
    PendingOutgoingReconciliationMessage[]
  >();

  for (const pending of pendingMessages) {
    const group = pendingByRemoteJid.get(pending.remoteJid) ?? [];
    group.push(pending);
    pendingByRemoteJid.set(pending.remoteJid, group);
  }

  let reconciled = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const [remoteJid, group] of pendingByRemoteJid) {
    let recentMessages: OutgoingReconciliationCandidate[];
    try {
      recentMessages = await findRecent(remoteJid);
    } catch {
      errors.push(`Falha ao consultar mensagens recentes de ${remoteJid}.`);
      continue;
    }

    const matches = findUnequivocalMatches(group, recentMessages);
    const attemptedMatches = new Set<string>();
    const reconciledIds = new Set<string>();

    for (const pending of group) {
      const match = matches.get(pending.id);
      if (!match) continue;
      attemptedMatches.add(pending.id);
      try {
        await finalizeMatch(pending, match);
        reconciledIds.add(pending.id);
        reconciled += 1;
      } catch {
        errors.push("Falha ao reconciliar uma mensagem pendente.");
      }
    }

    for (const pending of group) {
      if (
        reconciledIds.has(pending.id) ||
        attemptedMatches.has(pending.id)
      ) {
        continue;
      }
      const createdAt = new Date(pending.createdAt).getTime();
      if (
        !Number.isFinite(createdAt) ||
        now.getTime() - createdAt < RECONCILIATION_TIMEOUT_MS
      ) {
        continue;
      }
      try {
        await markExpired(pending, SAFE_RECONCILIATION_TIMEOUT_ERROR);
        expired += 1;
      } catch {
        errors.push("Falha ao expirar uma mensagem pendente.");
      }
    }
  }

  return { reconciled, expired, errors };
}

export async function runOutgoingMessageOutbox<TMessage extends OutboxMessage>({
  createPending,
  send,
  markSent,
  markError,
}: OutboxDependencies<TMessage>): Promise<
  | { success: true; message: TMessage; reconciliationPending?: true }
  | { error: string }
> {
  const pending = await createPending();

  let providerMessageId: string | null;
  try {
    ({ providerMessageId } = await send());
  } catch {
    await retryPersistence(() => markError(pending.id, SAFE_SEND_ERROR)).catch(
      () => undefined,
    );
    return { error: SAFE_SEND_ERROR };
  }

  try {
    const message = await retryPersistence(() =>
      markSent(pending.id, providerMessageId),
    );
    return { success: true, message };
  } catch {
    // A mensagem já saiu pela Evolution. Mantemos o registro pending para
    // reconciliação, sem induzir o usuário a reenviar e gerar duplicidade.
    return {
      success: true,
      message: pending,
      reconciliationPending: true,
    };
  }
}

