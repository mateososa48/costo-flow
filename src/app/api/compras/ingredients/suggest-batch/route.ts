export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import dropdownOptions from "../../../../../../data/dropdown_options.json";

export type SuggestedIngredient = {
  canonicalName: string;
  aliases: string[];
  category: string | null;
  matchCount: number;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { items } = body as { items: Array<{ description: string; count: number }> };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  const categories = (dropdownOptions.concepto as string[]).join(", ");
  const itemList = items.map((i) => `"${i.description}" (${i.count} vez${i.count !== 1 ? "ces" : ""})`).join("\n");

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;
  try {
    response = await client.chat.completions.create({
      model: "gpt-4.1",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Eres un normalizador de ingredientes para restaurantes mexicanos.
Se te da una lista de descripciones crudas de artículos de facturas de proveedores.
Tu tarea: agrupar las descripciones que se refieren al mismo ingrediente y crear un nombre canónico limpio en español.

Reglas:
- canonicalName: nombre limpio en español, capitalizado (ej: "Fresa", "Limón sin Semilla", "Pechuga de Pollo")
- aliases: todas las descripciones crudas que corresponden a ese ingrediente
- category: elige la categoría más adecuada de la siguiente lista: ${categories}. Si ninguna aplica, usa null.
- matchCount: suma de las ocurrencias de todos los aliases

Responde ÚNICAMENTE con JSON: { "suggestions": [ { "canonicalName": "...", "aliases": [...], "category": "..." | null, "matchCount": N }, ... ] }`,
      },
      {
        role: "user",
        content: `Agrupa estos artículos:\n${itemList}`,
      },
    ],
      max_tokens: 4000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OpenAI error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { suggestions?: SuggestedIngredient[] };
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "Failed to parse LLM response" }, { status: 500 }); }

  return NextResponse.json({ suggestions: parsed.suggestions ?? [] });
}
