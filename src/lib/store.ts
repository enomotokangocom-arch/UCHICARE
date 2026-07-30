import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateMockSubmissions } from "./mockData";
import { SurveySubmission } from "./types";

interface HealthDataState {
  submissions: SurveySubmission[];
  addSubmission: (submission: SurveySubmission) => void;
  resetToMockData: () => void;
}

export const useHealthDataStore = create<HealthDataState>()(
  persist(
    (set) => ({
      submissions: generateMockSubmissions(),
      addSubmission: (submission) =>
        set((state) => ({ submissions: [...state.submissions, submission] })),
      resetToMockData: () => set({ submissions: generateMockSubmissions() }),
    }),
    {
      name: "uchicare-health-data",
      skipHydration: true,
    }
  )
);
