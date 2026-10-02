// 메인 화면 (해시 라우팅 단일 페이지)
import { CATEGORIES, KEY_FIGURES, MACRO_ITEMS, SECTORS } from "./i18n.js";
import {
  esc, fmtDate, fmtMoney, fmtScore, fmtValue, getJSON, initTheme, lang, opinionLabel,
  scoreClass, sectorLabel, setLang, store, t, toggleTheme,
} from "./common.js";

initTheme();
document.documentElement.lang = lang;

const app = document.getElementById("app");
let index = null; // [{t, n, s, sc, op, c:[...], mc}]
let charts = [];

// ---------- 공통 ----------
const watch = {
  list: () => store.get("watch", []),
  has: (tk) => watch.list().includes(tk),
  toggle(tk) {
    const l = watch.list();
    store.set("watch", l.includes(tk) ? l.filter((x) => x !== tk) : [...l, tk]);
  },
};
const compareList = () => store.get("compare", []);
function setCompare(list) {
  store.set("compare", list.slice(0, 4));
}

async function loadIndex() {
  if (index) return index;
  const data = await getJSON("data/index.json");
  index = Array.isArray(data) ? data : [];
  return index;
}

function search(q) {
  q = q.trim().toLowerCase();
  if (!q || !index) return [];
  const exact = [], prefix = [], contains = [];
  for (const r of index) {
    const tk = r.t.toLowerCase(), nm = r.n.toLowerCase();
    if (tk === q) exact.push(r);
    else if (tk.startsWith(q) || nm.startsWith(q)) prefix.push(r);
    else if (nm.includes(q)) contains.push(r);
  }
  return [...exact, ...prefix, ...contains].slice(0, 8);
}

function opinionBadge(op, score) {
  return `<span class="badge ${scoreClass(score)}">${esc(opinionLabel(op))}</span>`;
}

function scoreChip(s) {
  return `<span class="chip ${scoreClass(s)}">${fmtScore(s)}</span>`;
}

function searchBox(id, onPick) {
  setTimeout(() => {
    const input = document.getElementById(id);
    const list = document.getElementById(id + "-list");
    if (!input) return;
    let active = -1, results = [];
    const render = () => {
      results = search(input.value);
      if (!input.value.trim()) { list.hidden = true; return; }
      list.hidden = false;
      list.innerHTML = results.length
        ? results.map((r, i) => `<li role="option" data-t="${esc(r.t)}" class="${i === active ? "active" : ""}">
            <b>${esc(r.t)}</b><span class="muted">${esc(r.n)}</span>${scoreChip(r.sc)}</li>`).join("")
        : `<li class="muted empty">${esc(t("noResults"))}</li>`;
    };
    input.addEventListener("input", () => { active = -1; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { active = Math.min(active + 1, results.length - 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
      else if (e.key === "Enter") {
        const pick = results[active >= 0 ? active : 0];
        if (pick) onPick(pick.t);
      } else if (e.key === "Escape") { list.hidden = true; }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-t]");
      if (li) { e.preventDefault(); onPick(li.dataset.t); }
    });
    input.addEventListener("blur", () => setTimeout(() => (list.hidden = true), 150));
  });
  return `<div class="search">
    <input id="${id}" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(t("searchPlaceholder"))}" aria-label="${esc(t("searchPlaceholder"))}">
    <ul id="${id}-list" class="search-list" role="listbox" hidden></ul>
  </div>`;
}

function rowsTable(rows, { showSector = true } = {}) {
  return `<div class="table-wrap"><table class="rank">
    <thead><tr><th>#</th><th>${esc(t("company"))}</th>
      ${showSector ? `<th class="hide-sm">${esc(t("sector"))}</th>` : ""}
      ${CATEGORIES.map((c) => `<th class="hide-sm num">${esc(c.short[lang])}</th>`).join("")}
      <th class="num">${esc(t("score"))}</th><th>${esc(t("opinion"))}</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-href="#/s/${esc(r.t)}">
      <td class="muted">${i + 1}</td>
      <td><a href="#/s/${esc(r.t)}"><b>${esc(r.t)}</b></a><div class="muted small ellipsis">${esc(r.n)}</div></td>
      ${showSector ? `<td class="hide-sm small">${esc(sectorLabel(r.s))}</td>` : ""}
      ${r.c.map((v) => `<td class="hide-sm num small">${fmtScore(v)}</td>`).join("")}
      <td class="num"><b>${fmtScore(r.sc)}</b></td><td>${opinionBadge(r.op, r.sc)}</td></tr>`).join("")}
    </tbody></table></div>`;
}

function bindRowLinks() {
  app.querySelectorAll("tr[data-href]").forEach((tr) =>
    tr.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = tr.dataset.href; }));
}

const go = (tk) => (location.hash = `#/s/${encodeURIComponent(tk)}`);

