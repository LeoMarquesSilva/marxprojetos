import { NextResponse, type NextRequest } from "next/server";
import { searchEverything } from "@/lib/shell-data";

export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(await searchEverything(term));
}
