export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function displayNameFromEmail(email?: string | null): string {
  if (!email) return "usuário";
  const local = email.split("@")[0] ?? email;
  const name = local.split(/[._-]/)[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
