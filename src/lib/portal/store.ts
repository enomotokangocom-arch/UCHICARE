import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COMMITTEES,
  DEFAULT_CRITERIA,
  DEFAULT_JOB_DESCRIPTIONS,
  DEFAULT_LINKS,
  LEGACY_DEFAULT_LINK_URLS,
  ADDED_DEFAULT_LINK_IDS,
  DEFAULT_LINK_ORDER,
  DEFAULT_GOAL_SHEET_TEMPLATES,
  DEFAULT_DRIVE_ROOT_FOLDER_ID,
  DEFAULT_PHILOSOPHY,
  DEFAULT_CONSULTATION_DESKS,
  LEGACY_PHILOSOPHY_VALUES,
  LEGACY_PHILOSOPHY_VISION,
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
  CompanyPhilosophy,
  ConsultationDesk,
  BusinessUnitId,
  Committee,
  Evaluation,
  EvaluationCriterion,
  ExternalLink,
  DailySale,
  FinanceMonthly,
  Goal,
  GoalSheet,
  JobDescription,
  Minutes,
  NanbyoEntry,
  NanbyoPatient,
  Notice,
  ParkingLot,
  ParkingSpace,
  PersonalSales,
  SalesImportMapping,
  SalesSource,
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
  goalSheets: GoalSheet[];
  /** 事業所ごとの目標管理シートの原本(スプレッドシートのURL) */
  goalSheetTemplates: Partial<Record<BusinessUnitId, string>>;
  philosophy: CompanyPhilosophy;
  consultationDesks: ConsultationDesk[];
  dailySales: DailySale[];
  /** 取り込み元ごとの列の設定 */
  salesImportMappings: Partial<Record<SalesSource, SalesImportMapping>>;
  /** 経営数値がサンプルのままか(バナー表示用) */
  financeIsSample: boolean;
  /** Google連携の設定(OAuthクライアントIDと、書類を保存するルートフォルダ) */
  googleClientId: string;
  driveRootFolderId: string;
}

type CollectionKey = Exclude<keyof PortalData, "currentStaffId" | "financeIsSample" | "googleClientId" | "driveRootFolderId" | "goalSheetTemplates" | "philosophy" | "salesImportMappings">;

interface PortalState extends PortalData {
  setCurrentStaffId: (id: string) => void;
  markNoticeRead: (noticeId: string, staffId: string) => void;
  resetAll: () => void;
  resetLinks: () => void;
  resetJobDescriptions: () => void;
  setGoogleSettings: (patch: Partial<Pick<PortalData, "googleClientId" | "driveRootFolderId">>) => void;
  setGoalSheetTemplate: (unitId: BusinessUnitId, url: string) => void;
  setPhilosophy: (patch: Partial<CompanyPhilosophy>) => void;
  setSalesImportMapping: (source: SalesSource, mapping: SalesImportMapping) => void;
  /** 日次売上を差し替え、関係する月の個人売上を計算し直す */
  applyDailySales: (dailySales: DailySale[], personalSales: PersonalSales[]) => void;
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
    goalSheets: [],
    goalSheetTemplates: DEFAULT_GOAL_SHEET_TEMPLATES,
    philosophy: DEFAULT_PHILOSOPHY,
    consultationDesks: DEFAULT_CONSULTATION_DESKS,
    dailySales: [],
    salesImportMappings: {},
    financeIsSample: true,
    googleClientId: "",
    driveRootFolderId: DEFAULT_DRIVE_ROOT_FOLDER_ID,
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
      setSalesImportMapping: (source, mapping) => set((state) => ({ salesImportMappings: { ...state.salesImportMappings, [source]: mapping } })),
      applyDailySales: (dailySales, personalSales) => set({ dailySales, personalSales }),
      setPhilosophy: (patch) => set((state) => ({ philosophy: { ...state.philosophy, ...patch } })),
      setGoalSheetTemplate: (unitId, url) => set((state) => ({ goalSheetTemplates: { ...state.goalSheetTemplates, [unitId]: url } })),
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
      version: 11,
      // v0 → v1: 職員に役職(position)を追加。新しく増えた一覧は初期値のまま使われる(浅いマージ)。
      migrate: (persisted, version) => {
        const state = persisted as Partial<PortalData>;
        if (version < 1 && Array.isArray(state.staff)) {
          state.staff = state.staff.map((s) => ({
            ...s,
            position: s.position ?? (s.role === "管理者" ? "経営者" : "スタッフ"),
          }));
        }
        // v1〜v6 → v7: 外部システムの実際のログインURL・アプリURLを反映(利用者が編集したURLはそのまま)
        if (version < 7 && Array.isArray(state.links)) {
          const defaults = new Map(DEFAULT_LINKS.map((l) => [l.id, l]));
          state.links = state.links.map((l) => {
            const d = defaults.get(l.id);
            if (!d) return l;
            const untouched = (LEGACY_DEFAULT_LINK_URLS[l.id] ?? []).includes(l.url);
            return { ...l, url: untouched ? d.url : l.url, appUrl: l.appUrl ?? d.appUrl };
          });
          for (const id of ADDED_DEFAULT_LINK_IDS) {
            const d = defaults.get(id);
            if (d && !state.links.some((l) => l.id === id)) state.links.push(d);
          }
          // 初期リンクは決まった順に並べ、利用者が追加したリンクはその後ろに元の順で並べる
          const rank = (id: string) => {
            const i = DEFAULT_LINK_ORDER.indexOf(id);
            return i === -1 ? DEFAULT_LINK_ORDER.length : i;
          };
          state.links = state.links
            .map((l, i) => ({ l, i }))
            .sort((a, b) => rank(a.l.id) - rank(b.l.id) || a.i - b.i)
            .map(({ l }) => l);
        }
        // v8: 保存先フォルダが未設定なら「Uchi care全体共有」を使う
        if (version < 8 && !state.driveRootFolderId) state.driveRootFolderId = DEFAULT_DRIVE_ROOT_FOLDER_ID;
        // v10: 理念ブック(PDF)に合わせて、未編集のビジョン・バリューを更新
        if (version < 10 && state.philosophy) {
          if (state.philosophy.vision === LEGACY_PHILOSOPHY_VISION) state.philosophy.vision = DEFAULT_PHILOSOPHY.vision;
          if (state.philosophy.values === LEGACY_PHILOSOPHY_VALUES) state.philosophy.values = DEFAULT_PHILOSOPHY.values;
        }
        // v11: 相談窓口の連絡先(未入力のものだけ)を設定
        if (version < 11 && Array.isArray(state.consultationDesks)) {
          state.consultationDesks = state.consultationDesks.map((d) => {
            const def = DEFAULT_CONSULTATION_DESKS.find((x) => x.id === d.id);
            return def ? { ...d, email: d.email || def.email, phone: d.phone || def.phone } : d;
          });
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
          setGoalSheetTemplate,
          setPhilosophy,
          setSalesImportMapping,
          applyDailySales,
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
