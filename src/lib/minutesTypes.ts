export interface MinutesGenerationInput {
  transcript: string;
  committeeName: string;
  date: string;
  attendees: string[];
  /** すでに入力されている議題(あれば参考にする) */
  agendaHint: string;
}

export interface GeneratedMinutes {
  summary: string;
  agenda: string;
  discussion: string;
  decisions: string;
  /** 次回開催日が話されていれば YYYY-MM-DD、なければ空文字 */
  nextDate: string;
}

/** 文字起こしの上限(これを超える場合は分割を案内し、勝手に切り詰めない) */
export const MAX_TRANSCRIPT_CHARS = 200_000;
