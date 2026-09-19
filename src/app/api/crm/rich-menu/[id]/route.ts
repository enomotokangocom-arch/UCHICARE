import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  actionType: z.enum(["URL", "POSTBACK", "MESSAGE"]).optional(),
  actionValue: z.string().min(1).max(1000).optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

// リンク先の変更のみ管理画面から可能。実際のLINEリッチメニュー画像デプロイ(画像アップロード)は
// 別途 LINE Developersコンソール または画像アセット付きのデプロイ処理が必要です。
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireSession({ requireAdmin: true });
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "入力内容が不正です。" }, { status: 400 });
    const menu = await prisma.richMenuConfig.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ menu });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
