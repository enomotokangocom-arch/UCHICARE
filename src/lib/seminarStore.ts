import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SeminarGeneratedLog } from "./types";

interface SeminarLogState {
  log: SeminarGeneratedLog[];
  recordGenerated: (date: string, topicId: string) => void;
}

export const useSeminarLogStore = create<SeminarLogState>()(
  persist(
    (set, get) => ({
      log: [],
      recordGenerated: (date, topicId) => {
        const alreadyRecorded = get().log.some(
          (entry) => entry.date === date && entry.topicId === topicId
        );
        if (alreadyRecorded) return;
        set((state) => ({
          log: [...state.log, { date, topicId, generatedAt: new Date().toISOString() }],
        }));
      },
    }),
    {
      name: "uchicare-seminar-log",
      skipHydration: true,
    }
  )
);
