-- Adds area (rectangle) comments on top of point comments.
-- width_pct/height_pct = 0 means a point pin (backward compatible with
-- existing rows); > 0 means a rectangular selection.

alter table site_comments
  add column if not exists width_pct numeric not null default 0,
  add column if not exists height_pct numeric not null default 0;

drop function if exists add_review_comment(uuid, text, numeric, numeric, int, text, text, text);

create or replace function add_review_comment(
  p_token uuid, p_page_path text, p_x_pct numeric, p_y_pct numeric,
  p_viewport_width int, p_comment text, p_author_name text, p_author_email text,
  p_width_pct numeric default 0, p_height_pct numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_project_id uuid; v_id uuid;
begin
  select id into v_project_id from projects where review_token = p_token and review_enabled = true;
  if v_project_id is null then raise exception 'invalid or disabled review token'; end if;

  insert into site_comments (project_id, page_path, x_pct, y_pct, viewport_width, comment, author_name, author_email, width_pct, height_pct)
  values (v_project_id, p_page_path, p_x_pct, p_y_pct, p_viewport_width, p_comment, p_author_name, p_author_email, p_width_pct, p_height_pct)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function add_review_comment(uuid, text, numeric, numeric, int, text, text, text, numeric, numeric) to anon;
