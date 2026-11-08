export function getTimeGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** E-mail que não tem o nome da pessoa na frente do @. */
const NAMES_BY_EMAIL: Record<string, string> = {
  "marx.projetos@gmail.com": "Leonardo Marques",
};

export function displayNameFromEmail(email?: string | null): string {
  if (!email) return "usuário";
  const known = NAMES_BY_EMAIL[email.toLowerCase()];
  if (known) return known;
  const local = email.split("@")[0] ?? email;
  const name = local.split(/[._-]/)[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
