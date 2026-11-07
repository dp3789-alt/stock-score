// 관리자 화면: 암호화된 관리자 데이터를 브라우저 안에서만 풀어 보여준다.
import { esc, fmtDate, initTheme, toggleTheme } from "./common.js";
import { CATEGORIES, OPINIONS, SECTORS } from "./i18n.js";

initTheme();
document.getElementById("theme-btn").onclick = toggleTheme;

const LABELS = {
  roe: "ROE", roa: "ROA", operating_margin: "영업이익률", net_margin: "순이익률", fcf_margin: "FCF 마진",
  revenue_cagr_3y: "3년 매출 CAGR", eps_cagr_3y: "3년 EPS CAGR", revenue_growth_ttm: "TTM 매출 성장률",
  fcf_cagr_3y: "3년 FCF CAGR", revenue_growth_consistency: "매출 성장 꾸준함",
  debt_to_equity: "부채비율(D/E)", current_ratio: "유동비율", interest_coverage: "이자보상배율",
  fcf_positive_years: "FCF 흑자 연수 비율", dividend_stability: "배당 안정성", equity_ratio: "자기자본비율(금융업)",
  pe: "PER", pb: "PBR", ev_ebitda: "EV/EBITDA", fcf_yield: "FCF 수익률", peg: "PEG",
  quick_ratio: "당좌비율", inventory_to_current_assets: "유동자산 중 재고 비중", receivables_days: "매출채권 회수기간(일)",
  allowance_ratio: "대손충당금 비율", inventory_build: "재고 증가율 - 매출 증가율", inventory_reserve_ratio: "재고 평가충당금 비율",
  inventory_writedown_ratio: "재고 평가손실 비율", intangibles_to_assets: "무형자산·영업권 비중", ppe_age: "설비 노후도",
  ppe_to_assets: "유형자산 비중", liabilities_to_equity: "부채비율(총부채/자기자본)", borrowings_to_assets: "차입금의존도",
};
const GROUPS = { liquidity: "유동성", asset_quality: "자산의 질", structure: "부채비율·재무구조" };
const groupName = (g) => GROUPS[g] || g;
const RAW_HEALTH = [
  ["balance_date", "결산일"], ["total_assets", "총자산"], ["current_assets", "유동자산"], ["inventory", "재고자산"],
  ["quick_assets", "당좌자산(유동자산-재고)"], ["current_liabilities", "유동부채"], ["receivables", "매출채권(순액)"],
  ["receivables_allowance", "매출채권 대손충당금"], ["loans", "대출채권(순액)"], ["loan_allowance", "대출 대손충당금"],
  ["inventory_reserve", "재고자산 평가충당금"], ["inventory_writedown_ttm", "재고 평가손실(최근 1년)"],
  ["goodwill", "영업권"], ["intangibles", "무형자산(영업권 포함)"], ["ppe_net", "유형자산(순액)"], ["ppe_gross", "유형자산(취득원가)"],
  ["ppe_accum_dep", "감가상각누계액"], ["total_liabilities", "총부채"], ["total_equity", "자본총계"], ["borrowings", "차입금"],
  ["borrowings_basis", "차입금 계산 방식"],
];
const money = (v) => (typeof v !== "number" ? esc(v ?? "–") : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + "B" : (v / 1e6).toFixed(1) + "M");
const PCT = new Set(["roe", "roa", "operating_margin", "net_margin", "fcf_margin", "revenue_cagr_3y", "eps_cagr_3y",
  "revenue_growth_ttm", "fcf_cagr_3y", "revenue_growth_consistency", "fcf_positive_years", "fcf_yield", "dividend_stability", "equity_ratio",
  "inventory_to_current_assets", "allowance_ratio", "inventory_build", "inventory_reserve_ratio", "inventory_writedown_ratio",
  "intangibles_to_assets", "ppe_age", "ppe_to_assets", "liabilities_to_equity", "borrowings_to_assets"]);
const catName = (k) => CATEGORIES.find((c) => c.key === k)?.ko || k;
const opName = (k) => OPINIONS[k]?.ko || k;
const raw = (m, v) => (v === null || v === undefined ? "–" : m === "liabilities_to_equity" && v < 0 ? "자본잠식"
  : m === "receivables_days" ? Number(v).toFixed(0) + "일" : PCT.has(m) ? (v * 100).toFixed(1) + "%" : Number(v).toFixed(2));

