import { NextResponse } from "next/server";
import { getDropdownOptions } from "@/lib/dropdowns";

export async function GET() {
  try {
    const options = getDropdownOptions();
    return NextResponse.json(options);
  } catch (err) {
    console.error("[dropdowns] Error:", err);
    return NextResponse.json({ error: "Failed to load dropdown options" }, { status: 500 });
  }
}
