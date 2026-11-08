// My cellars: a box per cellar, then At a glance and the sortable table for the one that's open.
// Loaded after app.js and somm.js, in the same global scope. Counts are wines, not bottles.
const mc = { colour: "", country: "", grape: "", region: "", stage: "", score: "", vint: "", ends: "", mood: "all", col: "drink", dir: 1, more: {} };
let mcTried = false; // somm.json holds the books the ⚡ column and the moods read
const clearMcFilters = () => Object.assign(mc, { colour: "", country: "", grape: "", region: "", stage: "", score: "", vint: "", ends: "", mood: "all" });

// The cellars on this computer as [value, title, source]; value is what mwView.owner holds.
function mcCellars() {
  return [...Object.keys(myWines.cellars).map((o) => [o, `${o}'s cellar`, `${o}'s cellar`]),
    ...visibleShared().map(([slot]) => [cellarLabel(slot), cellarTitle(slot), cellarTitle(slot)])];
}
const mcOpenCellar = () => mcCellars().find(([v]) => v === mwView.owner);
const mcWinesOf = (owner) => cellarFindWines().filter((w) => w.owner === owner);

function renderCellarBoxes() {
  const box = (value, name, n, lines, tone) => `<button type="button" class="mc-box${tone}" data-action="mw-owner" data-owner="${esc(value)}" aria-pressed="${mwView.owner === value}">
    <span class="mc-box-name">${esc(name)}</span><span class="mc-box-n">${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}</span>${lines.map((l) => `<span class="mc-box-line">${esc(l)}</span>`).join("")}</button>`;
  $("mc-boxes").innerHTML = mcCellars().map(([value, title, source]) => {
    const wines = mcWinesOf(value), soon = wines.filter((w) => ["first", "soon"].includes(drinkStage(w))).length;
    const bottles = wines.reduce((sum, w) => sum + (w.quantity || 0), 0);
    return box(value, title, wines.length, [`${soon ? `🔴 ${soon}` : "None"} to drink soon`, ...(bottles ? [`${bottles.toLocaleString()} bottles`] : [])], cellarTone(source));
  }).join("") + box("manual", "Wines added by hand", myWines.manual.length, [], " mc-box-hand");
}

// A range kept as "from:to", either end open.
const inRange = (n, range) => { const [a, b] = range.split(":"); return n != null && (a === "" || n >= +a) && (b === "" || n <= +b); };
function rangeWords(k, range) {
  const [a, b] = range.split(":");
  if (k === "vint") return a === "" ? `Vintages before ${+b + 1}` : `Vintage ${a}`;
  return a === "" ? `Windows ended before ${+b + 1}` : b === "" ? `Windows ending after ${+a - 1}` : a === b ? `Windows ending ${a}` : `Windows ending ${a} to ${b}`;
}
// The cellar files name the appellation; a Grand Cru counts with its region here.
const regionOf = (w) => { const r = (w.region_or_grape || "").replace(/\s+(Grand Cru|1er Cru)$/, ""); return r === "Unknown" ? "" : r; };
const SCORE_BANDS = [["95:", "95 and over"], ["90:94", "90 to 94"], ["85:89", "85 to 89"], [":84", "Under 85"], ["none", "Not scored"]];
const inScoreBand = (w, band) => { const n = bestScore(w); return band === "none" ? n == null : n != null && inRange(Math.round(n), band); };
function mcPasses(w, skipMood = false) {
  return (skipMood || MOODS[mc.mood].test(w)) && (!mc.colour || w.type === mc.colour) && (!mc.country || w.country === mc.country) &&
    (!mc.grape || w.varietal === mc.grape) && (!mc.region || regionOf(w) === mc.region) && (!mc.stage || drinkStage(w) === mc.stage) &&
    (!mc.score || inScoreBand(w, mc.score)) && (!mc.vint || inRange(w.vintage, mc.vint)) && (!mc.ends || inRange(w.drink_to, mc.ends));
}
// [value, its wines], biggest first.
const groupWines = (wines, get) => { const m = new Map();
  for (const w of wines) { const v = get(w); if (v && v !== "Country not stated") (m.get(v) || m.set(v, []).get(v)).push(w); }
  return [...m].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(b[0])); };