let data = null;       // 복호화된 관리자 데이터 (메모리에만)
let sim = null;        // 시뮬레이션용 설정 사본
let idleTimer = null;
const IDLE_MS = 15 * 60 * 1000;

// ---------- 복호화 ----------
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(blob, pass) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64(blob.iv), additionalData: enc.encode(blob.aad) }, key, b64(blob.ct));
  const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

document.getElementById("unlock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const passEl = document.getElementById("pass");
  const msg = document.getElementById("lock-msg");
  const btn = document.getElementById("unlock-btn");
  btn.disabled = true;
  msg.className = "small muted";
  msg.textContent = "확인 중…";
  try {
    const res = await fetch("data/admin.enc.json", { cache: "no-store" });
    if (!res.ok) throw new Error("nofile");
    const blob = await res.json();
    data = await decrypt(blob, passEl.value);
    passEl.value = "";
    sim = structuredClone(data.config);
    document.getElementById("lock").hidden = true;
    document.getElementById("panel").hidden = false;
    document.getElementById("lock-btn").hidden = false;
    render();
    armIdle();
  } catch (err) {
    msg.className = "small err";
    msg.textContent = err.message === "nofile"
      ? "관리자 데이터 파일이 아직 없어요. 엔진이 한 번 실행된 뒤에 열 수 있어요."
      : "암호가 맞지 않아요.";
    await new Promise((r) => setTimeout(r, 1200));
  } finally {
    btn.disabled = false;
  }
});

function lock() {
  data = null;
  sim = null;
  document.getElementById("panel").innerHTML = "";
  document.getElementById("panel").hidden = true;
  document.getElementById("lock").hidden = false;
  document.getElementById("lock-btn").hidden = true;
  document.getElementById("lock-msg").textContent = "잠겼어요.";
}
document.getElementById("lock-btn").onclick = lock;
function armIdle() {
  clearTimeout(idleTimer);
  if (data) idleTimer = setTimeout(lock, IDLE_MS);
}
["click", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, armIdle, { passive: true }));

// ---------- 점수 재계산 (엔진과 같은 방식) ----------
function applicable(m, spec, sector, cfg) {
  if ((cfg.sector_exclusions?.[sector] || []).includes(m)) return false;
  return !spec.sectors_only || spec.sectors_only.includes(sector);
}

// 지표 묶음의 가중 평균. 적용 지표 가중치 중 값이 있는 비율이 기준 미만이면 null.
function weighted(row, specs, cfg) {
  const app = Object.entries(specs).filter(([m, s]) => applicable(m, s, row.sector, cfg));
  const totalW = app.reduce((a, [, s]) => a + Number(s.weight), 0);
  let w = 0, acc = 0;
  for (const [m, s] of Object.entries(specs)) {
    const v = row.metric_scores[m];
    if (v === undefined || v === null) continue;
    w += Number(s.weight);
    acc += v * Number(s.weight);
  }
  return { score: !w || !totalW || w / totalW < cfg.min_metric_coverage ? null : acc / w, totalW };
}

function catGroups(cfg, cat) {
  return Object.fromEntries(Object.entries(cfg.groups?.[cat] || {}).filter(([g]) => !g.startsWith("_")));
}

function simulateRow(row, cfg) {
  const cats = {}, groups = {};
  for (const [cat, specs] of Object.entries(cfg.metrics)) {
    const gs = catGroups(cfg, cat);
    if (!Object.keys(gs).length) { cats[cat] = weighted(row, specs, cfg).score; continue; }
    // 소분류(유동성·자산의 질·재무구조) 점수를 먼저 내고 소분류 비중으로 합친다
    let acc = 0, w = 0;
    groups[cat] = {};
    for (const [g, gv] of Object.entries(gs)) {
      const sub = Object.fromEntries(Object.entries(specs).filter(([, s]) => s.group === g));
      const r = weighted(row, sub, cfg);
      groups[cat][g] = r.totalW ? r.score : null;
      if (r.totalW && r.score !== null) { acc += r.score * Number(gv.weight); w += Number(gv.weight); }
    }
    cats[cat] = w ? acc / w : null;
  }
  cats.macro = row.categories.macro;
  let tw = 0, tot = 0;
  for (const [c, v] of Object.entries(cfg.categories)) {
    tw += Number(v.weight);
    tot += (cats[c] ?? 50) * Number(v.weight);
  }
  const total = tw ? tot / tw : 0;
  const bands = [...cfg.opinion_bands].sort((a, b) => b.min - a.min);
  const op = (bands.find((b) => total >= b.min) || bands[bands.length - 1]).key;
  return { total, op, cats, groups };
}

