export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/session";
import { config } from "@/config";
import dropdownOptions from "../../../../../../data/dropdown_options.json";

export type SuggestedIngredient = {
  action: "create" | "merge";
  canonicalName: string;
  aliases: string[];
  category: string | null;
  matchCount: number;
  existingId?: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { items, existingIngredients = [] } = body as {
    items: Array<{ description: string; count: number }>;
    existingIngredients: Array<{ id: string; canonical_name: string; aliases: string[] }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array required" }, { status: 400 });
  }

  // Limit to top 80 by count to stay well within Vercel's timeout
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 80);

  const categories = (dropdownOptions.concepto as string[]).join(", ");

  const itemList = topItems
    .map((i) => `"${i.description}" (${i.count} vez${i.count !== 1 ? "ces" : ""})`)
    .join("\n");

  // Only include id + canonical name + aliases in the prompt to keep token count manageable
  const existingList = existingIngredients
    .slice(0, 200)
    .map((e) => {
      const aliasPart = e.aliases.length > 0 ? ` [alias: ${e.aliases.join(", ")}]` : "";
      return `- id:"${e.id}" nombre:"${e.canonical_name}"${aliasPart}`;
    })
    .join("\n");

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;
  try {
    response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Eres un normalizador de ingredientes para restaurantes mexicanos.
Se te da una lista de descripciones crudas de artículos de facturas Y una lista de ingredientes ya registrados en el sistema.

Tu tarea: para cada descripción (o grupo de descripciones que se refieren al mismo ingrediente), decide:
- "merge": si claramente corresponde a un ingrediente ya existente → usa su id exacto del listado
- "create": si es un ingrediente genuinamente nuevo y estás seguro del nombre canónico correcto

REGLAS ESTRICTAS:
1. Si no estás seguro si algo ya existe o cómo se llama → OMÍTELO por completo (no lo incluyas)
2. Solo incluye sugerencias de alta confianza (>90%)
3. Agrupa varias descripciones si claramente se refieren al mismo ingrediente
4. Para "merge": el campo existingId debe ser el id exacto del ingrediente existente (cópialo textualmente)
5. Para "create": canonicalName debe ser el nombre limpio en español, capitalizado (ej: "Fresa", "Limón sin Semilla")
6. category: elige de esta lista: ${categories}. Si ninguna aplica, usa null.
7. matchCount: suma de ocurrencias de todos los aliases incluidos

Formato de respuesta — JSON puro:
{
  "suggestions": [
    { "action": "merge", "existingId": "id-exacto", "canonicalName": "Nombre existente", "aliases": ["desc1", "desc2"], "category": "...", "matchCount": N },
    { "action": "create", "canonicalName": "Nombre Nuevo", "aliases": ["desc3"], "category": "...", "matchCount": N }
  ]
}`,
        },
        {
          role: "user",
          content: `INGREDIENTES YA REGISTRADOS:\n${existingList || "(ninguno aún)"}\n\nDESCRIPCIONES SIN IDENTIFICAR:\n${itemList}`,
        },
      ],
      max_tokens: 8000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OpenAI error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { suggestions?: SuggestedIngredient[] };
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "Failed to parse LLM response" }, { status: 500 }); }

  // Validate: make sure merge suggestions have valid existingIds
  const validExistingIds = new Set(existingIngredients.map((e) => e.id));
  const suggestions = (parsed.suggestions ?? []).filter((s) => {
    if (s.action === "merge") {
      return s.existingId && validExistingIds.has(s.existingId);
    }
    return s.action === "create" && s.canonicalName;
  });

  return NextResponse.json({ suggestions });
}
