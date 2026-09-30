/**
 * ページ移動の共通処理。通常はブラウザのURL遷移を使い、
 * ブラウザ内デモ(demo-web)では差し替えられた移動処理を使います。
 */
type DemoHooks = { __obNavigate?: (url: string) => void; __obLocation?: () => string; __obDemo?: boolean };

function hooks(): DemoHooks {
  return typeof window === "undefined" ? {} : (window as unknown as DemoHooks);
}

export function goTo(url: string) {
  const h = hooks();
  if (h.__obNavigate) h.__obNavigate(url);
  else window.location.href = url;
}

/** 現在のパス+クエリ(例: /onboarding/devices?hire=1) */
export function currentLocation(): string {
  const h = hooks();
  return h.__obLocation ? h.__obLocation() : window.location.pathname + window.location.search;
}

export function currentQuery(): URLSearchParams {
  const loc = currentLocation();
  const i = loc.indexOf("?");
  return new URLSearchParams(i >= 0 ? loc.slice(i + 1) : "");
}

/** ブラウザ内デモとして動いているか(印刷・CSVダウンロードなど使えない機能を隠す) */
export function isBrowserDemo(): boolean {
  return !!hooks().__obDemo;
}
