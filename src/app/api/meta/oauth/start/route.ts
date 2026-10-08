import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { metaConfig } from "@/lib/meta/graph";
import { buildLoginUrl, OAUTH_STATE_COOKIE } from "@/lib/meta/oauth";
import { createClient } from "@/lib/supabase/server";

// Início do login com o Facebook. O `state` vai num cookie httpOnly e volta
// na URL do callback: sem bater, o callback recusa (protege contra alguém
// forçar a conexão de outra conta da Meta no sistema).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!metaConfig().configured) {
    return NextResponse.redirect(new URL("/marketing/conexao?erro=config", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildLoginUrl(request.nextUrl.origin, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/meta/oauth",
    maxAge: 600,
  });
  return response;
}