// ---------- 화면 ----------
function render() {
  const rows = data.rows;
  const tickers = Object.keys(rows).sort();
  document.getElementById("panel").innerHTML = `
    <section>
      <h1>관리자</h1>
      <p class="muted small">데이터 생성: ${esc(fmtDate(data.generated))} · 종목 ${tickers.length}개 · 15분 동안 사용하지 않으면 자동으로 잠겨요.</p>
    </section>
    <div class="admin-grid">
      <section class="card"><h2>거시경제 신호</h2>${macroTable()}</section>
      <section class="card"><h2>가중치 시뮬레이션</h2><div id="weights"></div></section>
    </div>
    <section class="card"><h2>의견 분포 (현재 → 시뮬레이션)</h2><div id="dist"></div></section>
    <section><h2>종목별 결과</h2>
      <div class="filters"><select id="sector-f"><option value="">전체 업종</option>
        ${Object.keys(SECTORS).map((s) => `<option value="${esc(s)}">${esc(SECTORS[s])}</option>`).join("")}</select>
        <select id="sort-f"><option value="sim">시뮬레이션 점수순</option><option value="delta">변화 큰 순</option><option value="cur">현재 점수순</option></select></div>
      <div id="table"></div></section>
    <section class="card"><h2>종목 계산 과정</h2>
      <select id="inspect" class="field"><option value="">종목 선택</option>${tickers.map((t) => `<option>${esc(t)}</option>`).join("")}</select>
      <div id="inspect-out"></div></section>`;
  renderWeights();
  renderResults();
  document.getElementById("sector-f").onchange = renderResults;
  document.getElementById("sort-f").onchange = renderResults;
  document.getElementById("inspect").onchange = (e) => renderInspect(e.target.value);
}

function macroTable() {
  const s = data.macro_signals || {};
  const rawm = data.macro_raw || {};
  const names = { rates_rising: "금리 상승", inflation_rising: "물가 상승", labor_weakening: "고용 둔화", growth_strong: "경기 성장", curve_steep: "금리차 확대" };
  return `<table class="mini"><thead><tr><th>요인</th><th class="num">신호 (-1~+1)</th></tr></thead><tbody>
    ${Object.entries(s).map(([k, v]) => `<tr><td>${esc(names[k] || k)}</td><td class="num">${v.toFixed(2)}</td></tr>`).join("")}
    </tbody></table>
    <p class="muted small">${Object.entries(rawm).map(([k, v]) => `${esc(k)}: ${esc(v.value)} (${esc(v.date)})`).join(" · ")}</p>`;
}