// ---------- 화면: 홈 ----------
async function viewHome() {
  const [idx, macro] = await Promise.all([loadIndex(), getJSON("data/macro.json").catch(() => null)]);
  if (!idx.length) {
    app.innerHTML = `<section class="hero"><h1>${esc(t("siteName"))}</h1><p class="muted">${esc(t("tagline"))}</p></section>
      <div class="card notice">${esc(t("noData"))}</div>`;
    return;
  }
  const w = watch.list().map((tk) => idx.find((r) => r.t === tk)).filter(Boolean);
  app.innerHTML = `
    <section class="hero">
      <h1>${esc(t("siteName"))}</h1>
      <p class="muted">${esc(t("tagline"))}</p>
      ${searchBox("q", go)}
    </section>
    ${macro ? macroCard(macro) : ""}
    <section>
      <h2>${esc(t("watchlist"))}</h2>
      ${w.length ? rowsTable(w) : `<p class="muted">${esc(t("emptyWatch"))}</p>`}
    </section>
    <section>
      <div class="section-head"><h2>${esc(t("topScores"))}</h2><a href="#/rank">${esc(t("seeAll"))} →</a></div>
      ${rowsTable(idx.slice(0, 10))}
    </section>`;
  bindRowLinks();
  setTimeout(() => document.getElementById("q")?.focus());
}

function macroCard(m) {
  const items = MACRO_ITEMS.filter((it) => m.raw?.[it.key]).map((it) => {
    const r = m.raw[it.key];
    const chg = r.change_6m !== undefined ? `<span class="muted small"> (6M ${r.change_6m >= 0 ? "+" : ""}${r.change_6m})</span>` : "";
    return `<div class="kv"><span class="muted small">${esc(it[lang])}</span><b>${r.value}${it.unit}</b>${chg}</div>`;
  }).join("");
  const words = Object.values(m.signals || {}).map((s) => esc(s[lang])).join(" · ");
  const sectors = Object.entries(m.sectors || {}).sort((a, b) => b[1] - a[1]);
  return `<section class="card">
    <h2>${esc(t("economyNow"))}</h2>
    <p class="muted small">${words}</p>
    <div class="grid kv-grid">${items}</div>
    <details class="sub"><summary>${lang === "ko" ? "업종별 경제 환경 점수" : "Economy score by sector"}</summary>
      <div class="bars">${sectors.map(([s, v]) => `<div class="bar-row"><span class="small">${esc(sectorLabel(s))}</span>
        <div class="bar"><i class="${scoreClass(v)}" style="--w:${v}%"></i></div><b class="small num">${Math.round(v)}</b></div>`).join("")}</div>
    </details>
  </section>`;
}

