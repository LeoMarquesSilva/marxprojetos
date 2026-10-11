// Parser CSV simples que respeita aspas com vírgulas internas (ex: endereço),
// usado para importar exports do LocalProspects (ou qualquer CSV similar) sem
// gastar créditos da API de busca.

const BOM = String.fromCharCode(0xfeff);

// Excel em português salva CSV com ";" (a vírgula é o separador decimal).
// O cabeçalho diz qual separador o arquivo usa.
function detectDelimiter(text: string): string {
  const lineEnd = text.search(/\r?\n/);
  const firstLine = lineEnd === -1 ? text : text.slice(0, lineEnd);
  const counts = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ",";
}

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.startsWith(BOM) ? text.slice(1) : text; // remove BOM, se houver
  const delimiter = detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const SOCIAL_ONLY_HINTS = [
  "cdninstagram.com",
  "unsplash.com",
  "googleusercontent.com",
  "storage.googleapis.com",
  "blogblog.com",
];

const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "adv.oabsp.org.br",
];

// Sem campo explícito de site em exports como o do LocalProspects, inferimos
// pela origem do logo (se hospedado no próprio domínio) ou pelo domínio do
// e-mail — mesma heurística usada para classificar "sem site" na análise.
export function inferWebsiteFromRow(row: { logo_url?: string; email?: string }): string | null {
  const logo = row.logo_url || "";
  if (logo && !SOCIAL_ONLY_HINTS.some((h) => logo.includes(h))) {
    try {
      return new URL(logo).origin;
    } catch {
      // logo_url malformada — ignora e cai para o e-mail
    }
  }

  const email = row.email || "";
  const domain = email.includes("@") ? email.split("@")[1]?.toLowerCase() : "";
  if (domain && !FREE_EMAIL_DOMAINS.includes(domain)) {
    return `https://${domain}`;
  }

  return null;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Primeira coluna preenchida entre os nomes aceitos, sem diferenciar
 * maiúsculas. Cada ferramenta exporta com um nome: business_name
 * (LocalProspects), title (Apify), nome (planilha feita à mão)...
 */
export function pickColumn(row: Record<string, string>, aliases: string[]): string | null {
  const byLower = new Map(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]),
  );
  for (const alias of aliases) {
    const value = byLower.get(alias.toLowerCase())?.trim();
    if (value) return value;
  }
  return null;
}
