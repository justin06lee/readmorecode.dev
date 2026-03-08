import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";

export async function GET(request: Request) {
  const { access } = await getAccessContext(request);
  return NextResponse.json(access);
}