// ---------- 화면: 상세 ----------
async function viewStock(tk) {
  await loadIndex();
  const d = await getJSON(`data/stocks/${encodeURIComponent(tk)}.json`).catch(() => null);
  if (!d) {
    app.innerHTML = `<div class="card notice">${esc(t("notFound"))}</div>${searchBox("q", go)}`;
    return;
  }
  const inWatch = watch.has(d.t);
  const inCompare = compareList().includes(d.t);
  const flags = (d.flags || []).map((f) => f === "negative_equity" ? t("flagsNegEquity") : f === "no_market_cap" ? t("flagsNoMcap") : "").filter(Boolean);
  app.innerHTML = `
    ${searchBox("q", go)}
    <section class="stock-head">
      <div>
        <h1>${esc(d.name)} <span class="ticker">${esc(d.t)}</span></h1>
        <p class="muted small">${esc(sectorLabel(d.sector))} · ${esc(d.industry || "")}</p>
        <p class="price">${d.price ? `$${d.price.toFixed(2)}` : t("na")} <span class="muted small">${esc(t("price"))} ${esc(d.price_date || "")} · ${esc(t("marketCap"))} ${fmtMoney(d.market_cap)}</span></p>
        ${d.price_stale ? `<p class="warn small">${esc(t("staleNote"))}</p>` : ""}
      </div>
      <div class="actions">
        <button id="watch-btn" class="btn ${inWatch ? "on" : ""}" aria-pressed="${inWatch}">${inWatch ? "★" : "☆"} ${esc(inWatch ? t("removeWatch") : t("addWatch"))}</button>
        <button id="cmp-btn" class="btn" ${inCompare ? "disabled" : ""}>⇄ ${esc(t("addCompare"))}</button>
      </div>
    </section>

    <section class="card score-card">
      ${ring(d.score)}
      <div>
        <div class="op-big">${opinionBadge(d.opinion, d.score)}</div>
        <p>${esc(t("summaryLine", fmtScore(d.score), opinionLabel(d.opinion)))}</p>
        <p class="muted small">${esc(t("dataBasis", d.filing?.form, d.filing?.filed, d.price_date))}</p>
      </div>
    </section>

    <section>
      <h2>${esc(t("categoriesTitle"))}</h2>
      <div class="cats">${CATEGORIES.map((c) => {
        const cat = d.categories[c.key] || {};
        return `<div class="card cat">
          <div class="cat-head"><b>${esc(c[lang])}</b>${scoreChip(cat.score)}</div>
          <div class="bar"><i class="${scoreClass(cat.score)}" style="--w:${cat.score ?? 0}%"></i></div>
          <p class="small">${esc(cat.text?.[lang] || "")}</p></div>`;
      }).join("")}</div>
      ${flags.map((f) => `<p class="muted small">ⓘ ${esc(f)}</p>`).join("")}
    </section>

    <details class="card fin" id="fin">
      <summary><h2>${esc(t("financialsTitle"))}</h2></summary>
      <div class="charts">
        <figure><figcaption>${esc(t("chartRevenue"))}</figcaption><div class="chart-box"><canvas id="c-rev"></canvas></div></figure>
        <figure><figcaption>${esc(t("chartFcf"))}</figcaption><div class="chart-box"><canvas id="c-fcf"></canvas></div></figure>
        <figure><figcaption>${esc(t("chartMargin"))}</figcaption><div class="chart-box"><canvas id="c-mar"></canvas></div></figure>
        <figure><figcaption>${esc(t("chartDebt"))}</figcaption><div class="chart-box"><canvas id="c-de"></canvas></div></figure>
      </div>
      <h3>${esc(t("keyFigures"))}</h3>
      <dl class="figures">${KEY_FIGURES.map((k) => `<div><dt>${esc(k[lang])}</dt><dd>${fmtValue(d.key?.[k.key], k.fmt)}</dd></div>`).join("")}</dl>
    </details>`;

  document.getElementById("watch-btn").onclick = () => { watch.toggle(d.t); viewStock(d.t); };
  document.getElementById("cmp-btn").onclick = () => {
    setCompare([...compareList().filter((x) => x !== d.t), d.t]);
    location.hash = "#/compare";
  };
  document.getElementById("fin").addEventListener("toggle", (e) => { if (e.target.open) drawCharts(d.charts || []); });
}

