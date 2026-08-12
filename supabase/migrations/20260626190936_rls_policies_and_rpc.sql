-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_files ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Templates: authenticated users can read all system templates
CREATE POLICY "Authenticated read templates" ON briefing_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage own templates" ON briefing_templates FOR ALL TO authenticated
  USING (NOT is_system) WITH CHECK (NOT is_system);

-- Projects: owner only
CREATE POLICY "Owners select projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Submissions: owner via project
CREATE POLICY "Owners select submissions" ON briefing_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

-- Files: owner via project
CREATE POLICY "Owners select files" ON briefing_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

-- Public RPC: get briefing by token
CREATE OR REPLACE FUNCTION public.get_briefing_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'title', p.title,
    'welcome_message', p.welcome_message,
    'questions', p.questions,
    'status', p.status,
    'client_name', p.client_name,
    'client_email', p.client_email,
    'already_submitted', (p.status = 'submitted' OR p.submitted_at IS NOT NULL)
  ) INTO result
  FROM projects p
  WHERE p.token = p_token
    AND p.status IN ('sent', 'in_progress', 'submitted')
    AND (p.expires_at IS NULL OR p.expires_at > now());
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_briefing_by_token(TEXT) TO anon, authenticated;

-- Public RPC: submit briefing
CREATE OR REPLACE FUNCTION public.submit_briefing(
  p_token TEXT,
  p_answers JSONB,
  p_client_name TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_submission_id UUID;
BEGIN
  SELECT id INTO v_project_id
  FROM projects
  WHERE token = p_token
    AND status IN ('sent', 'in_progress')
    AND submitted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Briefing indisponível ou já respondido';
  END IF;

  INSERT INTO briefing_submissions (project_id, answers, client_name, client_email)
  VALUES (v_project_id, p_answers, p_client_name, p_client_email)
  RETURNING id INTO v_submission_id;

  UPDATE projects
  SET status = 'submitted',
      submitted_at = now(),
      client_name = COALESCE(p_client_name, client_name),
      client_email = COALESCE(p_client_email, client_email)
  WHERE id = v_project_id;

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_briefing(TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;

-- Register file after upload
CREATE OR REPLACE FUNCTION public.register_briefing_file(
  p_token TEXT,
  p_submission_id UUID,
  p_field_id TEXT,
  p_file_name TEXT,
  p_file_path TEXT,
  p_file_size BIGINT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
  v_file_id UUID;
BEGIN
  SELECT p.id INTO v_project_id
  FROM projects p
  JOIN briefing_submissions s ON s.project_id = p.id
  WHERE p.token = p_token AND s.id = p_submission_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Submissão inválida';
  END IF;

  INSERT INTO briefing_files (submission_id, project_id, field_id, file_name, file_path, file_size, mime_type)
  VALUES (p_submission_id, v_project_id, p_field_id, p_file_name, p_file_path, p_file_size, p_mime_type)
  RETURNING id INTO v_file_id;

  RETURN v_file_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_briefing_file(TEXT, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) TO anon, authenticated;;
