import { NextRequest } from "next/server";
import { requireMember } from "@/lib/server/requireMember";
import { createWordPressDraft, WordPressPublishInput } from "@/lib/wordpressClient";

export const runtime = "nodejs";
// タグの検索・作成を複数回呼ぶため、Vercelのデフォルトタイムアウトより長めに確保する。
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // ログイン中の職員だけが使える(AIの利用料金・社内情報を守るため)
  const auth = await requireMember(request, { maxRank: 3 });
  if (auth.error) return auth.error;
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
