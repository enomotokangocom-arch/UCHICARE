import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COMMITTEES,
  DEFAULT_CRITERIA,
  DEFAULT_LINKS,
  DEFAULT_STAFF,
  DEFAULT_VEHICLES,
  sampleAlcoholChecks,
  sampleMinutes,
  sampleNotices,
  sampleVehicleLogs,
} from "./defaults";
import {
  AlcoholCheck,
  Committee,
  Evaluation,
  EvaluationCriterion,
  ExternalLink,
  Minutes,
  Notice,
  Staff,
  Vehicle,
  VehicleLog,
} from "./types";

/** id を持つレコードの一覧に対する追加・更新・削除をまとめて作る */
type Collection<T extends { id: string }> = {
  add: (item: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
};

interface PortalData {
  currentStaffId: string;
  links: ExternalLink[];
  staff: Staff[];
  vehicles: Vehicle[];
  committees: Committee[];
  criteria: EvaluationCriterion[];
  notices: Notice[];
  vehicleLogs: VehicleLog[];
  alcoholChecks: AlcoholCheck[];
  minutes: Minutes[];
  evaluations: Evaluation[];
}

type CollectionKey = Exclude<keyof PortalData, "currentStaffId">;

interface PortalState extends PortalData {
  setCurrentStaffId: (id: string) => void;
  markNoticeRead: (noticeId: string, staffId: string) => void;
  resetAll: () => void;
  resetLinks: () => void;
  collection: <K extends CollectionKey>(key: K) => Collection<PortalData[K][number]>;
}

function initialData(): PortalData {
  return {
    currentStaffId: "s-admin",
    links: DEFAULT_LINKS,
    staff: DEFAULT_STAFF,
    vehicles: DEFAULT_VEHICLES,
    committees: DEFAULT_COMMITTEES,
    criteria: DEFAULT_CRITERIA,
    notices: sampleNotices(),
    vehicleLogs: sampleVehicleLogs(),
    alcoholChecks: sampleAlcoholChecks(),
    minutes: sampleMinutes(),
    evaluations: [],
  };
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      ...initialData(),
      setCurrentStaffId: (id) => set({ currentStaffId: id }),
      markNoticeRead: (noticeId, staffId) =>
        set((state) => ({
          notices: state.notices.map((n) =>
            n.id === noticeId && !n.readBy.includes(staffId) ? { ...n, readBy: [...n.readBy, staffId] } : n
          ),
        })),
      resetAll: () => set(initialData()),
      resetLinks: () => set({ links: DEFAULT_LINKS }),
      collection: (key) => ({
        add: (item) =>
          set((state) => ({ [key]: [item, ...(state[key] as { id: string }[])] }) as Partial<PortalState>),
        update: (id, patch) =>
          set(
            (state) =>
              ({
                [key]: (state[key] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
              }) as Partial<PortalState>
          ),
        remove: (id) =>
          set(
            (state) =>
              ({ [key]: (state[key] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<PortalState>
          ),
      }),
    }),
    {
      name: "uchicare-portal",
      skipHydration: true,
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { setCurrentStaffId, markNoticeRead, resetAll, resetLinks, collection, ...data } = state;
        return data;
      },
    }
  )
);

/** ログイン中(として選択中)のスタッフ */
export function useCurrentStaff(): Staff | undefined {
  const id = usePortalStore((s) => s.currentStaffId);
  const staff = usePortalStore((s) => s.staff);
  return staff.find((s) => s.id === id) ?? staff[0];
}

export function useStaffName() {
  const staff = usePortalStore((s) => s.staff);
  return (id: string) => staff.find((s) => s.id === id)?.name ?? "(削除済み)";
}

export function useVehicleName() {
  const vehicles = usePortalStore((s) => s.vehicles);
  return (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.name}(${v.plate})` : "(削除済み)";
  };
}
