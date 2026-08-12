import { NextRequest } from "next/server";
import { createWordPressDraft, WordPressPublishInput } from "@/lib/wordpressClient";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const input = (await request.json()) as WordPressPublishInput;

  if (!input.title || !input.body) {
    return Response.json({ error: "記事のタイトルまたは本文が指定されていません。" }, { status: 400 });
  }

  try {
    const result = await createWordPressDraft(input);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WordPressへの送信中にエラーが発生しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