// ---- At a glance ----------------------------------------------------------------------
// Colour means the same on every chart: the wine's colour, or how soon to drink it.
// Checked for colour-blind separation; every mark also has a number or a label beside it.
const WINE_TONES = { Red: "#b5203c", White: "#d9a400", "Rosé": "#f07fb3", Sparkling: "#1a7fa8", Dessert: "#e8761a", Fortified: "#9a5a1c" };
const STAGE_TONES = { first: "#d32f2f", soon: "#f08c00", ready: "#2e9e4f", wait: "#3f74c4" };
const toneOf = (type) => WINE_TONES[type] || "#6f6a63";
const wineCount = (n) => `${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}`;
function colourParts(wines) {
  const order = Object.keys(WINE_TONES), at = (t) => { const i = order.indexOf(t); return i < 0 ? 99 : i; };
  return groupWines(wines, (w) => w.type || "Other").sort((a, b) => at(a[0]) - at(b[0]));
}
function tipFor(label, wines, part = "") {
  const parts = colourParts(wines).map(([t, l]) => `${l.length} ${t.toLowerCase()}`).join(", ");
  const best = wines.filter((w) => bestScore(w) != null).sort((a, b) => bestScore(b) - bestScore(a))[0];
  return [`${label}: ${wineCount(wines.length)}`, parts, best ? `Best rated: ${best.name} (${Math.round(bestScore(best))})` : "", part ? `Click to list the ${part}` : "Click to list them"].filter(Boolean).join(". ") + ".";
}
const filterAttrs = (k, v, tip, type = "") => `data-mc-k="${k}" data-mc-v="${esc(v)}"${type ? ` data-mc-colour="${esc(type)}"` : ""} data-tip="${esc(tip)}"`;
const isOn = (k, v, type = "") => mc[k] === v && (!type || mc.colour === type);
// One piece of a stack per wine colour; each piece lists just those wines.
function segsHtml(k, v, label, wines, tone = "") {
  if (tone) return `<button type="button" class="mc-seg" style="flex-grow:${wines.length};background:${tone}" aria-label="${esc(label)}" aria-pressed="${isOn(k, v)}" ${filterAttrs(k, v, tipFor(label, wines))}></button>`;
  return colourParts(wines).map(([t, l]) => `<button type="button" class="mc-seg" style="flex-grow:${l.length};background:${toneOf(t)}" aria-label="${esc(`${label}: ${l.length} ${t}`)}" aria-pressed="${isOn(k, v, t)}" ${filterAttrs(k, v, tipFor(label, wines, l.length === 1 ? t.toLowerCase() : `${l.length} ${t.toLowerCase()}`), t)}></button>`).join("");
}
function barRow(k, v, label, wines, top) {
  const tip = tipFor(label, wines);
  return `<div class="mc-bar${isOn(k, v) ? " mc-on" : ""}"><button type="button" class="mc-bar-name" ${filterAttrs(k, v, tip)}>${esc(label)}</button>
    <span class="mc-bar-track"><span class="mc-stack-h" style="width:${Math.max(2, wines.length / top * 100)}%">${k === "colour" ? segsHtml(k, v, label, wines, toneOf(v)) : segsHtml(k, v, label, wines)}</span></span>
    <button type="button" class="mc-bar-n" ${filterAttrs(k, v, tip)}>${wines.length}</button></div>`;
}
function barsHtml(title, k, groups, limit = 0) {
  const top = Math.max(1, ...groups.map((g) => g[1].length)), all = !limit || mc.more[k] || groups.length <= limit;
  return `<div class="mc-card"><h4>${esc(title)}</h4><div class="${mc.more[k] ? "mc-long" : ""}">${(all ? groups : groups.slice(0, limit)).map(([v, l]) => barRow(k, v, v, l, top)).join("")}</div>
    ${limit && groups.length > limit ? `<button type="button" class="linklike mc-more" data-mc-more="${k}">${mc.more[k] ? "Show fewer" : `Show all ${groups.length}`}</button>` : ""}</div>`;
}
function scoresHtml(wines) {
  const rows = SCORE_BANDS.map(([v, label]) => [v, label, wines.filter((w) => inScoreBand(w, v))]).filter((r) => r[2].length);
  const top = Math.max(1, ...rows.map((r) => r[2].length));
  return `<div class="mc-card"><h4>Scores</h4>${rows.map(([v, label, l]) => barRow("score", v, label, l, top)).join("")}</div>`;
}
function readyHtml(wines) {
  const rows = Object.keys(STAGES).map((k) => [k, wines.filter((w) => drinkStage(w) === k)]).filter((r) => r[1].length);
  return `<div class="mc-card"><h4>Ready to drink</h4><div class="mc-ready">${rows.map(([k, l]) => segsHtml("stage", k, STAGES[k].title, l, STAGE_TONES[k])).join("")}</div>
    ${rows.map(([k, l]) => `<button type="button" class="mc-ready-row" aria-pressed="${mc.stage === k}" ${filterAttrs("stage", k, tipFor(STAGES[k].title, l))}><span>${STAGES[k].icon} ${esc(STAGES[k].title)}</span><strong>${l.length}</strong></button>`).join("")}</div>`;
}
function columnsHtml(title, note, k, bins, key = "") {
  const top = Math.max(1, ...bins.map((b) => b.wines.length));
  return `<div class="mc-card mc-card-wide"><h4>${esc(title)}</h4><p class="hint">${esc(note)}</p>${key}
    <div class="mc-cols" style="grid-template-columns:repeat(${bins.length},minmax(0,1fr))">${bins.map((b) => { const n = b.wines.length;
      return `<div class="mc-col${isOn(k, b.v) ? " mc-on" : ""}"><div class="mc-plot">${n ? `<div class="mc-stack" style="height:${Math.max(3, n / top * 100)}%"><button type="button" class="mc-col-n" ${filterAttrs(k, b.v, tipFor(b.name, b.wines))}>${n}</button>${segsHtml(k, b.v, b.name, b.wines, b.tone)}</div>` : ""}</div>
        <span class="mc-col-lab${b.major ? "" : " mc-minor"}">${esc(b.tick)}</span></div>`; }).join("")}</div></div>`;
}
function vintageBins(wines) {
  const dated = wines.filter((w) => w.vintage), years = dated.map((w) => w.vintage);
  if (!years.length) return [];
  const last = Math.max(...years), first = Math.max(Math.min(...years), last - 24), bins = [];
  const older = dated.filter((w) => w.vintage < first);
  if (older.length) bins.push({ v: `:${first - 1}`, wines: older, name: `Before ${first}`, tick: "Older", major: true });
  for (let y = first; y <= last; y++) bins.push({ v: `${y}:${y}`, wines: dated.filter((w) => w.vintage === y), name: String(y), tick: String(y), major: y % 5 === 0 });
  return bins;
}
function endBins(wines) {
  const dated = wines.filter((w) => w.drink_to), far = THIS_YEAR + 14;
  if (!dated.length) return [];
  const bins = [{ v: `:${THIS_YEAR - 1}`, wines: dated.filter((w) => w.drink_to < THIS_YEAR), name: `Ended before ${THIS_YEAR}`, tick: "Past", major: true, tone: STAGE_TONES.first }];
  for (let y = THIS_YEAR; y <= far; y++) bins.push({ v: `${y}:${y}`, wines: dated.filter((w) => w.drink_to === y), name: String(y), tick: String(y), major: y === THIS_YEAR || y % 5 === 0,
    tone: y === THIS_YEAR ? STAGE_TONES.first : y === THIS_YEAR + 1 ? STAGE_TONES.soon : STAGE_TONES.ready });
  bins.push({ v: `${far + 1}:`, wines: dated.filter((w) => w.drink_to > far), name: `After ${far}`, tick: "Later", major: true, tone: STAGE_TONES.ready });
  return bins;
}
const keyItem = (tone, label) => `<span class="mc-key-item"><span class="mc-swatch" style="background:${tone}"></span>${esc(label)}</span>`;
function glanceHtml(wines) {
  const ended = wines.filter((w) => w.drink_to && w.drink_to < THIS_YEAR).length;
  const count = (y) => wines.filter((w) => w.drink_to === y).length;
  const tile = (v, n, label) => `<button type="button" class="mc-tile" data-mc-k="ends" data-mc-v="${v}" aria-pressed="${mc.ends === v}"${n ? "" : " disabled"}><span class="mc-tile-n">${n}</span><span>${esc(label)}</span></button>`;
  const best = wines.filter((w) => bestScore(w) != null).sort((a, b) => bestScore(b) - bestScore(a) || a.name.localeCompare(b.name)).slice(0, 5);
  const vintages = vintageBins(wines), ends = endBins(wines), colours = colourParts(wines);
  return `<div class="mc-tiles">${tile(`:${THIS_YEAR - 1}`, ended, "past their drinking window")}${tile(`${THIS_YEAR}:${THIS_YEAR}`, count(THIS_YEAR), `window ending this year (${THIS_YEAR})`)}${tile(`${THIS_YEAR + 1}:${THIS_YEAR + 1}`, count(THIS_YEAR + 1), `window ending next year (${THIS_YEAR + 1})`)}</div>
    <p class="mc-key"><strong>Colour key:</strong> ${colours.map(([t]) => keyItem(toneOf(t), t)).join("")}</p>
    <div class="mc-grid">${barsHtml("Top countries", "country", groupWines(wines, (w) => w.country), 10)}
      ${barsHtml("Top grapes and blends", "grape", groupWines(wines, (w) => w.varietal), 10)}
      ${barsHtml("Top regions", "region", groupWines(wines, regionOf), 10)}
      ${barsHtml("Colours", "colour", colours)}
      ${readyHtml(wines)}${scoresHtml(wines)}
      ${best.length ? `<div class="mc-card mc-card-two"><h4>Best rated</h4><ol class="mc-best">${best.map((w) => `<li><strong>${Math.round(bestScore(w))}</strong> <button type="button" class="linklike" data-somm-pop="${esc(w.id)}">${esc(w.name)}</button></li>`).join("")}</ol></div>` : ""}
      ${vintages.length ? columnsHtml("Vintages", "How many wines from each year, split by colour.", "vint", vintages) : ""}
      ${ends.length ? columnsHtml("When drinking windows end", "How many wines reach the end of their window each year. Dates are the cellar owner's own.", "ends", ends,
        `<p class="mc-key">${keyItem(STAGE_TONES.first, "Past, or ending this year")}${keyItem(STAGE_TONES.soon, "Ending next year")}${keyItem(STAGE_TONES.ready, "Later")}</p>`) : ""}</div>`;
}
// One small note that follows the pointer, for whatever part of a chart it's on.
function chartTip(e) {
  let tip = $("mc-tip");
  const t = e.target.closest?.("#mc-glance [data-tip]");
  if (!t) { if (tip) tip.hidden = true; return; }
  if (!tip) { tip = document.createElement("div"); tip.id = "mc-tip"; tip.setAttribute("role", "tooltip"); document.body.append(tip); }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  tip.style.left = `${Math.max(8, Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8))}px`;
  tip.style.top = `${e.clientY + 18 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 18}px`;
}
document.addEventListener("mousemove", chartTip);

