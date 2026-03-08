import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Attempt recording is handled by the grading endpoint only." },
    { status: 410 }
  );
}
