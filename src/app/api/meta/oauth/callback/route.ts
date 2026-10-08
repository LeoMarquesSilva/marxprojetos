import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { describeMetaError } from "@/lib/meta/graph";
import { completeLogin, OAUTH_STATE_COOKIE } from "@/lib/meta/oauth";
import { createClient } from "@/lib/supabase/server";

function sameState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function backToConnection(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/marketing/conexao", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/meta/oauth" });
  return response;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  if (!sameState(request.cookies.get(OAUTH_STATE_COOKIE)?.value, params.get("state"))) {
    return backToConnection(request, { erro: "state" });
  }
  // Cancelou na tela da Meta ou negou permissão.
  if (params.get("error")) {
    return backToConnection(request, { erro: "cancelado" });
  }
  const code = params.get("code");
  if (!code) return backToConnection(request, { erro: "codigo" });

  try {
    await completeLogin(request.nextUrl.origin, code, user.id);
    return backToConnection(request, { ok: "1" });
  } catch (error) {
    return backToConnection(request, {
      erro: "meta",
      detalhe: describeMetaError(error).slice(0, 200),
    });
  }
}
