export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "select"
  | "multiselect"
  | "file"
  | "links"
  | "boolean";

export type BriefingQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  required?: boolean;
  section?: string;
  placeholder?: string;
  options?: string[];
  accept?: string;
  multiple?: boolean;
};

export type ProjectStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "submitted"
  | "reviewed"
  | "archived";

export type ProjectType =
  | "website"
  | "landing_page"
  | "ecommerce"
  | "redesign"
  | "other";

export type BriefingTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  questions: BriefingQuestion[];
  is_system: boolean;
};

export type Project = {
  id: string;
  owner_id: string;
  template_id: string | null;
  title: string;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  token: string;
  status: ProjectStatus;
  questions: BriefingQuestion[];
  welcome_message: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BriefingSubmission = {
  id: string;
  project_id: string;
  answers: Record<string, unknown>;
  client_name: string | null;
  client_email: string | null;
  submitted_at: string;
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  in_progress: "Em andamento",
  submitted: "Respondido",
  reviewed: "Revisado",
  archived: "Arquivado",
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Site institucional",
  landing_page: "Landing page",
  ecommerce: "E-commerce",
  redesign: "Redesign",
  other: "Outro",
};
