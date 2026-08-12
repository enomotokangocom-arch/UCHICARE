import { getMonthSequence } from "./mockData";
import { scoreToLevel } from "./scoring";
import {
  CategoryAggregate,
  Department,
  DEPARTMENTS,
  DepartmentAggregate,
  MonthlyTrendPoint,
  SurveySubmission,
  SurveyType,
} from "./types";

const SURVEY_TYPES: SurveyType[] = ["ergonomics", "stressCheck", "backPain", "caregiving", "lifestyle"];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function categoryAggregates(submissions: SurveySubmission[]): CategoryAggregate[] {
  return SURVEY_TYPES.map((type) => {
    const matched = submissions.filter((s) => s.type === type);
    const averageScore = average(matched.map((s) => s.score));
    return {
      type,
      averageScore,
      level: scoreToLevel(averageScore),
      responseCount: matched.length,
      highRiskCount: matched.filter((s) => s.level === "high").length,
    };
  });
}

export function overallScore(submissions: SurveySubmission[]): number {
  const categories = categoryAggregates(submissions).filter((c) => c.responseCount > 0);
  if (categories.length === 0) return 0;
  return average(categories.map((c) => c.averageScore));
}

export function departmentAggregates(submissions: SurveySubmission[]): DepartmentAggregate[] {
  return DEPARTMENTS.map((department) => {
    const deptSubmissions = submissions.filter((s) => s.department === department);
    const categoryScores = {} as Record<SurveyType, number | null>;
    SURVEY_TYPES.forEach((type) => {
      const matched = deptSubmissions.filter((s) => s.type === type);
      categoryScores[type] = matched.length > 0 ? average(matched.map((s) => s.score)) : null;
    });
    const validScores = Object.values(categoryScores).filter((v): v is number => v !== null);
    return {
      department,
      overallScore: validScores.length > 0 ? average(validScores) : 0,
      categoryScores,
      responseCount: deptSubmissions.length,
    };
  });
}

export function monthlyTrend(submissions: SurveySubmission[]): MonthlyTrendPoint[] {
  const months = getMonthSequence();
  return months.map(({ key, label, date }) => {
    const monthSubmissions = submissions.filter((s) => {
      const submittedDate = new Date(s.submittedAt);
      return (
        submittedDate.getFullYear() === date.getFullYear() &&
        submittedDate.getMonth() === date.getMonth()
      );
    });
    const categoryScores = {} as Record<SurveyType, number>;
    SURVEY_TYPES.forEach((type) => {
      const matched = monthSubmissions.filter((s) => s.type === type);
      categoryScores[type] = matched.length > 0 ? average(matched.map((s) => s.score)) : 0;
    });
    const validCategoryScores = Object.values(categoryScores).filter((v) => v > 0);
    return {
      month: key,
      label,
      overallScore: validCategoryScores.length > 0 ? average(validCategoryScores) : 0,
      categoryScores,
    };
  });
}

export function riskEmployeeCounts(submissions: SurveySubmission[]): Record<SurveyType, number> {
  const result = {} as Record<SurveyType, number>;
  SURVEY_TYPES.forEach((type) => {
    result[type] = submissions.filter((s) => s.type === type && s.level === "high").length;
  });
  return result;
}

export function departmentsWithData(): Department[] {
  return DEPARTMENTS;
}
