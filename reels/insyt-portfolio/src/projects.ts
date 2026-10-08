// Projetos do portfólio, na ordem em que aparecem. Textos tirados do
// portfólio publicado (insytstudio.com.br) e dos próprios sites.
// Dimensões são das capturas em public/captures (scripts/capture.mjs).
export type Layout = "stack" | "phone" | "tilt";

export type Project = {
  slug: string;
  name: string; // "\n" quebra a linha
  type: string;
  area: string;
  url: string;
  tags: string[];
  layout: Layout;
  desktopH: number;
};

export const DESKTOP_W = 1440;
export const MOBILE_W = 780;
export const MOBILE_H = 8400;

export const PROJECTS: Project[] = [
  {
    slug: "pereira-garcia",
    name: "Pereira Garcia\nAdvocacia",
    type: "Site institucional",
    area: "Societário e holdings · Campinas/SP",
    url: "pereiragarciaadvocacia.com.br",
    tags: ["Estratégia de conteúdo", "UX/UI", "SEO local"],
    layout: "stack",
    desktopH: 5200,
  },
  {
    slug: "pg-holding",
    name: "Holding Familiar\nPereira Garcia",
    type: "Landing page",
    area: "Serviço complexo, fácil de entender",
    url: "holding.pereiragarciaadvocacia.com.br",
    tags: ["Copy de conversão", "Formulário de leads", "WhatsApp integrado"],
    layout: "phone",
    desktopH: 5200,
  },
  {
    slug: "outeiral",
    name: "Outeiral\nAdvocacia",
    type: "Site institucional",
    area: "Direito Penal de alta complexidade",
    url: "outeiraladvocacia.com.br",
    tags: ["Identidade editorial", "UX/UI", "Conteúdo autoral"],
    layout: "tilt",
    desktopH: 5200,
  },
  {
    slug: "ordem-digital",
    name: "Ordem\nDigital",
    type: "Site institucional",
    area: "Social media para advogados",
    url: "Ordem Digital",
    tags: ["Posicionamento", "Copy", "UX/UI"],
    layout: "stack",
    desktopH: 5200,
  },
  {
    slug: "bismarchi",
    name: "Bismarchi\n| Pires",
    type: "Site institucional",
    area: "Reestruturação empresarial e crises",
    url: "bismarchipires.com.br",
    tags: ["Autoridade", "Áreas de atuação", "Equipe"],
    layout: "phone",
    desktopH: 5200,
  },
  {
    slug: "beatriz-bertho",
    name: "Beatriz Bertho\nAdvocacia",
    type: "Landing page",
    area: "Advocacia preventiva em Direito Médico",
    url: "beatrizberthoadv.com.br",
    tags: ["Jornada clara", "Credenciais", "Contato direto"],
    layout: "tilt",
    desktopH: 5200,
  },
  {
    slug: "confiara",
    name: "Confiara",
    type: "Plataforma SaaS",
    area: "Compliance NR-1 e canal de denúncias",
    url: "confiara.com.br",
    tags: ["Multiempresa", "Painel de RH", "ISO 37002"],
    layout: "stack",
    desktopH: 4171,
  },
];
