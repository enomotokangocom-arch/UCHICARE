import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COMMITTEES,
  DEFAULT_CRITERIA,
  DEFAULT_JOB_DESCRIPTIONS,
  DEFAULT_LINKS,
  LEGACY_DEFAULT_LINK_URLS,
  DEFAULT_PARKING_LOTS,
  DEFAULT_PARKING_SPACES,
  DEFAULT_STAFF,
  DEFAULT_VEHICLES,
  sampleAlcoholChecks,
  sampleFinance,
  sampleGoals,
  sampleNanbyo,
  samplePersonalSales,
  sampleSalesActivities,
  sampleSubsidies,
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
  FinanceMonthly,
  Goal,
  JobDescription,
  Minutes,
  NanbyoEntry,
  NanbyoPatient,
  Notice,
  ParkingLot,
  ParkingSpace,
  PersonalSales,
  SalesActivity,
  Staff,
  Subsidy,
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
  parkingLots: ParkingLot[];
  parkingSpaces: ParkingSpace[];
  jobDescriptions: JobDescription[];
  nanbyoPatients: NanbyoPatient[];
  nanbyoEntries: NanbyoEntry[];
  salesActivities: SalesActivity[];
  finance: FinanceMonthly[];
  subsidies: Subsidy[];
  personalSales: PersonalSales[];
  goals: Goal[];
  /** 経営数値がサンプルのままか(バナー表示用) */
  financeIsSample: boolean;
  /** Google連携の設定(OAuthクライアントIDと、書類を保存するルートフォルダ) */
  googleClientId: string;
  driveRootFolderId: string;
}

type CollectionKey = Exclude<keyof PortalData, "currentStaffId" | "financeIsSample" | "googleClientId" | "driveRootFolderId">;

interface PortalState extends PortalData {
  setCurrentStaffId: (id: string) => void;
  markNoticeRead: (noticeId: string, staffId: string) => void;
  resetAll: () => void;
  resetLinks: () => void;
  resetJobDescriptions: () => void;
  setGoogleSettings: (patch: Partial<Pick<PortalData, "googleClientId" | "driveRootFolderId">>) => void;
  /** サンプルの経営数値(月次・補助金・個人売上)を消去する */
  clearFinanceSamples: () => void;
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
    parkingLots: DEFAULT_PARKING_LOTS,
    parkingSpaces: DEFAULT_PARKING_SPACES,
    jobDescriptions: DEFAULT_JOB_DESCRIPTIONS,
    nanbyoPatients: sampleNanbyo().patients,
    nanbyoEntries: sampleNanbyo().entries,
    salesActivities: sampleSalesActivities(),
    finance: sampleFinance(),
    subsidies: sampleSubsidies(),
    personalSales: samplePersonalSales(),
    goals: sampleGoals(),
    financeIsSample: true,
    googleClientId: "",
    driveRootFolderId: "",
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
      resetJobDescriptions: () => set({ jobDescriptions: DEFAULT_JOB_DESCRIPTIONS }),
      setGoogleSettings: (patch) => set(patch),
      clearFinanceSamples: () => set({ finance: [], subsidies: [], personalSales: [], financeIsSample: false }),
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
      version: 2,
      // v0 → v1: 職員に役職(position)を追加。新しく増えた一覧は初期値のまま使われる(浅いマージ)。
      migrate: (persisted, version) => {
        const state = persisted as Partial<PortalData>;
        if (version < 1 && Array.isArray(state.staff)) {
          state.staff = state.staff.map((s) => ({
            ...s,
            position: s.position ?? (s.role === "管理者" ? "経営者" : "スタッフ"),
          }));
        }
        // v1 → v2: 外部システムの実際のログインURL・アプリURLを反映(利用者が編集したURLはそのまま)
        if (version < 2 && Array.isArray(state.links)) {
          const defaults = new Map(DEFAULT_LINKS.map((l) => [l.id, l]));
          state.links = state.links.map((l) => {
            const d = defaults.get(l.id);
            if (!d) return l;
            const untouched = l.id in LEGACY_DEFAULT_LINK_URLS && l.url === LEGACY_DEFAULT_LINK_URLS[l.id];
            return { ...l, url: untouched ? d.url : l.url, appUrl: l.appUrl ?? d.appUrl };
          });
          for (const d of DEFAULT_LINKS) {
            if (d.id === "uchicare-hp" && !state.links.some((l) => l.id === d.id)) state.links.push(d);
          }
        }
        return state as PortalState;
      },
      partialize: (state) => {
        const {
          /* eslint-disable @typescript-eslint/no-unused-vars */
          setCurrentStaffId,
          markNoticeRead,
          resetAll,
          resetLinks,
          resetJobDescriptions,
          setGoogleSettings,
          clearFinanceSamples,
          collection,
          /* eslint-enable @typescript-eslint/no-unused-vars */
          ...data
        } = state;
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
