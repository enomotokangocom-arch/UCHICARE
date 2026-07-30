import { SurveyType } from "./types";

const SLUG_MAP: Record<SurveyType, string> = {
  ergonomics: "ergonomics",
  stressCheck: "stress-check",
  backPain: "back-pain",
  caregiving: "caregiving",
};

export function surveyTypeToSlug(type: SurveyType): string {
  return SLUG_MAP[type];
}
