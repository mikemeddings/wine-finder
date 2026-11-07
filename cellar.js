// My cellars: a box per cellar, then At a glance and the sortable table for the one that's open.
// Loaded after app.js and somm.js, in the same global scope. Counts are wines, not bottles.
const mc = { colour: "", country: "", grape: "", vint: "", ends: "", mood: "all", col: "drink", dir: 1 };
let mcTried = false; // somm.json holds the books the ⚡ column and the moods read
const clearMcFilters = () => Object.assign(mc, { colour: "", country: "", grape: "", vint: "", ends: "", mood: "all" });

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
function mcPasses(w, skipMood = false) {
  return (skipMood || MOODS[mc.mood].test(w)) && (!mc.colour || w.type === mc.colour) && (!mc.country || w.country === mc.country) &&
    (!mc.grape || w.varietal === mc.grape) && (!mc.vint || inRange(w.vintage, mc.vint)) && (!mc.ends || inRange(w.drink_to, mc.ends));
}
const tally = (wines, get) => { const m = new Map();
  for (const w of wines) { const v = get(w); if (v && v !== "Country not stated") m.set(v, (m.get(v) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(b[0])); };

// ---- At a glance ----------------------------------------------------------------------
const wineCount = (n) => `${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}`;
function barsHtml(title, k, rows) {
  const top = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="mc-card"><h4>${esc(title)}</h4>${rows.map(([v, n]) => `<button type="button" class="mc-bar" data-mc-k="${k}" data-mc-v="${esc(v)}" aria-pressed="${mc[k] === v}" title="${esc(`${v}: ${wineCount(n)}. Click to list them.`)}">
    <span class="mc-bar-name">${esc(v)}</span><span class="mc-bar-track"><span class="mc-bar-fill" style="width:${Math.max(2, n / top * 100)}%"></span></span><span class="mc-bar-n">${n}</span></button>`).join("")}</div>`;
}
function columnsHtml(title, note, k, bins) {
  const top = Math.max(1, ...bins.map((b) => b.n)), peak = bins.findIndex((b) => b.n === top);
  return `<div class="mc-card mc-card-wide"><h4>${esc(title)}</h4><p class="hint">${esc(note)}</p>
    <div class="mc-cols" style="grid-template-columns:repeat(${bins.length},minmax(0,1fr))">${bins.map((b, i) => `<button type="button" class="mc-col" data-mc-k="${k}" data-mc-v="${b.v}" aria-pressed="${mc[k] === b.v}" title="${esc(`${b.name}: ${wineCount(b.n)}.${b.n ? " Click to list them." : ""}`)}"${b.n ? "" : " disabled"}>
      <span class="mc-col-n">${i === peak ? top : ""}</span><span class="mc-col-fill" style="height:${b.n ? Math.max(4, b.n / top * 100) : 0}%"></span><span class="mc-col-lab">${esc(b.tick || "")}</span></button>`).join("")}</div></div>`;
}
function vintageBins(wines) {
  const years = wines.map((w) => w.vintage).filter(Boolean);
  if (!years.length) return [];
  const last = Math.max(...years), first = Math.max(Math.min(...years), last - 24), bins = [];
  const older = years.filter((y) => y < first).length;
  if (older) bins.push({ v: `:${first - 1}`, n: older, name: `Before ${first}`, tick: "Older" });
  for (let y = first; y <= last; y++) bins.push({ v: `${y}:${y}`, n: years.filter((x) => x === y).length, name: String(y), tick: y % 5 === 0 ? String(y) : "" });
  return bins;
}
function endBins(wines) {
  const ends = wines.map((w) => w.drink_to).filter(Boolean), far = THIS_YEAR + 14;
  if (!ends.length) return [];
  const bins = [{ v: `:${THIS_YEAR - 1}`, n: ends.filter((y) => y < THIS_YEAR).length, name: `Ended before ${THIS_YEAR}`, tick: "Past" }];
  for (let y = THIS_YEAR; y <= far; y++) bins.push({ v: `${y}:${y}`, n: ends.filter((x) => x === y).length, name: String(y), tick: y === THIS_YEAR || y % 5 === 0 ? String(y) : "" });
  bins.push({ v: `${far + 1}:`, n: ends.filter((y) => y > far).length, name: `After ${far}`, tick: "Later" });
  return bins;
}
function glanceHtml(wines) {
  const ended = wines.filter((w) => w.drink_to && w.drink_to < THIS_YEAR).length;
  const count = (y) => wines.filter((w) => w.drink_to === y).length;
  const tile = (v, n, label) => `<button type="button" class="mc-tile" data-mc-k="ends" data-mc-v="${v}" aria-pressed="${mc.ends === v}"${n ? "" : " disabled"}><span class="mc-tile-n">${n}</span><span>${esc(label)}</span></button>`;
  const best = wines.filter((w) => bestScore(w) != null).sort((a, b) => bestScore(b) - bestScore(a) || a.name.localeCompare(b.name)).slice(0, 5);
  const vintages = vintageBins(wines), ends = endBins(wines);
  return `<div class="mc-tiles">${tile(`:${THIS_YEAR - 1}`, ended, "past their drinking window")}${tile(`${THIS_YEAR}:${THIS_YEAR}`, count(THIS_YEAR), `window ending this year (${THIS_YEAR})`)}${tile(`${THIS_YEAR + 1}:${THIS_YEAR + 1}`, count(THIS_YEAR + 1), `window ending next year (${THIS_YEAR + 1})`)}</div>
    <div class="mc-grid">${barsHtml("Colours", "colour", tally(wines, (w) => w.type))}
      ${barsHtml("Top countries", "country", tally(wines, (w) => w.country).slice(0, 6))}
      ${barsHtml("Top grapes and blends", "grape", tally(wines, (w) => w.varietal).slice(0, 6))}
      ${best.length ? `<div class="mc-card mc-card-wide"><h4>Best rated</h4><ol class="mc-best">${best.map((w) => `<li><strong>${Math.round(bestScore(w))}</strong> <button type="button" class="linklike" data-somm-pop="${esc(w.id)}">${esc(w.name)}</button></li>`).join("")}</ol></div>` : ""}
      ${vintages.length ? columnsHtml("Vintages", "How many wines from each year.", "vint", vintages) : ""}
      ${ends.length ? columnsHtml("When drinking windows end", "How many wines reach the end of their window each year. Dates are the cellar owner's own.", "ends", ends) : ""}</div>`;
}

// ---- The banner and table -------------------------------------------------------------
function mcBannerControls(wines) {
  const pick = (k, label, get) => { const vals = [...new Set(wines.map(get).filter((v) => v && v !== "Country not stated"))].sort();
    return `<select data-mc-narrow="${k}" aria-label="${esc(label)}"><option value="">Any ${esc(label.toLowerCase())}</option>${vals.map((v) => `<option value="${esc(v)}"${v === mc[k] ? " selected" : ""}>${esc(v)}</option>`).join("")}</select>`; };
  const chips = ["vint", "ends"].filter((k) => mc[k]).map((k) => `<span class="chip">${esc(rangeWords(k, mc[k]))}<button type="button" class="chip-x" data-mc-k="${k}" data-mc-v="${mc[k]}" aria-label="Remove this choice">✕</button></span>`).join(" ");
  const moods = Object.entries(MOODS).map(([k, m]) => [k, m, wines.filter(m.test).length]).filter(([k, , n]) => n || k === mc.mood);
  const narrowed = mc.mood !== "all" || mc.colour || mc.country || mc.grape || mc.vint || mc.ends;
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
      <p class="somm-sel-count">${n === all.length ? wineCount(n) : `${n.toLocaleString()} of ${wineCount(all.length)}`}</p>
      <p>${mc.mood === "all" ? "" : `${esc(capFirst(`These wines ${m.line}`))} `}Sorted by <strong>${esc(sorted)}</strong>. Click a heading to sort by it, or a wine to see its details.</p>
      ${mcBannerControls(all)}
      ${n ? `<p class="mc-food"><button type="button" class="btn btn-somm" data-mc-food>🍽 Find food for ${n === 1 ? "this wine" : `these ${n.toLocaleString()} wines`}</button></p>` : ""}</div>
    ${n ? wineTableHtml(rows, cols, mc.col, mc.dir, isDaring, "data-mc-col") : `<p class="empty">No wines match. Press “Show all again” above.</p>`}`;
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
  const t = e.target.closest?.("#mc-panel [data-mc-k], #mc-panel [data-mc-mood], #mc-panel [data-mc-col], #mc-panel [data-mc-clear], #mc-panel [data-mc-food]");
  if (!t) return;
  if ("mcFood" in t.dataset) return void cellarToSomm();
  if ("mcClear" in t.dataset) clearMcFilters();
  else if (t.dataset.mcMood) mc.mood = t.dataset.mcMood;
  else if (t.dataset.mcCol) { mc.dir = mc.col === t.dataset.mcCol ? -mc.dir : 1; mc.col = t.dataset.mcCol; }
  else { const k = t.dataset.mcK, v = t.dataset.mcV; mc[k] = mc[k] === v ? "" : v; }
  renderCellarPanel();
});
document.addEventListener("change", (e) => {
  if (!e.target.matches?.("#mc-panel [data-mc-narrow]")) return;
  mc[e.target.dataset.mcNarrow] = e.target.value;
  renderCellarPanel();
});
