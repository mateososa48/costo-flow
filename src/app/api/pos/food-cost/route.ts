import { NextResponse } from "next/server";

/**
 * GET /api/pos/food-cost — BLOCKED, NOT IMPLEMENTED
 *
 * Food cost % requires mapping Parrot's category_uuid values to CocinaOS's
 * free-text category strings (e.g. "Carnes", "Lácteos"). These don't align
 * automatically. A manual mapping layer must be designed first.
 *
 * Returning 501 until that mapping layer is built.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Not implemented: food cost % requires category mapping (Parrot UUID ↔ CocinaOS category)" },
    { status: 501 }
  );
}
