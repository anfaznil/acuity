import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TEXT_CHARS = 180_000;

let cachedModel: string | null = null;

async function resolveModel(client: Anthropic): Promise<string> {
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;
  if (cachedModel) return cachedModel;
  try {
    const page = await client.models.list({ limit: 50 });
    const ids = page.data.map((m) => m.id);
    // Models are returned newest first; prefer the latest Sonnet for speed + quality.
    cachedModel =
      ids.find((id) => id.includes("sonnet")) ??
      ids.find((id) => id.includes("opus")) ??
      ids[0];
  } catch {
    cachedModel = "claude-sonnet-4-5";
  }
  return cachedModel!;
}

type GenerateBody = {
  text?: string;
  pdfBase64?: string;
  fileName?: string;
  count?: number | "auto";
  style?: "terms" | "questions" | "mixed";
  focus?: string;
};

const STYLE_GUIDE: Record<string, string> = {
  terms:
    "Use term → definition cards. The term is a short keyword or phrase (1–6 words); the definition is a crisp explanation (ideally under 30 words).",
  questions:
    "Use question → answer cards. The front is a clear, specific question; the back is a concise answer (ideally under 30 words).",
  mixed:
    "Mix term → definition cards with question → answer cards, whichever best fits each concept. Keep fronts short and backs concise (ideally under 30 words).",
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The server is missing ANTHROPIC_API_KEY. Add it in your Vercel project settings." },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (body.text ?? "").slice(0, MAX_TEXT_CHARS).trim();
  if (!text && !body.pdfBase64) {
    return NextResponse.json({ error: "No content was provided." }, { status: 400 });
  }

  const style = STYLE_GUIDE[body.style ?? "terms"] ?? STYLE_GUIDE.terms;
  const countInstruction =
    body.count && body.count !== "auto"
      ? `Create exactly ${Math.min(Math.max(Number(body.count), 5), 100)} flashcards.`
      : "Choose the number of flashcards based on how much important content there is (typically 10–40, max 80).";

  const client = new Anthropic({ apiKey });
  const model = await resolveModel(client);

  const instructions = `You are an expert teacher building a flashcard study set from the provided study material${
    body.fileName ? ` ("${body.fileName}")` : ""
  }.

${countInstruction}
${style}
${body.focus ? `Focus especially on: ${body.focus}\n` : ""}
Rules:
- Cover the most important, testable concepts, definitions, facts, formulas, names and dates.
- Every card must be self-contained and accurate to the material. Do not invent facts.
- No duplicate or near-duplicate cards. Avoid trivial cards (e.g. about page numbers, authors of the PDF, or headers).
- Fronts should be distinct enough that a learner can tell cards apart in multiple choice.
- Write plain text only (no markdown).
- Also give the set a short, catchy title (max 6 words), a one-sentence description, and a single fitting emoji.

You MUST respond by calling the save_flashcards tool exactly once with the complete result. Do not reply with plain text.`;

  const content: Anthropic.ContentBlockParam[] = [];
  if (body.pdfBase64 && !text) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: body.pdfBase64 },
    });
  } else {
    content.push({ type: "text", text: `<study_material>\n${text}\n</study_material>` });
  }
  content.push({ type: "text", text: instructions });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      tools: [
        {
          name: "save_flashcards",
          description: "Save the generated flashcard set.",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              emoji: { type: "string" },
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string", description: "Front of the card" },
                    definition: { type: "string", description: "Back of the card" },
                  },
                  required: ["term", "definition"],
                },
              },
            },
            required: ["title", "description", "emoji", "cards"],
          },
        },
      ],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    let raw: unknown = toolUse && toolUse.type === "tool_use" ? toolUse.input : null;
    if (!raw) {
      // Fallback: the model answered in text — try to pull JSON out of it.
      const txt = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          raw = JSON.parse(m[0]);
        } catch {
          /* ignore */
        }
      }
    }
    if (!raw) {
      return NextResponse.json({ error: "The AI did not return flashcards. Please try again." }, { status: 502 });
    }
    const input = raw as {
      title?: string;
      description?: string;
      emoji?: string;
      cards?: { term: string; definition: string }[];
    };
    const cards = (input.cards ?? [])
      .filter((c) => c && c.term?.trim() && c.definition?.trim())
      .map((c) => ({ term: c.term.trim(), definition: c.definition.trim() }));

    if (cards.length === 0) {
      return NextResponse.json(
        { error: "Couldn't find enough study content in that file. Try a different PDF or paste the text." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: input.title?.trim() || body.fileName?.replace(/\.pdf$/i, "") || "New set",
      description: input.description?.trim() ?? "",
      emoji: input.emoji?.trim() || "📚",
      cards,
      model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("generate error", err);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
