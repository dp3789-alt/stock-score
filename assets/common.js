// 공통 도우미: 저장, 테마, 언어, 숫자 형식, 데이터 불러오기
import { T, OPINIONS, SECTORS } from "./i18n.js";

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("ss:" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("ss:" + key, JSON.stringify(value));
    } catch {
      /* 저장 불가(시크릿 모드 등)여도 동작은 계속 */
    }
  },
};

export let lang = store.get("lang", (navigator.language || "ko").startsWith("ko") ? "ko" : "en");
export const t = (k, ...args) => {
  const v = T[lang][k];
  return typeof v === "function" ? v(...args) : v ?? k;
};
export function setLang(l) {
  lang = l;
  store.set("lang", l);
  document.documentElement.lang = l;
}

export function initTheme() {
  const saved = store.get("theme", null);
  if (saved) document.documentElement.dataset.theme = saved;
}
export function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  store.set("theme", next);
  document.dispatchEvent(new CustomEvent("themechange"));
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const opinionLabel = (op) => (OPINIONS[op] || {})[lang] || op;
export const sectorLabel = (s) => (lang === "ko" ? SECTORS[s] || s : s);

export function fmtMoney(v) {
  if (v === null || v === undefined || !isFinite(v)) return T[lang].na;
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(0)}M`;
  return `${sign}$${a.toLocaleString()}`;
}

export function fmtValue(v, kind) {
  if (v === null || v === undefined || !isFinite(v)) return T[lang].na;
  if (kind === "%") return `${(v * 100).toFixed(1)}%`;
  if (kind === "$") return fmtMoney(v);
  if (kind === "x") return v <= 0 ? "n/m" : `${v.toFixed(2)}x`;
  return String(v);
}

export const fmtScore = (s) => (s === null || s === undefined ? T[lang].na : Math.round(s));

export function scoreClass(s) {
  if (s === null || s === undefined) return "na";
  if (s >= 70) return "s5";
  if (s >= 58) return "s4";
  if (s >= 42) return "s3";
  if (s >= 30) return "s2";
  return "s1";
}

const cache = new Map();
export async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path, { cache: "no-cache" }).then((r) => {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  });
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

export function fmtDate(iso) {
  if (!iso) return T[lang].na;
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}
