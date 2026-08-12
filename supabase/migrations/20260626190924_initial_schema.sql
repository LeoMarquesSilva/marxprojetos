-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE project_status AS ENUM ('draft', 'sent', 'in_progress', 'submitted', 'reviewed', 'archived');
CREATE TYPE project_type AS ENUM ('website', 'landing_page', 'ecommerce', 'redesign', 'other');

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates
CREATE TABLE briefing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type project_type NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects / briefings
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES briefing_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_company TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status project_status NOT NULL DEFAULT 'draft',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  welcome_message TEXT,
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_token ON projects(token);
CREATE INDEX idx_projects_status ON projects(status);

-- Submissions
CREATE TABLE briefing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_name TEXT,
  client_email TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_project ON briefing_submissions(project_id);

-- Files
CREATE TABLE briefing_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES briefing_submissions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_submission ON briefing_files(submission_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON briefing_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();;