function renderWeights() {
  const el = document.getElementById("weights");
  const catInputs = Object.entries(sim.categories).map(([c, v]) => `
    <label>${esc(catName(c))}<input class="field" type="number" min="0" max="100" step="1" data-cat="${c}" value="${v.weight}"></label>`).join("");
  const metricInput = (c, m, s) => `<label>${esc(LABELS[m] || m)}<input class="field" type="number" min="0" max="100" step="1" data-cat="${c}" data-metric="${m}" value="${s.weight}"></label>`;
  const metricInputs = Object.entries(sim.metrics).map(([c, specs]) => {
    const gs = catGroups(sim, c);
    const body = Object.keys(gs).length
      ? `<div class="weights sub-weights">${Object.entries(gs).map(([g, gv]) => `<label>${esc(groupName(g))} 비중(%)<input class="field" type="number" min="0" max="100" step="1" data-cat="${c}" data-group="${g}" value="${gv.weight}"></label>`).join("")}</div>`
        + Object.keys(gs).map((g) => `<p class="small muted">${esc(groupName(g))} 안의 지표</p><div class="weights sub-weights">${Object.entries(specs).filter(([, s]) => s.group === g).map(([m, s]) => metricInput(c, m, s)).join("")}</div>`).join("")
      : `<div class="weights sub-weights">${Object.entries(specs).map(([m, s]) => metricInput(c, m, s)).join("")}</div>`;
    return `<details class="sub"><summary>${esc(catName(c))} 세부 지표</summary>${body}</details>`;
  }).join("");
  const bandInputs = sim.opinion_bands.filter((b) => b.min > 0).map((b) => `
    <label>${esc(opName(b.key))} 최소 점수<input class="field" type="number" min="0" max="100" step="1" data-band="${b.key}" value="${b.min}"></label>`).join("");
  el.innerHTML = `<div class="weights">${catInputs}<p class="sum muted" id="cat-sum"></p></div>
    ${metricInputs}
    <details class="sub"><summary>의견 구간</summary><div class="weights sub-weights">${bandInputs}</div></details>
    <div class="row-actions"><button class="btn" id="reset-w">원래대로</button><button class="btn" id="export-w">설정 내보내기</button></div>
    <div id="export-out"></div>`;
  const updSum = () => {
    const s = Object.values(sim.categories).reduce((a, v) => a + Number(v.weight), 0);
    document.getElementById("cat-sum").textContent = `카테고리 합계: ${s} ${s === 100 ? "" : "(합계가 100이 아니어도 비율로 계산해요)"}`;
  };
  updSum();
  el.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    const v = Math.max(0, Math.min(100, Number(inp.value) || 0));
    if (inp.dataset.band) sim.opinion_bands.find((b) => b.key === inp.dataset.band).min = v;
    else if (inp.dataset.group) sim.groups[inp.dataset.cat][inp.dataset.group].weight = v;
    else if (inp.dataset.metric) sim.metrics[inp.dataset.cat][inp.dataset.metric].weight = v;
    else sim.categories[inp.dataset.cat].weight = v;
    updSum();
    renderResults();
  }));
  document.getElementById("reset-w").onclick = () => { sim = structuredClone(data.config); renderWeights(); renderResults(); };
  document.getElementById("export-w").onclick = () => {
    const out = {
      categories: Object.fromEntries(Object.entries(sim.categories).map(([k, v]) => [k, v.weight])),
      groups: Object.fromEntries(Object.keys(sim.groups || {}).filter((c) => !c.startsWith("_")).map((c) => [c, Object.fromEntries(Object.entries(catGroups(sim, c)).map(([g, v]) => [g, v.weight]))])),
      metrics: Object.fromEntries(Object.entries(sim.metrics).map(([c, ms]) => [c, Object.fromEntries(Object.entries(ms).map(([m, s]) => [m, s.weight]))])),
      opinion_bands: Object.fromEntries(sim.opinion_bands.map((b) => [b.key, b.min])),
    };
    const text = JSON.stringify(out, null, 2);
    document.getElementById("export-out").innerHTML = `<p class="small muted">아래 내용을 복사해 Claude에게 "이 가중치로 반영해줘"라고 보내주세요.</p><pre class="export">${esc(text)}</pre>`;
    navigator.clipboard?.writeText(text).catch(() => {});
  };
}

