/** ブラウザ内デモ用の簡易ルーター(URLを変えずに画面を切り替える) */
type Listener = () => void;

let current = "/onboarding/login";
const listeners = new Set<Listener>();

export function getLocation() {
  return current;
}
export function getPath() {
  return current.split(/[?#]/)[0];
}
export function navigate(url: string) {
  const [pathAndQuery, fragment] = url.split("#");
  if (pathAndQuery && pathAndQuery !== current) {
    current = pathAndQuery;
    listeners.forEach((l) => l());
    if (!fragment) window.scrollTo(0, 0);
  }
  if (fragment) {
    setTimeout(() => document.getElementById(fragment)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }
}
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
