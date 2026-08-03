// Reprocessa o texto de mensagens que ficaram como "[mensagem sem texto]".
//
// O webhook tinha um extrator pobre (só texto simples), então mensagens de
// negócio — menu, botão, catálogo, que é o formato que bot de atendimento
// usa — foram gravadas sem conteúdo. Com o extrator compartilhado
// (lib/whatsapp-message.ts), dá para recuperar o texto puxando o payload
// original da Evolution, que mantém o histórico.
//
// Uso:
//   node scripts/backfill-message-text.mjs --dry-run
//   node scripts/backfill-message-text.mjs

import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const PLACEHOLDER = "[mensagem sem texto]";

// Carrega o extrator direto do .ts para nao duplicar a logica aqui.
const extractorPath = path.resolve("src/lib/whatsapp-message.ts");
const compiled = ts.transpileModule(fs.readFileSync(extractorPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const extractorModule = new Module(extractorPath);
extractorModule.filename = extractorPath;
extractorModule.paths = Module._nodeModulePaths(path.dirname(extractorPath));
extractorModule._compile(compiled, extractorPath);
const { extractWhatsAppText } = extractorModule.exports;

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
const HEADERS = {
  "Content-Type": "application/json",
  apikey: env.EVOLUTION_API_KEY,
};

async function fetchOriginal(remoteJid, providerMessageId) {
  const response = await fetch(
    `${EVOLUTION_BASE}/chat/findMessages/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        where: { key: { remoteJid, id: providerMessageId } },
        limit: 1,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const records = data?.messages?.records ?? data?.records ?? (Array.isArray(data) ? data : []);
  return records[0] ?? null;
}

const { data: rows, error } = await supabase
  .from("crm_whatsapp_mensagens")
  .select("id, remote_jid, provider_message_id")
  .eq("conteudo", PLACEHOLDER)
  .not("provider_message_id", "is", null);

if (error) throw new Error(error.message);

console.log(`Mensagens sem texto: ${rows.length}`);
if (DRY_RUN) console.log("(dry-run: nada será alterado)\n");

let recuperadas = 0;
let semPayload = 0;
let semTextoMesmoAssim = 0;

for (const row of rows) {
  const original = await fetchOriginal(row.remote_jid, row.provider_message_id);
  if (!original?.message) {
    semPayload += 1;
    continue;
  }

  const texto = extractWhatsAppText(original.message);
  if (!texto) {
    semTextoMesmoAssim += 1;
    console.log(`  sem texto mesmo assim: ${original.messageType}`);
    continue;
  }

  console.log(`  ${original.messageType}: ${texto.replace(/\n/g, " ").slice(0, 60)}`);

  if (!DRY_RUN) {
    // Guarda o payload junto: as linhas antigas foram gravadas antes da
    // coluna raw existir.
    await supabase
      .from("crm_whatsapp_mensagens")
      .update({ conteudo: texto, raw: original })
      .eq("id", row.id);
  }

  recuperadas += 1;
}

// A prévia da conversa também ficou com o placeholder.
if (!DRY_RUN) {
  const { data: chats } = await supabase
    .from("crm_whatsapp_chats")
    .select("remote_jid")
    .eq("last_message_preview", PLACEHOLDER);

  for (const chat of chats ?? []) {
    const { data: last } = await supabase
      .from("crm_whatsapp_mensagens")
      .select("conteudo")
      .eq("remote_jid", chat.remote_jid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last?.conteudo && last.conteudo !== PLACEHOLDER) {
      await supabase
        .from("crm_whatsapp_chats")
        .update({ last_message_preview: last.conteudo.slice(0, 140) })
        .eq("remote_jid", chat.remote_jid);
    }
  }
}

console.log(
  `\nResumo: ${recuperadas} recuperadas, ${semTextoMesmoAssim} sem texto extraível, ${semPayload} sem payload na Evolution.`,
);
