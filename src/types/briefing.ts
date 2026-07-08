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
  review_token: string | null;
  review_site_path: string | null;
  review_enabled: boolean;
  review_enabled_at: string | null;
  review_approved_at: string | null;
};

export type SiteCommentStatus = "open" | "resolved";

export type SiteComment = {
  id: string;
  project_id: string;
  page_path: string;
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
  viewport_width: number;
  comment: string;
  author_name: string | null;
  author_email: string | null;
  status: SiteCommentStatus;
  created_at: string;
  resolved_at: string | null;
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
