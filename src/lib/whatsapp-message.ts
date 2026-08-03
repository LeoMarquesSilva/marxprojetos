// Extração do texto de uma mensagem do WhatsApp (formato Baileys/Evolution).
//
// Existia uma cópia no webhook e outra em lib/evolution.ts, e elas
// divergiram: a do webhook só entendia texto simples, então 43 das
// mensagens recebidas viraram "[mensagem sem texto]" no CRM. Um módulo só,
// usado pelos dois caminhos (webhook e sync), evita a divergência voltar.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

// O WhatsApp embrulha a mensagem real quando ela é temporária, de
// visualização única ou editada. Sem desembrulhar, qualquer conteúdo dentro
// desses invólucros vira "sem texto".
const WRAPPERS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
  "editedMessage",
  "protocolMessage",
] as const;

function unwrap(message: Record<string, unknown>): Record<string, unknown> {
  for (const wrapper of WRAPPERS) {
    const inner = asRecord(message[wrapper]);
    const innerMessage = asRecord(inner?.message);
    if (innerMessage) return unwrap(innerMessage);
  }
  return message;
}

/**
 * Devolve o texto exibível da mensagem, ou null quando ela não deve virar
 * bolha na conversa (reação, por exemplo — essa atualiza a mensagem alvo).
 */
export function extractWhatsAppText(rawMessage: unknown): string | null {
  const outer = asRecord(rawMessage);
  if (!outer) return null;
  const message = unwrap(outer);

  // Reação não é mensagem: quem trata é o fluxo de reações.
  if (message.reactionMessage) return null;

  const direct = nonEmptyString(message.conversation);
  if (direct) return direct;

  const extended = nonEmptyString(asRecord(message.extendedTextMessage)?.text);
  if (extended) return extended;

  // Mensagens de negócio (menu, botão, catálogo). Eram a maior fatia das
  // que apareciam como "[mensagem sem texto]" — é o formato que bot de
  // atendimento usa para responder.
  const interactive = asRecord(message.interactiveMessage);
  if (interactive) {
    const body = nonEmptyString(asRecord(interactive.body)?.text);
    if (body) return body;
    const footer = nonEmptyString(asRecord(interactive.footer)?.text);
    if (footer) return footer;
    return "[mensagem interativa]";
  }

  const template = asRecord(message.templateMessage);
  if (template) {
    const hydrated =
      asRecord(template.hydratedFourRowTemplate) ??
      asRecord(template.hydratedTemplate);
    const content = nonEmptyString(hydrated?.hydratedContentText);
    if (content) return content;
    const title = nonEmptyString(hydrated?.hydratedTitleText);
    if (title) return title;
    return "[mensagem com botões]";
  }

  // Respostas do contato a botões/listas: o que ele escolheu é a resposta.
  const buttonReply = nonEmptyString(
    asRecord(message.buttonsResponseMessage)?.selectedDisplayText,
  );
  if (buttonReply) return buttonReply;

  const listReply = nonEmptyString(
    asRecord(message.listResponseMessage)?.title,
  );
  if (listReply) return listReply;

  const templateReply = nonEmptyString(
    asRecord(message.templateButtonReplyMessage)?.selectedDisplayText,
  );
  if (templateReply) return templateReply;

  const interactiveReply = asRecord(message.interactiveResponseMessage);
  if (interactiveReply) {
    const body = nonEmptyString(asRecord(interactiveReply.body)?.text);
    if (body) return body;
    return "[resposta de menu]";
  }

  const buttons = asRecord(message.buttonsMessage);
  if (buttons) {
    const text =
      nonEmptyString(buttons.contentText) ?? nonEmptyString(buttons.footerText);
    if (text) return text;
    return "[mensagem com botões]";
  }

  const list = asRecord(message.listMessage);
  if (list) {
    const text =
      nonEmptyString(list.description) ?? nonEmptyString(list.title);
    if (text) return text;
    return "[lista de opções]";
  }

  // Mídia: legenda quando existe, senão um rótulo do tipo.
  const image = asRecord(message.imageMessage);
  if (image) return nonEmptyString(image.caption) ?? "[imagem]";

  const video = asRecord(message.videoMessage);
  if (video) return nonEmptyString(video.caption) ?? "[vídeo]";

  const document = asRecord(message.documentMessage);
  if (document) {
    const name = nonEmptyString(document.fileName);
    return name ? `[documento: ${name}]` : "[documento]";
  }

  if (message.audioMessage) return "[áudio]";
  if (message.stickerMessage) return "[figurinha]";
  if (message.contactMessage || message.contactsArrayMessage) return "[contato]";
  if (message.locationMessage || message.liveLocationMessage) {
    return "[localização]";
  }

  const poll = asRecord(message.pollCreationMessage);
  if (poll) {
    const name = nonEmptyString(poll.name);
    return name ? `[enquete: ${name}]` : "[enquete]";
  }

  if (message.pollUpdateMessage) return "[voto em enquete]";
  if (message.orderMessage) return "[pedido]";
  if (message.productMessage) return "[produto]";

  return null;
}
