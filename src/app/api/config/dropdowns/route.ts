import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDropdownOptions } from "@/lib/dropdowns";
import log from "@/lib/logger";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const options = await getDropdownOptions(session.tenantId);
    return NextResponse.json(options);
  } catch (err) {
    log.error({ ctx: "dropdowns", msg: "Failed to load dropdown options", err });
    return NextResponse.json({ error: "Failed to load dropdown options" }, { status: 500 });
  }
}