function ring(score) {
  const s = score ?? 0, r = 52, c = 2 * Math.PI * r;
  return `<svg class="ring ${scoreClass(score)}" viewBox="0 0 120 120" role="img" aria-label="${fmtScore(score)} / 100">
    <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${(c * s) / 100} ${c}" transform="rotate(-90 60 60)"/>
    <text x="60" y="62" class="ring-num">${fmtScore(score)}</text>
    <text x="60" y="84" class="ring-sub">${esc(t("outOf100"))}</text></svg>`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawCharts(rows) {
  charts.forEach((c) => c.destroy());
  charts = [];
  if (!window.Chart || !rows.length) return;
  const labels = rows.map((r) => "FY" + r.fy);
  const ink = cssVar("--muted"), grid = cssVar("--line");
  const c1 = cssVar("--series-1"), c2 = cssVar("--series-2");
  const money = (v) => fmtMoney(v);
  const base = (yfmt) => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { color: ink, boxWidth: 12 } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${yfmt(ctx.parsed.y)}` } } },
    scales: { x: { ticks: { color: ink }, grid: { display: false } }, y: { ticks: { color: ink, callback: yfmt }, grid: { color: grid } } },
  });
  const mk = (id, cfg) => charts.push(new Chart(document.getElementById(id), cfg));
  mk("c-rev", { type: "bar", data: { labels, datasets: [
    { label: t("revenue"), data: rows.map((r) => r.revenue), backgroundColor: c1, borderRadius: 4 },
    { label: t("netIncome"), data: rows.map((r) => r.net_income), backgroundColor: c2, borderRadius: 4 }] }, options: base(money) });
  mk("c-fcf", { type: "bar", data: { labels, datasets: [
    { label: t("fcf"), data: rows.map((r) => r.fcf), backgroundColor: c1, borderRadius: 4 }] }, options: { ...base(money), plugins: { ...base(money).plugins, legend: { display: false } } } });
  const pct = (v) => (v === null || v === undefined ? "" : (v * 100).toFixed(1) + "%");
  mk("c-mar", { type: "line", data: { labels, datasets: [
    { label: t("chartMargin"), data: rows.map((r) => r.operating_margin), borderColor: c1, backgroundColor: c1, tension: 0.25, spanGaps: true }] },
    options: { ...base(pct), plugins: { ...base(pct).plugins, legend: { display: false } } } });
  const times = (v) => (v === null || v === undefined ? "" : v.toFixed(1) + "x");
  mk("c-de", { type: "line", data: { labels, datasets: [
    { label: t("chartDebt"), data: rows.map((r) => r.debt_to_equity), borderColor: c2, backgroundColor: c2, tension: 0.25, spanGaps: true }] },
    options: { ...base(times), plugins: { ...base(times).plugins, legend: { display: false } } } });
}

// ---------- 화면: 순위표 ----------
async function viewRank(params) {
  const idx = await loadIndex();
  const sector = params.get("sector") || "";
  const sort = params.get("sort") || "total";
  const ci = CATEGORIES.findIndex((c) => c.key === sort);
  let rows = idx.filter((r) => !sector || r.s === sector);
  rows = [...rows].sort((a, b) => (ci >= 0 ? (b.c[ci] ?? -1) - (a.c[ci] ?? -1) : b.sc - a.sc));
  const sectors = Object.keys(SECTORS).filter((s) => idx.some((r) => r.s === s));
  app.innerHTML = `<h1>${esc(t("rankings"))}</h1>
    <div class="filters">
      <label>${esc(t("sector"))} <select id="f-sector"><option value="">${esc(t("allSectors"))}</option>
        ${sectors.map((s) => `<option value="${esc(s)}" ${s === sector ? "selected" : ""}>${esc(sectorLabel(s))}</option>`).join("")}</select></label>
      <label>${esc(t("sortBy"))} <select id="f-sort"><option value="total">${esc(t("total"))}</option>
        ${CATEGORIES.map((c) => `<option value="${c.key}" ${c.key === sort ? "selected" : ""}>${esc(c[lang])}</option>`).join("")}</select></label>
    </div>
    ${idx.length ? rowsTable(rows, { showSector: !sector }) : `<div class="card notice">${esc(t("noData"))}</div>`}`;
  const upd = () => {
    const p = new URLSearchParams();
    const s = document.getElementById("f-sector").value, o = document.getElementById("f-sort").value;
    if (s) p.set("sector", s);
    if (o !== "total") p.set("sort", o);
    location.hash = "#/rank" + (p.toString() ? "?" + p : "");
  };
  document.getElementById("f-sector").onchange = upd;
  document.getElementById("f-sort").onchange = upd;
  bindRowLinks();
}

// ---------- 화면: 비교 ----------
async function viewCompare() {
  await loadIndex();
  const list = compareList();
  const ds = (await Promise.all(list.map((tk) => getJSON(`data/stocks/${encodeURIComponent(tk)}.json`).catch(() => null)))).filter(Boolean);
  const head = `<tr><th>${esc(t("metric"))}</th>${ds.map((d) => `<th><a href="#/s/${esc(d.t)}">${esc(d.t)}</a>
    <button class="link small" data-rm="${esc(d.t)}">✕ ${esc(t("remove"))}</button></th>`).join("")}</tr>`;
  const row = (label, cells) => `<tr><th>${label}</th>${cells.join("")}</tr>`;
  const best = (vals, higher = true) => {
    const nums = vals.filter((v) => v !== null && v !== undefined && isFinite(v));
    if (nums.length < 2) return null;
    return higher ? Math.max(...nums) : Math.min(...nums);
  };
  let body = "";
  if (ds.length) {
    const scores = ds.map((d) => d.score);
    const b = best(scores);
    body += row(esc(t("score")), ds.map((d) => `<td class="num ${d.score === b ? "best" : ""}"><b>${fmtScore(d.score)}</b></td>`));
    body += row(esc(t("opinion")), ds.map((d) => `<td>${opinionBadge(d.opinion, d.score)}</td>`));
    body += row(esc(t("sector")), ds.map((d) => `<td class="small">${esc(sectorLabel(d.sector))}</td>`));
    for (const c of CATEGORIES) {
      const vals = ds.map((d) => d.categories[c.key]?.score);
      const bb = best(vals);
      body += row(esc(c[lang]), vals.map((v) => `<td class="num ${v === bb ? "best" : ""}">${scoreChip(v)}</td>`));
    }
    body += row(esc(t("marketCap")), ds.map((d) => `<td class="num">${fmtMoney(d.market_cap)}</td>`));
    for (const k of KEY_FIGURES) {
      body += row(esc(k[lang]), ds.map((d) => `<td class="num">${fmtValue(d.key?.[k.key], k.fmt)}</td>`));
    }
  }
  app.innerHTML = `<h1>${esc(t("compareTitle"))}</h1><p class="muted">${esc(t("compareHint"))}</p>
    ${list.length < 4 ? searchBox("cq", (tk) => { setCompare([...compareList().filter((x) => x !== tk), tk]); viewCompare(); }) : ""}
    ${ds.length ? `<div class="table-wrap"><table class="compare"><thead>${head}</thead><tbody>${body}</tbody></table></div>` : ""}`;
  app.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { setCompare(compareList().filter((x) => x !== b.dataset.rm)); viewCompare(); }));
}

// ---------- 화면: 관심종목 ----------
async function viewWatch() {
  const idx = await loadIndex();
  const w = watch.list().map((tk) => idx.find((r) => r.t === tk)).filter(Boolean);
  app.innerHTML = `<h1>${esc(t("watchlist"))}</h1>${w.length ? rowsTable(w) : `<p class="muted">${esc(t("emptyWatch"))}</p>`}`;
  bindRowLinks();
}

// ---------- 머리말 / 꼬리말 / 라우터 ----------
function renderChrome(meta) {
  document.getElementById("nav").innerHTML = `
    <a class="brand" href="#/">${esc(t("siteName"))}</a>
    <nav>
      <a href="#/rank">${esc(t("rankings"))}</a>
      <a href="#/compare">${esc(t("compare"))}${compareList().length ? ` <span class="count">${compareList().length}</span>` : ""}</a>
      <a href="#/watch">${esc(t("watchlist"))}</a>
    </nav>
    <div class="toggles">
      <button id="lang-btn" class="btn ghost small">${esc(t("lang"))}</button>
      <button id="theme-btn" class="btn ghost small">${esc(isDark() ? t("lightMode") : t("darkMode"))}</button>
    </div>`;
  document.getElementById("footer").innerHTML = `
    <p class="disclaimer">${esc(t("disclaimer"))}</p>
    <p class="muted small">${esc(t("sources"))}${meta?.updated ? ` · ${esc(t("updated"))} ${esc(fmtDate(meta.updated))}` : ""}</p>`;
  document.getElementById("lang-btn").onclick = () => { setLang(lang === "ko" ? "en" : "ko"); route(); };
  document.getElementById("theme-btn").onclick = () => { toggleTheme(); route(); };
}

function isDark() {
  const th = document.documentElement.dataset.theme;
  return th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

let metaCache = null;
async function route() {
  const hash = location.hash.slice(1) || "/";
  const [path, qs] = hash.split("?");
  const params = new URLSearchParams(qs || "");
  charts.forEach((c) => c.destroy());
  charts = [];
  if (!metaCache) metaCache = await getJSON("data/meta.json").catch(() => null);
  renderChrome(metaCache);
  app.innerHTML = `<p class="muted">${esc(t("loading"))}</p>`;
  try {
    const m = path.match(/^\/s\/([A-Za-z0-9.\-]{1,10})$/);
    if (m) await viewStock(decodeURIComponent(m[1]).toUpperCase());
    else if (path === "/rank") await viewRank(params);
    else if (path === "/compare") await viewCompare();
    else if (path === "/watch") await viewWatch();
    else await viewHome();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card notice">${esc(t("loadError"))}</div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
