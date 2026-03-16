import { NextResponse } from "next/server";
import { getDropdownOptions } from "@/lib/dropdowns";
import log from "@/lib/logger";

export async function GET() {
  try {
    const options = await getDropdownOptions();
    return NextResponse.json(options);
  } catch (err) {
    log.error({ ctx: "dropdowns", msg: "Failed to load dropdown options", err });
    return NextResponse.json({ error: "Failed to load dropdown options" }, { status: 500 });
  }
}
