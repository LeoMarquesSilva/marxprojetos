export type UserRole = "admin" | "member";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  member: "Membro",
};

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
};
