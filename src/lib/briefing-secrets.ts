import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Respostas do tipo "secret" (senhas de painéis, registro de domínio) nunca
// vão para o banco em texto puro: são cifradas com AES-256-GCM antes da RPC
// de gravação e só voltam legíveis numa Server Action autenticada.
//
// A chave é derivada da service role key, que já existe em todo ambiente que
// grava briefings. Trocar a service role key torna ilegíveis os segredos
// gravados antes — aceitável, porque esses acessos são temporários (servem à
// migração) e o cliente pode reenviá-los.
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente: não há como cifrar.");
  }
  return Buffer.from(
    hkdfSync("sha256", base, "insyt-briefing-secrets", "v1", 32),
  );
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) throw new Error("Valor não cifrado.");

  const [iv, tag, encrypted] = value.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
