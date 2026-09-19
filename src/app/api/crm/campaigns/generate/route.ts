import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/crm/prisma";
import { requireSession, apiErrorResponse } from "@/lib/crm/session";
import {
  buildCampaignSystemPrompt,
  buildCampaignUserPrompt,
  parseCampaignDrafts,
  type CampaignGenerationInput,
} from "@/lib/crm/ai/campaignGenerator";

export const runtime = "nodejs";
export const maxDuration = 60;

// AIが生成した文章は必ず DRAFT (下書き) として保存され、
// 人間による確認・編集 → 承認(APPROVED) → 予約配信 のワークフローを経るまで配信されません。
export async function POST(request: Request) {
  try {
    const session = await requireSession({ requireWrite: true });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません。" }, { status: 500 });
    }

    const input = (await request.json().catch(() => ({}))) as Partial<CampaignGenerationInput>;
    const normalized: CampaignGenerationInput = {
      targetOccupations: input.targetOccupations ?? "",
      currentJobs: input.currentJobs ?? "",
      recentNews: input.recentNews ?? "",
      staffIntro: input.staffIntro ?? "",
      training: input.training ?? "",
      events: input.events ?? "",
      newOffice: input.newOffice ?? "",
      theme: input.theme ?? "",
    };

    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      output_config: { effort: "low" },
      system: buildCampaignSystemPrompt(),
      messages: [{ role: "user", content: buildCampaignUserPrompt(normalized) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "配信案の生成に失敗しました。" }, { status: 502 });
    }

    const drafts = parseCampaignDrafts(textBlock.text);

    const campaigns = await Promise.all(
      drafts.map((draft) =>
        prisma.campaign.create({
          data: {
            title: draft.title,
            category: "AI生成案",
            body: draft.body,
            ctaLabel: draft.cta || null,
            status: "DRAFT",
            aiGenerated: true,
            aiPrompt: JSON.stringify({ input: normalized, targetAudience: draft.targetAudience, recommendedSendAt: draft.recommendedSendAt }),
            createdByStaffId: session.staffId,
          },
        })
      )
    );

    return NextResponse.json({ campaigns });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
