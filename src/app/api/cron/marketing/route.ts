import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processDuePosts } from "@/lib/meta/publisher";

// Publica os posts agendados que venceram e termina os vídeos em
// processamento. Sem sessão de usuário: a autorização é o CRON_SECRET no
// header (formato do Vercel Cron: "Authorization: Bearer <segredo>").
// Também pode ser chamado pelo pg_cron do Supabase — ver
// docs/marketing-meta.md.

export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await processDuePosts();
    return NextResponse.json({ ok: true, processed: results });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
