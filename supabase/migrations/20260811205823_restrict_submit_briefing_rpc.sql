revoke all on function public.submit_briefing(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.submit_briefing(text, jsonb, text, text) to service_role;;