function renderResults() {
  const sector = document.getElementById("sector-f")?.value || "";
  const sort = document.getElementById("sort-f")?.value || "sim";
  const list = Object.entries(data.rows).map(([t, r]) => {
    const s = simulateRow(r, sim);
    return { t, r, s, d: s.total - r.total };
  });
  const keys = ["strong_buy", "buy", "hold", "sell", "strong_sell"];
  const count = (f) => Object.fromEntries(keys.map((k) => [k, list.filter((x) => f(x) === k).length]));
  const cur = count((x) => x.r.opinion), nw = count((x) => x.s.op);
  document.getElementById("dist").innerHTML = `<div class="dist">${keys.map((k) => `<span><b>${esc(opName(k))}</b> ${cur[k]} → ${nw[k]}</span>`).join(" · ")}</div>`;
  const rows = list.filter((x) => !sector || x.r.sector === sector);
  rows.sort((a, b) => sort === "delta" ? Math.abs(b.d) - Math.abs(a.d) : sort === "cur" ? b.r.total - a.r.total : b.s.total - a.s.total);
  document.getElementById("table").innerHTML = `<div class="table-wrap"><table class="mini">
    <thead><tr><th>티커</th>${CATEGORIES.map((c) => `<th class="num hide-sm">${esc(c.short.ko)}</th>`).join("")}<th class="num">현재</th><th class="num">시뮬</th><th class="num">변화</th><th>의견</th></tr></thead>
    <tbody>${rows.slice(0, 600).map(({ t, r, s, d }) => `<tr data-t="${esc(t)}">
      <td><a href="./#/s/${esc(t)}">${esc(t)}</a></td>
      ${CATEGORIES.map((c) => `<td class="num hide-sm">${s.cats[c.key] === null || s.cats[c.key] === undefined ? "–" : Math.round(s.cats[c.key])}</td>`).join("")}
      <td class="num">${r.total.toFixed(1)}</td><td class="num"><b>${s.total.toFixed(1)}</b></td>
      <td class="num ${d > 0.05 ? "delta-up" : d < -0.05 ? "delta-down" : ""}">${d >= 0 ? "+" : ""}${d.toFixed(1)}</td>
      <td class="small">${esc(opName(r.opinion))}${r.opinion !== s.op ? ` → <b>${esc(opName(s.op))}</b>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("#table tr[data-t]").forEach((tr) => tr.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    document.getElementById("inspect").value = tr.dataset.t;
    renderInspect(tr.dataset.t);
    document.getElementById("inspect").scrollIntoView({ behavior: "smooth" });
  }));
}

function renderInspect(t) {
  const out = document.getElementById("inspect-out");
  const r = data.rows[t];
  if (!r) { out.innerHTML = ""; return; }
  const s = simulateRow(r, sim);
  const metricRow = (m, sp) => {
    const ms = r.metric_scores[m];
    if (!applicable(m, sp, r.sector, sim)) return "";
    return `<tr><td>${esc(LABELS[m] || m)}</td><td class="num">${raw(m, r.metrics[m])}</td>
      <td class="num">${ms === undefined ? "<span class='muted'>제외</span>" : ms.toFixed(1)}</td>
      <td class="num">${sp.weight}</td><td class="small muted">${sp.better === "lower" ? "낮을수록 좋음" : "높을수록 좋음"}</td></tr>`;
  };
  const head = `<thead><tr><th>지표</th><th class="num">원값</th><th class="num">업종 내 점수</th><th class="num">가중치</th><th></th></tr></thead>`;
  const sections = Object.entries(sim.metrics).map(([cat, specs]) => {
    const gs = catGroups(sim, cat);
    let body;
    if (Object.keys(gs).length) {
      body = Object.entries(gs).map(([g, gv]) => {
        const gsc = s.groups?.[cat]?.[g];
        const rows = Object.entries(specs).filter(([, sp]) => sp.group === g).map(([m, sp]) => metricRow(m, sp)).join("");
        return `<tr><th colspan="5">${esc(groupName(g))} (비중 ${gv.weight}%) · ${gsc === null || gsc === undefined ? "적용 안 함/데이터 부족" : gsc.toFixed(1) + "점"}</th></tr>${rows}`;
      }).join("");
    } else {
      body = Object.entries(specs).map(([m, sp]) => metricRow(m, sp)).join("");
    }
    const cs = r.categories[cat];
    const extra = cat === "health" && r.info?.health ? `<details class="sub"><summary>재무상태표 원자료</summary><div class="table-wrap"><table class="mini"><tbody>
      ${RAW_HEALTH.map(([k, label]) => `<tr><td>${esc(label)}</td><td class="num">${money(r.info.health[k])}</td></tr>`).join("")}</tbody></table></div></details>` : "";
    return `<h3>${esc(catName(cat))} · ${cs === null ? "데이터 부족(50 처리)" : cs.toFixed(1)}점 <span class="muted small">(커버리지 ${(r.coverage[cat] * 100).toFixed(0)}%)</span></h3>
      <div class="table-wrap"><table class="mini">${head}<tbody>${body}</tbody></table></div>${extra}`;
  }).join("");
  const mc = r.macro || {};
  out.innerHTML = `
    <p><b>${esc(t)}</b> ${esc(r.name || "")} · ${esc(SECTORS[r.sector] || r.sector || "")} · 총점 ${r.total.toFixed(1)} (${esc(opName(r.opinion))}) · 시뮬레이션 ${s.total.toFixed(1)} (${esc(opName(s.op))})</p>
    <p class="small muted">공시 ${esc(r.filing?.form || "-")} ${esc(r.filing?.filed || "")} · 종가 출처 ${esc(r.price_source || "-")} · 플래그 ${esc((r.flags || []).join(", ") || "없음")}</p>
    ${sections}
    <h3>경제 환경 · ${r.categories.macro.toFixed(1)}점</h3>
    <p class="small">업종 점수 ${mc.sector_score} + 기업 보정(차입금의존도×금리) ${mc.company_adjustment}</p>
    <p class="small muted">요인별 기여: ${Object.entries(mc.contributions || {}).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}</p>`;
}
