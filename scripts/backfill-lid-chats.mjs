// Funde as conversas "@lid" órfãs na conversa de telefone correspondente.
//
// O WhatsApp passou a endereçar respostas por LID (identificador opaco). Até
// o webhook aprender a ler key.remoteJidAlt, essas respostas criaram threads
// separadas e sem vínculo com o cliente — o CRM mostrava "última mensagem:
// sua" mesmo com o lead tendo respondido.
//
// Este script consulta a Evolution (que guarda o histórico), lê o
// remoteJidAlt de cada mensagem LID e remaneja as linhas para o JID de
// telefone. Idempotente: rodar de novo não duplica nada.
//
// Uso:
//   node scripts/backfill-lid-chats.mjs --dry-run   (só relata)
//   node scripts/backfill-lid-chats.mjs             (aplica)

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const EVOLUTION_BASE = env.EVOLUTION_API_URL.replace(/\/+$/, "");
const INSTANCE = env.EVOLUTION_INSTANCE;

async function findMessagesForJid(remoteJid) {
  const response = await fetch(
    `${EVOLUTION_BASE}/chat/findMessages/${encodeURIComponent(INSTANCE)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify({ where: { key: { remoteJid } }, limit: 50 }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return data?.messages?.records ?? data?.records ?? (Array.isArray(data) ? data : []);
}

function phoneJidFromRecords(records) {
  for (const record of records) {
    const alt = record?.key?.remoteJidAlt;
    if (alt && !alt.endsWith("@lid")) return alt;
  }
  return null;
}

const { data: lidChats, error } = await supabase
  .from("crm_whatsapp_chats")
  .select("remote_jid, client_id, unread_count, last_message_at, last_message_preview")
  .like("remote_jid", "%@lid");

if (error) throw new Error(error.message);

console.log(`Conversas @lid encontradas: ${lidChats.length}`);
if (DRY_RUN) console.log("(dry-run: nada será alterado)\n");

let fundidas = 0;
let semTelefone = 0;
let mensagensMovidas = 0;

for (const chat of lidChats) {
  const records = await findMessagesForJid(chat.remote_jid);
  const phoneJid = phoneJidFromRecords(records);

  if (!phoneJid) {
    semTelefone += 1;
    console.log(`  ${chat.remote_jid} -> sem remoteJidAlt, mantida como está`);
    continue;
  }

  const { count: msgCount } = await supabase
    .from("crm_whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("remote_jid", chat.remote_jid);

  console.log(
    `  ${chat.remote_jid} -> ${phoneJid} (${msgCount ?? 0} msgs)${DRY_RUN ? "" : " ..."}`,
  );

  if (DRY_RUN) {
    fundidas += 1;
    mensagensMovidas += msgCount ?? 0;
    continue;
  }

  // Garante a conversa de destino antes de mover as mensagens (FK).
  const { data: target } = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid, client_id, unread_count, last_message_at")
    .eq("remote_jid", phoneJid)
    .maybeSingle();

  if (!target) {
    await supabase.from("crm_whatsapp_chats").insert({
      remote_jid: phoneJid,
      client_id: chat.client_id,
      lid_jid: chat.remote_jid,
      last_message_at: chat.last_message_at,
      last_message_preview: chat.last_message_preview,
      unread_count: chat.unread_count ?? 0,
    });
  } else {
    // Mantém a data da mensagem mais recente entre as duas threads.
    const newerAt =
      new Date(chat.last_message_at ?? 0) > new Date(target.last_message_at ?? 0)
        ? {
            last_message_at: chat.last_message_at,
            last_message_preview: chat.last_message_preview,
          }
        : {};

    await supabase
      .from("crm_whatsapp_chats")
      .update({
        lid_jid: chat.remote_jid,
        client_id: target.client_id ?? chat.client_id,
        unread_count: (target.unread_count ?? 0) + (chat.unread_count ?? 0),
        ...newerAt,
      })
      .eq("remote_jid", phoneJid);
  }

  const { data: targetClient } = await supabase
    .from("crm_whatsapp_chats")
    .select("client_id")
    .eq("remote_jid", phoneJid)
    .maybeSingle();

  const { error: moveError } = await supabase
    .from("crm_whatsapp_mensagens")
    .update({ remote_jid: phoneJid, client_id: targetClient?.client_id ?? null })
    .eq("remote_jid", chat.remote_jid);

  if (moveError) {
    console.log(`     ERRO ao mover mensagens: ${moveError.message}`);
    continue;
  }

  await supabase
    .from("crm_whatsapp_chats")
    .delete()
    .eq("remote_jid", chat.remote_jid);

  fundidas += 1;
  mensagensMovidas += msgCount ?? 0;
}

console.log(
  `\nResumo: ${fundidas} conversas fundidas, ${mensagensMovidas} mensagens remanejadas, ${semTelefone} sem telefone resolvível.`,
);