// ---- The banner and table -------------------------------------------------------------
function mcBannerControls(wines) {
  const pick = (k, label, get) => { const vals = [...new Set(wines.map(get).filter((v) => v && v !== "Country not stated"))].sort();
    return `<select data-mc-narrow="${k}" aria-label="${esc(label)}"><option value="">Any ${esc(label.toLowerCase())}</option>${vals.map((v) => `<option value="${esc(v)}"${v === mc[k] ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`; };
  const chipWords = (k) => (k === "region" ? mc.region : k === "stage" ? STAGES[mc.stage].title : k === "score" ? `Score: ${SCORE_BANDS.find(([v]) => v === mc.score)[1]}` : rangeWords(k, mc[k]));
  const chips = ["region", "stage", "score", "vint", "ends"].filter((k) => mc[k]).map((k) => `<span class="chip">${k === "region" ? regionLink(mc.region) : esc(chipWords(k))}<button type="button" class="chip-x" data-mc-k="${k}" data-mc-v="${mc[k]}" aria-label="Remove this choice">✕</button></span>`).join(" ");
  const moods = Object.entries(MOODS).map(([k, m]) => [k, m, wines.filter(m.test).length]).filter(([k, , n]) => n || k === mc.mood);
  const narrowed = mc.mood !== "all" || mc.colour || mc.country || mc.grape || mc.region || mc.stage || mc.score || mc.vint || mc.ends;
  return `<div class="mc-moods">${moods.map(([k, m, n]) => `<button type="button" class="btn btn-mood" data-mc-mood="${k}" aria-pressed="${mc.mood === k}">${m.icon} ${esc(m.label)} <span class="tap-n">${n}</span></button>`).join("")}</div>
    <div class="somm-row somm-narrow">${pick("colour", "Colour", (w) => w.type)}${pick("country", "Country", (w) => w.country)}${pick("grape", "Grape", (w) => w.varietal)}
      ${chips}${narrowed ? `<button type="button" class="btn btn-mini" data-mc-clear>Show all again</button>` : ""}</div>`;
}
function mcRows(all) {
  return all.filter((w) => mcPasses(w)).map((w) => ({ w, t: 0, adv: advIdeasOf(w).length > 0 }));
}
function mcAnswerHtml(all, name) {
  const isDaring = (x) => x.adv, rows = tableSort(mcRows(all), mc.col, mc.dir, isDaring), n = rows.length, m = MOODS[mc.mood];
  const cols = [["name", "Wine"], ["type", "Colour"], ["country", "Country"], ["vintage", "Vintage"], ["score", "Score"], ["drink", "Drink"], ["daring", "⚡"]];
  if (all.some((w) => w.quantity)) cols.splice(6, 0, ["bottles", "Bottles"]); // a private copy on this computer only
  const sorted = mc.col === "drink" && mc.dir > 0 ? "what to drink first" : `${TABLE_WORDS[mc.col]}${mc.dir < 0 ? ", reversed" : ""}`;
  return `<div class="somm-selection"><p class="somm-sel-head">${esc([name, mc.mood === "all" ? "" : m.label].filter(Boolean).join(" · "))}</p>
      <p class="somm-sel-count">${n === all.length ? wineCount(n) : `${n.toLocaleString()} of ${wineCount(all.length)}`}${mc.region ? ` from ${regionLink(mc.region)}${regionCountry(all) ? `, ${esc(regionCountry(all))}` : ""}` : ""}</p>
      <p>${mc.mood === "all" ? "" : `${esc(capFirst(`These wines ${m.line}`))} `}Sorted by <strong>${esc(sorted)}</strong>. Click a heading to sort by it, or a wine to see its details.</p>
      ${mcBannerControls(all)}
      ${n ? `<p class="mc-food"><button type="button" class="btn btn-somm" data-mc-food>🍽 Find food for ${n === 1 ? "this wine" : `these ${n.toLocaleString()} wines`}</button></p>` : ""}</div>
    ${n ? wineTableHtml(rows, cols, mc.col, mc.dir, isDaring, "data-mc-col", mc.region ? { name: ` from ${regionLink(mc.region)}` } : {}) : `<p class="empty">No wines match. Press “Show all again” above.</p>`}`;
}
// Everything below the boxes. With no cellar open, a search looks through all of them.
function mcSearched(wines) {
  const words = fold(mwView.q).split(/\s+/).filter(Boolean);
  return wines.filter((w) => { const s = fold([w.name, w.producer, w.region_or_grape, w.varietal, w.country, w.source].filter(Boolean).join(" ")); return words.every((t) => s.includes(t)); });
}
function renderCellarPanel() {
  const open = mcOpenCellar(), wines = mcSearched(open ? mcWinesOf(open[0]) : mwView.q ? cellarFindWines() : []);
  $("mc-glance").hidden = !open || !!mwView.q;
  if (!open && !mwView.q) { $("mc-answer").innerHTML = `<p class="empty">Choose a cellar above to see what's in it.</p>`; return; }
  if (!SOMM && !mcTried) {
    mcTried = true;
    $("mc-answer").innerHTML = `<p class="empty">Opening the cellar…</p>`;
    loadSomm().finally(() => { if (!$("view-mywines").hidden) renderCellarPanel(); });
    return;
  }
  if (!$("mc-glance").hidden) $("mc-glance-body").innerHTML = glanceHtml(wines);
  $("mc-answer").innerHTML = mcAnswerHtml(wines, open ? open[1] : "All the cellars");
}
function openCellar(owner) {
  mwView.owner = owner;
  mwView.shown = MW_PAGE;
  clearMcFilters();
  mc.more = {};
  storeSet("wf.cellarOpen", owner);
  renderMyWines();
}
function openTools() { $("mw-tools").open = true; }

// The wines on screen, carried to the Sommelier with this cellar ticked.
async function cellarToSomm() {
  const open = mcOpenCellar(), all = mcSearched(open ? mcWinesOf(open[0]) : cellarFindWines()), rows = all.filter((w) => mcPasses(w)).map((w) => ({ w, t: 0 }));
  const sources = new Set(rows.map((x) => x.w.source));
  await loadSomm();
  showView("somm");
  if (!$("somm-stores").children.length) renderSommStores();
  for (const b of document.querySelectorAll("#somm [data-somm-cellar]")) b.checked = sources.has(b.value);
  fillCountrySelects(); renderMoods(); renderUsing();
  sommTab("pick");
  showOut(cellarAnswerHtml(rows, null, "", "", "Find food for these wines"));
}

document.addEventListener("click", (e) => {
  if (e.target.closest?.("#mw-add-open")) { openTools(); $("mw-add-h").scrollIntoView({ block: "start" }); $("mw-name").focus({ preventScroll: true }); return; }
  const t = e.target.closest?.("#mc-panel [data-mc-k], #mc-panel [data-mc-mood], #mc-panel [data-mc-col], #mc-panel [data-mc-clear], #mc-panel [data-mc-food], #mc-panel [data-mc-more]");
  if (!t) return;
  if ("mcFood" in t.dataset) return void cellarToSomm();
  if ("mcClear" in t.dataset) clearMcFilters();
  else if (t.dataset.mcMood) mc.mood = t.dataset.mcMood;
  else if (t.dataset.mcCol) { mc.dir = mc.col === t.dataset.mcCol ? -mc.dir : 1; mc.col = t.dataset.mcCol; }
  else if (t.dataset.mcMore) mc.more[t.dataset.mcMore] = !mc.more[t.dataset.mcMore];
  else { // a piece of a stack sets its colour too; pressing it again takes both off
    const k = t.dataset.mcK, v = t.dataset.mcV, type = t.dataset.mcColour, on = isOn(k, v, type);
    mc[k] = on ? "" : v;
    if (type) mc.colour = on ? "" : type;
  }
  if ($("mc-tip")) $("mc-tip").hidden = true;
  renderCellarPanel();
});
document.addEventListener("change", (e) => {
  if (!e.target.matches?.("#mc-panel [data-mc-narrow]")) return;
  mc[e.target.dataset.mcNarrow] = e.target.value;
  renderCellarPanel();
});

// ---- About a region -------------------------------------------------------------------
// The card shows Wikipedia's own opening words, fetched when it opens, so nothing is retold.
// data/regions.json names the article for each place in the cellars ("Nahe" alone is the river).
let regionTitles = null;
const regionLink = (r) => `<button type="button" class="linklike mc-region" data-mc-region="${esc(r)}" title="About ${esc(r)}">${esc(r)}</button>`;
const regionCountry = (wines) => wines.find((w) => regionOf(w) === mc.region)?.country || "";
async function regionTitle(r) {
  regionTitles ||= fetch("data/regions.json", FRESH).then((x) => (x.ok ? x.json() : {})).catch(() => ({}));
  return (await regionTitles)[r] || r; // a place not on the list is tried as it's written
}
async function wikiSummary(title) {
  const x = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!x.ok) throw new Error(x.status);
  const d = await x.json();
  if (d.type === "disambiguation" || !d.extract) throw new Error("no article");
  return d;
}
function regionCellarHtml(r) {
  const open = mcOpenCellar(), wines = (open ? mcWinesOf(open[0]) : cellarFindWines()).filter((w) => regionOf(w) === r);
  if (!wines.length) return "";
  const makers = groupWines(wines, (w) => w.producer).map(([p, ws]) => `${esc(p)} (${ws.length})`);
  const scores = wines.map(bestScore).filter((n) => n != null), colours = groupWines(wines, (w) => w.type).map(([t, ws]) => `${ws.length} ${t.toLowerCase()}`);
  return `<div class="region-cellar"><h3>In ${esc(open ? open[1] : "your cellars")}</h3>
    <p><strong>${esc(wineCount(wines.length))} from ${esc(r)}</strong>: ${esc(colours.join(", "))}.${scores.length ? ` Best score ${Math.round(Math.max(...scores))}.` : ""}</p>
    ${makers.length ? `<p>Made by ${makers.join(", ")}.</p>` : ""}</div>`;
}
async function openRegion(r) {
  const country = regionCountry(cellarFindWines().filter((w) => regionOf(w) === r)) || "";
  const where = [r, country].filter(Boolean).join(", ");
  const mapUrl = (d) => (d?.coordinates ? `https://www.google.com/maps/search/?api=1&query=${d.coordinates.lat},${d.coordinates.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`);
  const body = (wiki, d) => `<h2 class="dialog-q">${esc(r)}${country ? `<span class="region-country">, ${esc(country)}</span>` : ""}</h2>
    ${wiki}
    <p class="region-links">${d ? `<a href="${esc(d.content_urls.desktop.page)}" target="_blank" rel="noopener">📖 Read the full article on Wikipedia</a>` : ""}
      <a href="${esc(mapUrl(d))}" target="_blank" rel="noopener">🗺 See it on a map</a></p>
    ${regionCellarHtml(r)}`;
  $("region-pop-body").innerHTML = body(`<p class="hint">Asking Wikipedia about ${esc(r)}…</p>`);
  $("region-pop").showModal?.();
  try {
    const d = await wikiSummary(await regionTitle(r));
    if (!$("region-pop").open) return;
    const pic = d.thumbnail ? `<img class="region-pic" src="${esc(d.thumbnail.source)}" alt="" loading="lazy">` : "";
    $("region-pop-body").innerHTML = body(`<div class="region-wiki">${pic}<p class="region-art">From the Wikipedia article <strong>${esc(d.title)}</strong>:</p>${d.extract_html || `<p>${esc(d.extract)}</p>`}
      <p class="hint region-credit">Text from Wikipedia, shared under CC BY-SA. It may describe the town or the wider area the wine is named after.</p></div>`, d);
  } catch {
    if ($("region-pop").open) $("region-pop-body").innerHTML = body(`<p class="hint">Wikipedia didn't answer just now, or has no article for ${esc(r)}. The map link still works.</p>`);
  }
}
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-mc-region], #region-pop [data-region-close]");
  if (!t) return;
  if ("regionClose" in t.dataset) return void $("region-pop").close();
  e.preventDefault();
  openRegion(t.dataset.mcRegion);
});
