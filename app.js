"use strict";

// ---- Easy-to-edit settings ------------------------------------------------

// "Find me a wine": the tap-buttons at the top of the page. Each row sets one filter, and
// tapping a lit button again clears it. Everyone can save their own choices as a quick pick
// (kept on their own computer). Edit the choices freely.
const FINDER_PRICES = [20, 30, 50, 100, 200]; // "Under $20" … (the side panel takes any price)
const FINDER_COLOURS = ["Red", "White", "Rosé", "Sparkling"];
// "Only well rated": this score or more from Claude, CellarTracker or the family, or on
// ZYN's own list of 90+ point wines.
const WELL_RATED = 90;
const MAX_MY_PICKS = 12;
const THIS_YEAR = new Date().getFullYear();

// The question copied for Claude. {ABOUT_ME} comes from Settings (stays on this computer).
const PROMPT_TEMPLATE = `I'm choosing wines and would like your help. {ABOUT_ME}

Here are the wines I'm considering, with where they're sold and the current price:
{WINES}

For each wine, please:
- Tell me about the region, the producer and the grapes — the history and the story behind it.
- Look up current reviews on the web (critics and CellarTracker community notes). For every score, name the source and the vintage it applies to. If you can't find reviews for this wine, say so plainly rather than estimating.
- Describe what the critics say in your own words. Give their scores with the source, but don't copy their tasting notes.
- Give me a practical note: drink now or cellar, whether to decant, serving temperature, and two or three specific dishes to enjoy with it.
- Start each wine's section with a heading that ends with its code in square brackets, exactly as in my list, for example: ## Château Example 2019 [bcl-123456]
- End each wine's section with its own short "Sources:" list, so each wine's sources stay with it.

Along the way:
- Whenever you mention a particular place (a vineyard, estate, village, river valley or wine region), add a Google Maps satellite link so I can look at it from above. Build it from the place name like this: https://www.google.com/maps?q=Quinta+das+Carvalhas,+Pinhao,+Portugal&t=k (place, nearest town, country, with + for spaces; keep &t=k on the end, which opens the satellite view). Use names, not coordinates.
- Link generously as you write, so I can explore the wine from any point: give a Wikipedia link the first time you mention a person, a family or dynasty, a historical event, a grape variety, a soil or rock type, a winemaking term, a wind or river, or a dish. Link an article directly only if you actually opened it; otherwise use a search link like https://en.wikipedia.org/wiki/Special:Search?search=Real+Companhia+Velha&go=Go so it never leads to a missing page.
- Whenever you give a critic's score or a fact you found on a page, link that page right there in the sentence (as well as in the wine's Sources list).
- For each wine, end with a "From the history books" section: three to five facts with dates about the people, places and events behind it (founders, dynasties, popes and kings, wars, treaties, trade routes, phylloxera and the like), with links in each.
- Then add a few "Curious details": the geology and soils, the climate, the science behind the winemaking, or an odd story about the estate or its name. Hold these to the same standard as everything else, with sources.

Finally, after all the wines, finish with a short ranking of them by what reviewers say, as a numbered list: one line per wine with its price and where it's sold (as in my list), then its best-supported score, naming the source and the vintage it applies to. If the same wine appears twice, say how the two listings differ (store, size or price). Put any wine without reviews at the end and say so.

{SAVE_LINK}

My eyesight isn't what it was, so please keep it easy to read: a clear heading for each wine, short paragraphs of two or three sentences, and no tables.

Please treat my list exactly as given — all of these wines, not just similar ones. The availability and prices above are from the stores' own lists (or our family's cellars), so you don't need to search for where to buy them.`;

// "Rank these by reviews": the same honesty rules, aimed at a ranked list.
const RANK_TEMPLATE = `I'm choosing between some wines and would like them ranked by what reviewers say. {ABOUT_ME}

Here are the wines, with where they're sold and the current price:
{WINES}

Please:
- Look up current reviews on the web for each wine: professional critics and CellarTracker community notes.
- Rank them from best reviewed to least, as a numbered list. Start each line with the wine, its price and where it's sold (as in my list). For every score, name the source and the vintage it applies to, and say so if that vintage differs from the one listed. If the same wine appears twice, say how the two listings differ (store, size or price).
- If you can't find reviews for a wine, say so plainly and put it at the end rather than estimating.
- Describe what the critics say in your own words. Give their scores with the source, but don't copy their tasting notes.
- Finish with a short note on value for money at the prices above.

{SAVE_LINK}

My eyesight isn't what it was, so please keep it easy to read: a clear heading for each wine, short paragraphs of two or three sentences, and no tables.

Please treat my list exactly as given — all of these wines, not just similar ones. The availability and prices above are from the stores' own lists (or our family's cellars), so you don't need to search for where to buy them.`;

const CLAUDE_URL = "https://claude.ai/new";
const CLAUDE_SOFT_LIMIT = 15;
const TYPES = ["Red", "White", "Rosé", "Sparkling", "Fortified", "Dessert", "Sake", "Other"];
// Sweetness, in four steps, the same in "Find me a wine" and the side panel. BC Liquor gives
// a sugar code (0-10) and the LCBO grams of sugar a litre; for other stores it's estimated.
const SWEET_LEVELS = ["dry", "off-dry", "medium-sweet", "sweet"];
const SWEET_LABEL = { dry: "Dry", "off-dry": "Off-dry", "medium-sweet": "Medium-sweet", sweet: "Sweet" };
const sweetFromCode = (c) => (c <= 1 ? "dry" : c <= 4 ? "off-dry" : c <= 7 ? "medium-sweet" : "sweet");
const sweetFromSugar = (g) => (g <= 4 ? "dry" : g <= 12 ? "off-dry" : g <= 45 ? "medium-sweet" : "sweet");
const OLD_SWEET = { Dry: "dry", "Off-dry": "off-dry", "Medium-sweet": "medium-sweet", Sweet: "sweet" }; // older saved picks
const ALL_SOURCES = ["BC Liquor", "BSW Liquor", "ZYN", "Lucullus", "Weinshop365", "LCBO"];
// How each source is named on screen, in the shortlist and in the Claude question.
const SOURCE_LABELS = { "BC Liquor": "BC Liquor - LDB", Lucullus: "Lucullus (Switzerland)", Weinshop365: "Weinshop365 (Switzerland)" };
const SOURCE_CLASS = { "BC Liquor": "bcl", "BSW Liquor": "bsw", ZYN: "zyn", Lucullus: "luc", Weinshop365: "w365", LCBO: "lcbo" };
const CALGARY = new Set(["BSW Liquor", "ZYN"]);
const PAGE_SIZE = 100;
// A standard bottle: 750 ml, or 700 ml as Swiss wines (Vaud, Valais) often come.
const STANDARD_ML = new Set([700, 750]);
const STORE = { shortlist: "wf.shortlist", aboutMe: "wf.aboutMe", myWines: "wf.myWines", ratings: "wf.ratings", ghKey: "wf.ghKey", mailApp: "wf.mailApp", cellarNames: "wf.cellarNames", notes: "wf.notes", myName: "wf.myName", inboxKey: "wf.inboxKey", dine: "wf.dine", dineAsk: "wf.dineAsk", dineHistory: "wf.dineHistory", lcbo: "wf.lcbo", myPicks: "wf.myPicks", folds: "wf.folds", readerScale: "wf.readerScale", quickMarks: "wf.quickMarks", shopping: "wf.shopping" };

// ---- Helpers -----------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const money = (n) => "$" + Number(n).toFixed(2);
// Swiss prices: the shop's own price in francs, then roughly what that is in Canadian dollars
// (w.price, which the price filter and sorting use). VAT as each shop publishes it.
const vatNote = (w) => (w.vat === "excl" ? " excl. VAT" : w.vat === "incl" ? " incl. VAT" : "");
const priceStr = (w) => (w.currency ? `${w.currency} ${Number(w.price_local).toFixed(2)}${vatNote(w)} (≈ ${money(w.price)})` : money(w.price));
const priceHtml = (w) => (w.currency
  ? `${esc(w.currency)} ${Number(w.price_local).toFixed(2)} <span class="price-cad">≈ ${money(w.price)}</span>`
  : money(w.price));
const sourceLabel = (s) => SOURCE_LABELS[s] || s;
const sourceBadge = (s) => `<span class="badge badge-src badge-${SOURCE_CLASS[s] || "other"}">${esc(sourceLabel(s))}</span>`;
const typePill = (t) => `<span class="type-pill type-${esc(t)}">${esc(t)}</span>`;

function storeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window etc. */ }
}

function sizeText(w) {
  const ml = w.size_ml;
  let s = !ml ? "size unknown" : ml >= 1000 ? `${+(ml / 1000).toFixed(3)} L` : `${ml} ml`;
  return w.pack > 1 ? `pack of ${w.pack} × ${s}` : s;
}
// "Off-dry (BC sugar code 3 of 10)", "Dry (LCBO: 3 g/L sugar)", "Dry (estimated)"
function sweetText(w) {
  const s = wineStyle(w).sweet;
  return s.v ? `${SWEET_LABEL[s.v]} (${s.how})` : "Sweetness unknown";
}
function searchName(w) {
  return w.name.replace(/ - /g, " ").replace(/\s+/g, " ").trim();
}
function cellarTrackerUrl(w) {
  return "https://www.cellartracker.com/list.asp?Table=List&szSearch=" + encodeURIComponent(searchName(w));
}
function wineEnthusiastUrl(w) {
  return "https://www.wineenthusiast.com/?s=" + encodeURIComponent(searchName(w)) + "&search_type=ratings";
}
// Vivino's own search (it forwards to its "explore" page). A link only: Vivino's terms
// forbid automated copying of its ratings, so we never read them into the page.
function vivinoUrl(w) {
  return "https://www.vivino.com/search/wines?q=" + encodeURIComponent(searchName(w));
}

// ---- Other stores ("Find it elsewhere") ------------------------------------------
// Search links only — nothing is fetched from these sites. {q} is replaced by the
// search words. Each link was tested on 2026-10-23 (see Design/CLAUDE.md §11).
const STORE_GROUPS = [
  // Vessel's terms forbid crawling or scraping, so it's a search link only (not in "Sold by").
  { place: "Victoria", note: "Vessel Liquor, 1609 Fort St.", stores: [
    { name: "Vessel Liquor", url: "https://vesselliquor.com/search?q={q}" },
  ] },
  { place: "Alberta", note: "Calgary stores — check shipping to BC.", stores: [
    { name: "BSW Liquor", url: "https://www.bswliquor.com/search?q={q}" },
    { name: "ZYN", url: "https://zyn.ca/search?q={q}" },
  ] },
  { place: "Vancouver", note: "Private wine stores.", stores: [
    { name: "Everything Wine", url: "https://www.everythingwine.ca/catalogsearch/result/?q={q}" },
    { name: "Liberty Wine Merchants", url: "https://www.libertywinemerchants.com/?s={q}&post_type=product" },
    { name: "Marquis Wine Cellars", url: "https://www.marquis-wines.com/search-results?search_query={q}&expa_s=p_s" },
  ] },
  { place: "Ontario", note: "Ontario's liquor board.", stores: [
    { name: "LCBO", url: "https://www.lcbo.com/en/catalogsearch/result/#q={q}&t=Products&sort=relevancy&layout=card" },
  ] },
  // Mövenpick's terms allow links to its home page only (no deep links without permission),
  // so its button opens the home page and Basil searches there.
  { place: "Switzerland", note: "Prices in Swiss francs. Mövenpick opens on its home page (in French): search there.", stores: [
    { name: "Lucullus (Stans)", url: "https://www.lucullus.ch/en/search?search={q}" },
    { name: "Weinshop365", url: "https://weinshop365.ch/en/suche?q={q}" },
    { name: "Mövenpick Wein (Geneva shops)", url: "https://www.moevenpick-wein.com/fr/" },
    { name: "Flaschenpost", url: "https://www.flaschenpost.ch/en/wine?searchParam={q}" },
  ] },
];

const storeUrl = (url, q) => url.replace("{q}", encodeURIComponent(q.trim()));
const BC_SEARCH = "https://www.bcliquorstores.com/product-catalogue?search={q}";

// Store searches work best with a few words: the producer, without the vintage.
function storeSearchWords(w) {
  return (w.producer || w.name.replace(/\b(19\d\d|20[0-3]\d)\b/g, "").replace(/ - /g, " ")).replace(/\s+/g, " ").trim();
}

function elsewhereHtml(q, label, withLists = false) {
  const groups = STORE_GROUPS.map((g) => `<div class="ew-group">
      <h4>${esc(g.place)} <span class="ew-note">${esc(g.note)}</span></h4>
      <div class="ew-links">${g.stores.map((s) =>
        `<a class="btn ext ew-store" target="_blank" rel="noopener" data-url="${esc(s.url)}" href="${esc(storeUrl(s.url, q))}">${esc(s.name)}</a>`).join("")}</div>
    </div>`).join("");
  return `<div class="elsewhere${q.trim() ? "" : " is-empty"}">
    <label class="ew-label">${label}<input type="search" class="ew-q" value="${esc(q)}" autocomplete="off" spellcheck="false"></label>
    <p class="hint">Fewer words find more: the producer's name is usually enough.</p>
    ${withLists ? `<div class="ew-hits" aria-live="polite"></div><h3 class="ew-sub">Search other stores</h3>
    <p class="hint">Each button opens that store's own search in a new tab.</p>` : ""}
    <div class="ew-groups">${groups}</div>
  </div>`;
}

function updateElsewhere(box) {
  const q = box.querySelector(".ew-q").value;
  box.classList.toggle("is-empty", !q.trim());
  for (const a of box.querySelectorAll(".ew-store")) a.href = storeUrl(a.dataset.url, q);
  if (box.querySelector(".ew-hits")) renderListHits(box);
}

// "Where can I buy…?": wines on our own lists (every loaded store, ignoring the
// filters), cheapest first.
const HIT_LIMIT = 10;
function listHits(q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return WINES.filter((w) => words.every((t) => w._s.includes(t))).sort((a, b) => a.price - b.price);
}

function hitRow(w) {
  const on = shortlist.some((s) => s.id === w.id);
  return `<li class="ew-hit">
    <div><div class="sl-name">${esc(w.name)}</div>
      <div>${typePill(w.type)} ${esc([w.country, w.vintage, sizeText(w)].filter(Boolean).join(" · "))}</div>
      <div><strong>${priceHtml(w)}</strong> at ${sourceBadge(w.source)}</div>${ratingsHtml(w)}${familyLinksHtml(w)}</div>
    <div class="hit-buttons">${researchButton(w)}
    <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button></div>
  </li>`;
}

const renderListHits = debounce((box) => {
  const q = box.querySelector(".ew-q").value.trim();
  const out = box.querySelector(".ew-hits");
  if (!q) { out.innerHTML = ""; return; }
  let wait = "";
  if (!allLoaded()) { // other stores' lists load the first time this box is used
    loadAllSources().then(() => renderListHits(box));
    wait = `<p class="hint">Still loading the other stores' lists…</p>`;
  }
  const hits = listHits(q);
  const fam = familyHitsHtml(q);
  const head = fam + `<h3 class="ew-sub">On our store lists <span class="ew-note">(${esc(loadedSourceLabels())})</span></h3>`;
  const byName = typedButton(q, hits.length ? "Or add it by name, as typed" : "Not on our lists? You can still ask Claude about it:");
  if (!hits.length) {
    out.innerHTML = head + wait + `<p><strong>Not found on our lists.</strong> Try fewer words, or the store buttons below.</p>` + byName;
    return;
  }
  const more = hits.length > HIT_LIMIT;
  out.innerHTML = head + wait +
    `<p>${hits.length === 1 ? "1 wine found" : `${hits.length} wines found`}${more ? `; here are the ${HIT_LIMIT} cheapest` : ""}.</p>
    <ul class="ew-hit-list">${hits.slice(0, HIT_LIMIT).map(hitRow).join("")}</ul>` +
    (more ? `<button type="button" class="btn btn-ew" data-action="hits-in-list">Show all ${hits.length} in the main list</button>` : "") +
    byName;
}, 250);

// ---- Wines added by name (not on any of our store lists) ----------------------------
// Any wine can go on the Short List by its name, e.g. one found at the LCBO or
// recommended by a friend; Claude is told it isn't on our lists.

const typedId = (name) => "typed-" + fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isOnList = (id) => shortlist.some((s) => s.id === id);

function typedButton(name, lead) {
  const on = isOnList(typedId(name));
  return `<div class="typed-add"><p class="hint">${esc(lead)}</p>
    <button type="button" class="btn btn-typed" data-typed="${esc(name)}" aria-pressed="${on}">${on
      ? `✓ “${esc(name)}” is on the Short List`
      : `＋ Add “${esc(name)}” to Short List for Claude Research`}</button></div>`;
}

function addTypedWine(name) {
  name = name.replace(/\s+/g, " ").trim();
  if (!name) return false;
  const id = typedId(name);
  if (isOnList(id)) return false;
  closeClaudeSteps();
  const m = name.match(/\b(19\d\d|20[0-3]\d)\b/);
  shortlist.push({ id, kind: "typed", source: "Added by name", name, vintage: m ? +m[1] : null,
    country: "Country not stated", type: "Other", size_ml: null, pack: 1, price: null });
  saveShortlist();
  return true;
}

function showHitsInList() {
  const q = $("ew-top").querySelector(".ew-q").value.trim();
  showView("find");
  state = defaultState();
  state.q = q;
  state.sources = new Set([...LOADED].filter((x) => ALL_SOURCES.includes(x))); // the stores, not a family cellar
  state.bottleOnly = false;
  renderAll();
  $("results-h").scrollIntoView({ block: "start" });
}

function toggleElsewhere(btn) {
  const host = btn.closest(".wine, li");
  const open = host.querySelector(".ew-panel");
  if (open) {
    open.remove();
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "Find it elsewhere";
    return;
  }
  const w = findWine(btn.dataset.ew);
  if (!w) return;
  const panel = document.createElement("div");
  panel.className = "ew-panel";
  panel.innerHTML = elsewhereHtml(storeSearchWords(w), "Search other stores for");
  host.appendChild(panel);
  btn.setAttribute("aria-expanded", "true");
  btn.textContent = "Hide other stores";
}

// ---- State -------------------------------------------------------------------

let WINES = [];
let META = { sources: {} };
let shortlist = storeGet(STORE.shortlist, []);
if (!Array.isArray(shortlist)) shortlist = [];

function defaultState() {
  return {
    sources: new Set(["BC Liquor"]),
    countries: new Set(),
    countryOut: false, // true: the ticked countries are left out ("all countries except USA")
    grapes: new Set(),  // Grape: any of these
    grapeOut: false,    // true: the ticked grapes are left out ("all grapes except Cabernet Sauvignon")
    grapeQ: "",
    food: new Set(),    // Food it goes with: any of these (estimated from the wine's style)
    foodBold: false,    // also the adventurous pairings (a red with fish…), each with advice
    vintFrom: null, vintTo: null, // Vintage slider (wines without a vintage drop out while it's set)
    oldOnly: false,     // "10 years or older"
    abvFrom: null, abvTo: null,   // Alcohol slider (only BC Liquor and the LCBO give it)
    countryQ: "",
    types: new Set(),
    priceFrom: null,
    priceTo: null,
    sweet: new Set(),
    notRated: true,
    bottleOnly: true,
    q: "",
    newOnly: false,
    body: new Set(),       // "Find me a wine", any of: light / medium / full
    tannin: new Set(),     // soft / medium / firm (reds)
    sweetStyle: new Set(), // dry / off-dry / sweet
    continent: "",
    wellRated: false, // WELL_RATED or more, or on ZYN's 90+ list
    ratedOnly: false, // "Scored by Claude or the family": any Claude, CellarTracker or family score
    readyNow: false,
    fruity: false,    // "Fruity & ripe"
    longFinish: false, // "Long finish": Claude's answer only (no store gives it)
    pickLabel: "",    // the quick pick that set these filters, for the "Showing:" line
    sorts: ["best-desc", "", ""], // the Sort by box (older saved places may hold three levels)
    shown: PAGE_SIZE,
  };
}
let state = defaultState();

// ---- Filtering ---------------------------------------------------------------

const words = (s) => " " + fold(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";

function matches(w, skip, st = state) {
  if (!st.sources.has(w.source)) return false;
  if (cellarOn(st)) { // a family cellar is ticked: its wines only, and the store boxes mean "that this store sells"
    if (w.kind !== "cellar") return false;
    const stores = storesTicked(st);
    if (stores.length && !storeMatchesOf(w.id).some((s) => stores.includes(s.source))) return false;
  }
  if (skip !== "country" && st.countries.size && st.countries.has(w.country) === st.countryOut) return false;
  if (skip !== "type" && st.types.size && !st.types.has(w.type)) return false;
  if (st.priceFrom != null || st.priceTo != null) {
    const p = priceOf(w, st);
    if (p != null && ((st.priceFrom != null && p < st.priceFrom) || (st.priceTo != null && p > st.priceTo))) return false;
  }
  if (st.bottleOnly && !STANDARD_ML.has(w.size_ml)) return false;
  if (st.newOnly && !w.new_since_last) return false;
  if (skip !== "grape" && st.grapes.size && grapesOf(w).some((g) => st.grapes.has(g)) === st.grapeOut) return false;
  if (skip !== "food" && st.food.size && !foodsOf(w).some((f) => st.food.has(f)) &&
    !(st.foodBold && boldFoodsOf(w).some((b) => st.food.has(b.food)))) return false;
  if (st.vintFrom != null || st.vintTo != null || st.oldOnly) {
    if (!w.vintage) return false;
    if ((st.vintFrom != null && w.vintage < st.vintFrom) || (st.vintTo != null && w.vintage > st.vintTo)) return false;
    if (st.oldOnly && w.vintage > THIS_YEAR - 10) return false;
  }
  if (st.abvFrom != null || st.abvTo != null) {
    if (w.abv == null) return false;
    if ((st.abvFrom != null && w.abv < st.abvFrom) || (st.abvTo != null && w.abv > st.abvTo)) return false;
  }
  if (st.continent && continentOf(w) !== st.continent) return false;
  if (st.ratedOnly && familyScore(w) == null) return false;
  if (st.wellRated && !wellRated(w)) return false;
  if (st.body.size || st.tannin.size || st.sweetStyle.size || st.readyNow || st.fruity || st.longFinish) {
    const look = wineStyle(w);
    if (st.body.size && !st.body.has(look.body.v)) return false;
    if (st.tannin.size && !st.tannin.has(look.tannin.v)) return false;
    if (st.sweetStyle.size && !st.sweetStyle.has(look.sweet.v)) return false;
    if (st.readyNow && !look.ready.ready) return false;
    if (st.fruity && !look.fruity.v) return false;
    if (st.longFinish && look.finish.v !== "long") return false;
  }
  // "Include wines whose sweetness is estimated" unticked: only wines with a measured figure
  if (!st.notRated && !wineStyle(w).sweet.measured) return false;
  if (st.q) {
    for (const t of fold(st.q).split(/\s+/)) if (t && !w._s.includes(t)) return false;
  }
  return true;
}

// Sorting: up to three levels. Each choice is a key and a direction; the second level only
// orders wines that tie on the first, and so on. A wine without the value (no vintage, no
// score…) goes to the bottom of its group either way, and the next level orders those too.
const SORT_KEYS = {
  best: { get: (w) => bestScore(w), up: "Best rated: lowest first", down: "Best rated first (Claude, then CellarTracker, then family)", first: "down" },
  price: { get: (w) => priceOf(w), up: "Price: low to high", down: "Price: high to low" },
  name: { get: (w) => w.name, text: true, up: "Name: A to Z", down: "Name: Z to A" },
  country: { get: (w) => (w.country === "Country not stated" ? null : w.country), text: true, up: "Country: A to Z", down: "Country: Z to A" },
  vintage: { get: (w) => w.vintage, up: "Vintage: oldest first", down: "Vintage: newest first", first: "down" },
  abv: { get: (w) => w.abv, up: "Alcohol %: lowest first", down: "Alcohol %: highest first" },
  // the four steps, then the store's own figure within a step (grams of sugar, or BC's code)
  // how well the wine suits the food ticked: the store says so, then a grape known for it,
  // then a classic by style, then adventurous
  food: { get: (w) => foodMatchScore(w), up: "Food match: weakest first", down: "Best food match first", first: "down" },
  // the adventurous matches for the food ticked (with adventurous pairings included) ahead of the classics
  adventure: { get: (w) => (state.food.size && state.foodBold ? (boldFoodsOf(w).some((b) => state.food.has(b.food)) ? 1 : 0) : null),
    up: "Classic pairings first", down: "Adventurous pairings first", first: "down" },
  // a wine's (first) grape, or the grape you ticked if it's a blend containing it
  grape: { get: (w) => { const g = grapesOf(w); return (state.grapes.size && !state.grapeOut && g.find((x) => state.grapes.has(x))) || g[0] || null; },
    text: true, up: "Grape: A to Z", down: "Grape: Z to A" },
  sweet: { get: (w) => { const v = wineStyle(w).sweet.v; return v ? SWEET_LEVELS.indexOf(v) * 1000 + estimatedStyle(w).sweetFine : null; },
    up: "Sweetness: driest first", down: "Sweetness: sweetest first", first: "down" },
  // Claude's score for this listing, or for the same wine at another store or in a cellar
  claude: { get: (w) => claudeScore(w) ?? ratedTwin(w)?.claude?.points, up: "Claude's score: lowest first", down: "Claude's score: highest first", first: "down" },
  mine: { get: (w) => ratingOf(w.id).mine?.points, up: "My rating (on this computer): lowest first", down: "My rating (on this computer): highest first", first: "down" },
  // family members' own published scores only (never Claude's)
  family: { get: (w) => frOf(w.id).family?.points ?? ratedTwin(w)?.family?.points, up: "Family members' ratings: lowest first", down: "Family members' ratings: highest first", first: "down" },
  // the cellar owner's own CellarTracker score, else the CellarTracker community score
  ct: { get: (w) => w.my_score ?? w.ct_score, up: "CellarTracker score: lowest first", down: "CellarTracker score: highest first", first: "down" },
  cellars: { get: (w) => (cellarMatches(w).length ? 1 : null), up: "In the family's cellars last", down: "In the family's cellars first", first: "down" },
};
// Older saved places used one sort name.
const OLD_SORTS = { name: "name-asc", country: "country-asc", vintage: "vintage-desc", abv: "abv-asc", sweet: "sweet-desc",
  claude: "claude-desc", mine: "mine-desc", family: "family-desc", "cellar-score": "ct-desc" };

const sortGroup = (v) => v.replace(/-(asc|desc)$/, ""); // "price-asc" and "price-desc" are one choice

function sortLevel(v) {
  if (v.startsWith("cellar:")) {
    const src = v.slice(7);
    const has = (w) => (cellarMatches(w).some((m) => m.source === src) ? 0 : 1);
    return (a, b) => has(a) - has(b);
  }
  const key = SORT_KEYS[sortGroup(v)];
  if (!key) return () => 0;
  const dir = v.endsWith("-desc") ? -1 : 1;
  return (a, b) => {
    const x = key.get(a), y = key.get(b);
    const xm = x == null || x === "", ym = y == null || y === "";
    if (xm || ym) return xm && ym ? 0 : xm ? 1 : -1;
    return dir * (key.text ? String(x).localeCompare(String(y)) : x - y);
  };
}


function countBy(skip, key) {
  const counts = new Map();
  for (const w of findPool()) if (matches(w, skip)) counts.set(w[key], (counts.get(w[key]) || 0) + 1);
  return counts;
}

// ---- Rendering: filters --------------------------------------------------------

function checkbox(name, value, checked, label, count, extra = "") {
  const c = count == null ? "" : `<span class="count">${count}</span>`;
  return `<label class="check${extra}"><input type="checkbox" data-group="${name}" value="${esc(value)}"${checked ? " checked" : ""}> ${label}${c}</label>`;
}

// With one store's list loaded there is nothing to choose, so say where the wines
// come from and point to the other-stores search. Checkboxes appear by themselves
// once a second store's list is published (meta.json → data_file).
function renderSources() {
  const have = knownSources();
  if (have.length < 2) {
    $("source-legend").textContent = "Wines listed here";
    $("source-list").innerHTML = `<p class="source-only">${have.map(sourceBadge).join(" ")}</p>
      <p class="hint">Looking for another store?</p>
      <button type="button" class="btn btn-ew" data-action="goto-ew">Where can I buy…? →</button>`;
    renderCellarFilter();
    return;
  }
  const cel = [...state.sources].filter((s) => !ALL_SOURCES.includes(s));
  $("source-legend").textContent = cel.length ? `Sold by (of ${cel.join(", ")}'s wines)`.replace("'s cellar's", "'s") : "Sold by";
  // With a cellar ticked, each store shows how many of its wines that store sells.
  const celWines = cellarOn() ? cellarWinesTicked() : null;
  const sells = (src) => (celWines && LOADED.has(src) ? celWines.filter((w) => storeMatchesOf(w.id).some((x) => x.source === src)).length : null);
  $("source-list").innerHTML = have.map((s) => checkbox("source", s, state.sources.has(s), sourceBadge(s), sells(s))).join("") +
    lcboBoxHtml();
  renderCellarFilter();
}

// LCBO under "Sold by": an ordinary box once this browser has the private list;
// until then, ticking it asks for the unlock code.
function lcboBoxHtml() {
  const info = lcboInfo();
  if (info) return `<p class="hint lcbo-hint">${lcboPanel.done ? "✓ LCBO unlocked on this browser. " : ""}LCBO: private ${esc(info.asOf)} list, ${Number(info.count).toLocaleString()} wines.</p>`;
  return `<label class="check"><input type="checkbox" id="lcbo-lock"${lcboPanel.open ? " checked" : ""}> ${sourceBadge("LCBO")}</label>` +
    (lcboPanel.open ? `<div class="lcbo-unlock">
      <label for="lcbo-code">Enter unlock code for LCBO</label>
      <input type="text" id="lcbo-code" autocomplete="off" spellcheck="false">
      <button type="button" class="btn btn-primary" data-action="lcbo-unlock">Unlock</button>
      <p class="hint" id="lcbo-msg" aria-live="polite">${esc(lcboPanel.msg)}</p>
    </div>` : "");
}

// Family cellars, at the top of the filters: tick one to see that whole cellar.
function renderCellarFilter() {
  const srcs = cellarSources();
  $("cellar-filter").hidden = !srcs.length;
  const counts = new Map();
  for (const w of cellarFindWines()) counts.set(w.source, (counts.get(w.source) || 0) + 1);
  const slotOf = (src) => visibleShared().find(([slot]) => cellarTitle(slot) === src)?.[0];
  $("cellar-filter-list").innerHTML = srcs.map((s) => {
    const slot = slotOf(s);
    return checkbox("cellar", s, state.sources.has(s), esc(s), counts.get(s) || 0, " check-cellar") + (slot && !cellarNames()[slot]
      ? `<button type="button" class="btn btn-mini" data-action="mw-name-cellar" data-slot="${esc(slot)}">Whose is ${esc(s)}? Name it</button>` : "");
  }).join("");
}

function renderCountries() {
  const counts = countBy("country", "country");
  const q = fold(state.countryQ);
  const all = findPool().filter((w) => state.sources.has(w.source)).map((w) => w.country);
  const names = visibleCountries(all, q);
  $("country-list").innerHTML = names.length
    ? names.map((n) => {
        const c = counts.get(n) || 0;
        return checkbox("country", n, state.countries.has(n), esc(n), c, c ? "" : " zero");
      }).join("")
    : `<p class="hint">No country matches “${esc(state.countryQ)}”.</p>`;
  // "Leave out countries": the same boxes, but a tick becomes an ✕ and means "not this one"
  $("country-list").classList.toggle("leaving-out", state.countryOut);
  $("country-out").setAttribute("aria-pressed", String(state.countryOut));
  $("country-out").textContent = state.countryOut ? "✓ Leaving out countries" : "Leave out countries";
  $("country-all").hidden = state.countryOut;
  $("country-hint").textContent = state.countryOut
    ? "Tick a country to leave it out (it shows an ✕); every other country is shown. Press the button again to go back to choosing."
    : "No country ticked means every country is shown.";
}

// Every country the chosen sources carry (plus any ticked), even when other
// filters leave it with no wines, so the list never looks like it is missing some.
function visibleCountries(all, q = fold(state.countryQ)) {
  return [...new Set([...all, ...state.countries])]
    .filter((n) => !q || fold(n).includes(q))
    .sort((a, b) => a.localeCompare(b));
}

// ---- Grape, food, vintage and alcohol (side panel) -------------------------------------------
// A wine's grapes: the store's grape field (LCBO, Weinshop365, cellars) and the words in its
// name and region, including regions that mean a grape (Barolo is Nebbiolo, Rioja is
// Tempranillo). A blend gets each grape it names. Order matters only for the region words.
const GRAPES = [
  ["Cabernet Sauvignon", /\bcabernet sauvignon\b|\bcab(ernet)? sauv\b|\bcabernet\b(?!\s+franc)|\bpauillac\b|\bmargaux\b|\bsaint.julien\b|\bst.julien\b|\bsaint.estephe\b|\bst.estephe\b|\bhaut.medoc\b|\bmedoc\b/],
  ["Merlot", /\bmerlot\b|\bpomerol\b|\bsaint.emilion\b|\bst.emilion\b/],
  ["Cabernet Franc", /\bcabernet franc\b|\bchinon\b|\bbourgueil\b|\bsaumur.champigny\b/],
  ["Pinot Noir", /\bpinot noir\b|\bpinot nero\b|\bspatburgunder\b|\bblauburgunder\b/],
  ["Gamay", /\bgamay\b|\bbeaujolais\b|\bmorgon\b|\bfleurie\b|\bmoulin.a.vent\b|\bbrouilly\b|\bjulienas\b|\bchiroubles\b|\bregnie\b|\bchenas\b/],
  ["Syrah / Shiraz", /\bsyrah\b|\bshiraz\b|\bhermitage\b|\bcrozes\b|\bcornas\b|\bcote.rotie\b|\bsaint.joseph\b|\bst.joseph\b/],
  ["Grenache / Garnacha", /\bgrenache\b|\bgarnacha\b|\bcannonau\b|\bchateauneuf\b|\bgigondas\b|\bvacqueyras\b|\bpriorat\b/],
  ["Tempranillo", /\btempranillo\b|\btinto fino\b|\btinta de toro\b|\btinta roriz\b|\baragonez\b|\brioja\b|\bribera del duero\b|\btoro\b/],
  ["Sangiovese", /\bsangiovese\b|\bchianti\b|\bbrunello\b|\bmontalcino\b|\bvino nobile\b|\bmorellino\b/],
  ["Nebbiolo", /\bnebbiolo\b|\bbarolo\b|\bbarbaresco\b|\bgattinara\b|\bghemme\b/],
  ["Montepulciano", /\bmontepulciano\b/], // but Vino Nobile di Montepulciano is the town: Sangiovese (see grapesOf)
  ["Corvina (Amarone, Valpolicella)", /\bcorvina\b|\bamarone\b|\bvalpolicella\b|\bripasso\b/],
  ["Malbec", /\bmalbec\b|\bcahors\b/],
  ["Zinfandel / Primitivo", /\bzinfandel\b|\bprimitivo\b/],
  ["Touriga Nacional", /\btouriga\b/],
  ["Carmenère", /\bcarmenere\b/],
  ["Pinotage", /\bpinotage\b/],
  ["Tannat", /\btannat\b|\bmadiran\b/],
  ["Mourvèdre / Monastrell", /\bmourvedre\b|\bmonastrell\b|\bmataro\b|\bbandol\b|\bjumilla\b/],
  ["Barbera", /\bbarbera\b/],
  ["Dolcetto", /\bdolcetto\b/],
  ["Aglianico", /\baglianico\b|\btaurasi\b/],
  ["Nero d'Avola", /\bnero d.?avola\b/],
  ["Petite Sirah", /\bpetite? sirah\b|\bdurif\b/],
  ["Petit Verdot", /\bpetit verdot\b/],
  ["Carignan", /\bcarignan\b|\bcarinena\b/],
  ["Mencía", /\bmencia\b|\bbierzo\b/],
  ["Blaufränkisch", /\bblaufrankisch\b|\bkekfrankos\b|\blemberger\b/],
  ["Zweigelt", /\bzweigelt\b/],
  ["Saperavi", /\bsaperavi\b/],
  ["Xinomavro", /\bxinomavro\b|\bnaoussa\b/],
  ["Agiorgitiko", /\bagiorgitiko\b|\bnemea\b/],
  ["Chardonnay", /\bchardonnay\b|\bchablis\b|\bmeursault\b|\bpuligny\b|\bchassagne\b|\bpouilly.fuisse\b|\bmacon\b|\bmontrachet\b|\bcorton.charlemagne\b/],
  ["Sauvignon Blanc", /\bsauvignon blanc\b|\bsancerre\b|\bpouilly.fume\b|\bfume blanc\b/],
  ["Riesling", /\briesling\b/],
  ["Pinot Grigio / Gris", /\bpinot grigio\b|\bpinot gris\b/],
  ["Gewürztraminer", /\bgewurztraminer\b|\bgewurz\b/],
  ["Chenin Blanc", /\bchenin\b|\bvouvray\b|\bsavennieres\b|\bmontlouis\b/],
  ["Viognier", /\bviognier\b|\bcondrieu\b/],
  ["Grüner Veltliner", /\bgruner\b/],
  ["Albariño", /\balbarino\b|\balvarinho\b/],
  ["Sémillon", /\bsemillon\b/],
  ["Muscat / Moscato", /\bmuscat\b|\bmoscato\b|\bmoscatel\b/],
  ["Vermentino", /\bvermentino\b/],
  ["Verdejo", /\bverdejo\b/],
  ["Godello", /\bgodello\b/],
  ["Chasselas", /\bchasselas\b|\bdezaley\b|\bfendant\b/],
  ["Garganega (Soave)", /\bgarganega\b|\bsoave\b/],
  ["Cortese (Gavi)", /\bcortese\b|\bgavi\b/],
  ["Pinot Blanc", /\bpinot blanc\b|\bpinot bianco\b|\bweissburgunder\b/],
  ["Marsanne / Roussanne", /\bmarsanne\b|\broussanne\b/],
  ["Assyrtiko", /\bassyrtiko\b/],
  ["Torrontés", /\btorrontes\b/],
  ["Fiano", /\bfiano\b/],
  ["Furmint", /\bfurmint\b|\btokaji\b/],
  ["Glera (Prosecco)", /\bglera\b|\bprosecco\b/],
];
function grapesOf(w) {
  if (w._grapes) return w._grapes;
  const t = fold([w.name, w.grape, w.region, w.region_or_grape, w.varietal].filter(Boolean).join(" "));
  const out = GRAPES.filter(([, re]) => re.test(t)).map(([name]) => name);
  return (w._grapes = /\bvino nobile\b/.test(t) ? out.filter((g) => g !== "Montepulciano") : out);
}

// Food it goes with, estimated from colour, body, tannin, sweetness and fruitiness (the same
// thinking as the restaurant page): a guide, not a sommelier.
const FOODS = ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood", "Pasta and pizza", "Cheese", "Spicy food", "Dessert"];
// What each grape is classically served with, in plain words: the strongest clue to a food
// match that the stores' data gives. A grape listed for a food makes it a classic match.
// Checked against Dornenburg & Page, What to Drink with What You Eat (2006), chapters 5 and 6:
// the pairings it prints in capitals or marks as classic are listed here, and its "avoid"
// notes narrow the lines (Zinfandel: not ham, mild cheese or Thai food).
const GRAPE_FOOD = {
  "Cabernet Sauvignon": { "Red meat": "ribeye, prime rib and roast beef", "Lamb": "roast leg of lamb with rosemary", "Cheese": "aged Cheddar and other hard cheeses" },
  "Merlot": { "Red meat": "roast beef, meatloaf and burgers", "Pork": "roast pork tenderloin", "Chicken": "roast chicken with mushrooms", "Pasta and pizza": "lasagna and meaty pasta", "Spicy food": "meaty Indian curries with chicken or lamb, and chili" },
  "Cabernet Franc": { "Pork": "roast pork and sausages", "Chicken": "herb-roasted chicken", "Lamb": "lamb with herbs", "Cheese": "goat cheese", "Red meat": "lean roast beef and pepper steak", "Fish": "grilled salmon and turbot (a Chinon)" },
  "Pinot Noir": { "Chicken": "roast chicken, duck and turkey", "Pork": "pork tenderloin and ham", "Pasta and pizza": "mushroom risotto and mushroom pasta", "Red meat": "beef bourguignon, lean roast beef and veal chops", "Lamb": "roast or stewed lamb", "Fish": "salmon (broiled, pan-roasted or grilled) and tuna", "Cheese": "washed-rind cheeses such as Reblochon and Époisses" },
  "Gamay": { "Chicken": "roast chicken and picnic fare", "Pork": "charcuterie, sausages and pâté", "Pasta and pizza": "pizza and simple pasta", "Red meat": "burgers and steak frites" },
  "Syrah / Shiraz": { "Red meat": "peppered steak, barbecue and game", "Lamb": "grilled lamb and lamb stew", "Pork": "barbecue pork and ribs", "Chicken": "barbecued chicken and grilled or Peking duck" },
  "Grenache / Garnacha": { "Lamb": "roast lamb and Provençal stews", "Red meat": "grilled meats and beef stew", "Pork": "roast pork and sausages", "Spicy food": "chili and spicy Asian dishes (a Côtes du Rhône)" },
  "Tempranillo": { "Lamb": "roast lamb", "Red meat": "grilled steak and roast beef", "Pork": "chorizo, jamón and roast pork", "Cheese": "Manchego", "Seafood": "a meaty paella with chorizo", "Spicy food": "chile-based dishes" },
  "Sangiovese": { "Pasta and pizza": "tomato pasta, pizza and lasagna", "Red meat": "Florentine steak and meatballs in tomato sauce", "Cheese": "Parmesan and Pecorino", "Chicken": "chicken braised in tomato sauce, grilled or roasted" },
  "Nebbiolo": { "Red meat": "braised beef, osso buco, and mushroom or truffle dishes", "Lamb": "braised lamb", "Cheese": "aged hard cheeses" },
  "Montepulciano": { "Pasta and pizza": "pizza and pasta with meat sauce", "Red meat": "grilled sausages and burgers" },
  "Corvina (Amarone, Valpolicella)": { "Red meat": "braised beef and rich stews (Amarone)", "Pasta and pizza": "pasta with ragù", "Cheese": "aged Parmesan and blue cheese", "Chicken": "grilled or roast chicken (a Valpolicella)" },
  "Malbec": { "Red meat": "grilled steak, especially with chimichurri, and brisket", "Lamb": "grilled lamb", "Pork": "barbecue pork" },
  "Zinfandel / Primitivo": { "Red meat": "barbecue ribs, burgers and pulled beef", "Pork": "barbecued ribs, pulled pork and spicy sausage, rather than ham or charcuterie", "Chicken": "barbecued chicken", "Spicy food": "spicy meat dishes and sweet barbecue sauce, rather than Thai or Chinese food", "Pasta and pizza": "pasta with meat or spicy sauce, and sausage pizza", "Cheese": "rich, strong cheeses such as blue or feta, rather than mild Cheddar" },
  "Touriga Nacional": { "Red meat": "roast and grilled meats and stews", "Lamb": "roast lamb" },
  "Carmenère": { "Red meat": "grilled meats with herbs", "Pork": "roast pork", "Spicy food": "mildly spiced dishes" },
  "Pinotage": { "Red meat": "barbecue and smoked meats", "Pork": "sausages" },
  "Barbera": { "Pasta and pizza": "pizza, tomato pasta and risotto", "Pork": "sausages and charcuterie", "Chicken": "chicken cacciatore", "Red meat": "grilled or roasted meat, veal chops and bacon cheeseburgers" },
  "Chardonnay": { "Chicken": "roast chicken and creamy chicken dishes", "Pasta and pizza": "creamy pasta", "Seafood": "crab, lobster and scallops", "Cheese": "Brie, Camembert and triple-crème cheeses, and Comté" },
  "Sauvignon Blanc": { "Fish": "white fish with lemon or herbs", "Seafood": "oysters, shrimp and ceviche", "Cheese": "goat cheese", "Chicken": "herb chicken and salads", "Spicy food": "Thai and Mexican dishes with lemongrass, seafood or vegetables (a New Zealand one)" },
  "Riesling": { "Spicy food": "Thai, Indian and Szechuan dishes", "Pork": "pork with apples, choucroute and sausages", "Fish": "trout and smoked fish", "Seafood": "crab", "Cheese": "blue, soft and triple-crème cheeses" },
  "Pinot Grigio / Gris": { "Fish": "light white fish", "Seafood": "shrimp, clams and seafood pasta", "Pasta and pizza": "light pasta dishes", "Pork": "roast pork and prosciutto", "Cheese": "goat, sheep's-milk and smoked cheeses" },
  "Gewürztraminer": { "Spicy food": "Thai, Indian and Moroccan dishes", "Cheese": "Munster and other washed-rind cheeses", "Pork": "pork with fruit" },
  "Chenin Blanc": { "Pork": "pork with apples", "Chicken": "roast chicken", "Spicy food": "lightly spiced dishes" },
  "Viognier": { "Chicken": "chicken with apricots or in cream", "Spicy food": "mild curries", "Seafood": "lobster and scallops", "Fish": "white fish, fish stews and smoked fish" },
  "Grüner Veltliner": { "Fish": "white fish", "Chicken": "schnitzel and roast chicken", "Spicy food": "Asian dishes", "Pork": "pork, sausages and bacon" },
  "Albariño": { "Seafood": "shellfish, octopus and grilled seafood", "Fish": "grilled white fish", "Spicy food": "spicy shellfish and spicy grilled fish" },
  "Muscat / Moscato": { "Dessert": "fruit desserts", "Spicy food": "spicy dishes" },
  "Glera (Prosecco)": { "Seafood": "fried calamari", "Fish": "fried fish" },
};
// Dishes Dornenburg & Page's What to Drink with What You Eat (2006) list for each grape, by
// food, strongest first: 4 = marked classic, 3 = very highly recommended, 2 = frequently.
const BOOK_DISHES = {"Muscat / Moscato":{"Dessert":[["cookies",3],["peaches",3],["rhubarb",3],["tiramisu",3]],"Cheese":[["assorted cheeses",3],["Taleggio",2],["Roquefort",2],["Montenebro",2]]},"Sauvignon Blanc":{"Fish":[["mackerel",3],["sardines",3],["red snapper",3],["smoked trout",3]],"Seafood":[["ceviche",4],["shellfish",4],["shrimp",3],["mussels",3]],"Cheese":[["Goat",4],["Chèvre",4],["cheese goat (especially fresh chévre)",4],["Crottin",3]],"Chicken":[["fried chicken",3],["chicken (especially creamy dishes)",3],["herbed chicken",2],["grilled chicken",2]],"Spicy food":[["chiles",3],["guacamole",3],["thai cuisine",3],["indian cuisine",3]],"Pasta and pizza":[["baked primavera light cream sauce with vegetables",2]],"Dessert":[["pineapple desserts",3]],"Red meat":[["veal (especially with cream sauce)",2]]},"Chenin Blanc":{"Dessert":[["peaches",2],["cheesecake",2],["strawberries",2],["apple desserts",2]],"Cheese":[["Saint-Nectaire",2],["cheese (especially goat)",2]],"Chicken":[["chicken (especially barbecued or with creamy sauce)",2]],"Seafood":[["scallops (especially baked)",3],["crab",2],["lobster",2],["scallops",2]],"Spicy food":[["indian cuisine",2],["mexican cuisine",2],["spicy foods and dishes",2]],"Fish":[["fish (especially mild white)",3],["trout (especially baked or with cream sauce)",3],["trout",2],["salmon",2]],"Pork":[["pork (especially roasted)",2],["pork with fruit or fruit sauce",2]]},"Riesling":{"Dessert":[["plums",3],["peaches",3],["cheesecake",3],["blueberries",3]],"Pork":[["choucroute",4],["sausage",3],["roasted pork",3]],"Spicy food":[["thai cuisine",4],["chiles",3],["wasabi",3],["curries",3]],"Fish":[["trout",3],["smoked fish",3],["smoked trout",3],["smoked salmon",3]],"Seafood":[["crab",4],["scallops",3],["soft-shell crab",3],["sautéed scallops",3]],"Cheese":[["Edam",3],["Gouda, Aged",3],["cheese (especially blue, soft, or triple crème)",3],["Brie",2]],"Chicken":[["chicken (especially poached or lightly sautéed)",3],["cold chicken",2],["chicken liver",2],["sweet-and-sour chicken",2]],"Red meat":[["veal",2],["veal with cream sauce",2],["veal wiener schnitzel",2]]},"Sémillon":{"Dessert":[["strawberries",2],["apples desserts",2],["pumpkin desserts",2]],"Fish":[["fish (especially grilled or stewed)",3],["mackerel",2],["red snapper",2]],"Seafood":[["mussels",2],["seafood and seafood soup",2]],"Chicken":[["chicken (especially roasted)",3]],"Pork":[["pork (especially chops, and especially with apples or other fruit)",3]],"Spicy food":[["spicy dishes",2]]},"Gamay":{"Pork":[["charcuterie or cold cuts (especially with beaujolais cru)",4],["sausage",3],["saucisson french garlicky sausage",3]],"Cheese":[["Brie",2],["Feta",2],["Emmental",2],["Muenster",2]],"Chicken":[["chicken (especially grilled or roasted)",3],["cold chicken",2],["roasted turkey",2],["grilled chicken",2]],"Spicy food":[["chili",2],["spicy dishes",2],["indian cuisine",2],["mexican cuisine",2]],"Red meat":[["hamburgers",3],["veal",2],["corned beef",2],["steak tartare",2]],"Pasta and pizza":[["macaroni and cheese",2]],"Fish":[["tuna",2],["mackerel",2],["tuna (especially grilled)",2]],"Seafood":[["calamari chicken",2],["lobster roll turkey",2],["roast beef lobster roll",2]],"Dessert":[["raspberries and raspberry desserts",2]]},"Chardonnay":{"Pork":[["bacon",2],["charcuterie",2],["roasted pork",2]],"Fish":[["sole",4],["tuna",3],["sushi",3]],"Cheese":[["Brie",3],["Cheddar",3],["Gruyère",3],["Havarti",3]],"Dessert":[["cheesecake",2],["fresh fruit desserts",2]],"Chicken":[["chicken (especially baked, fried, grilled, roasted, or in cream sauce)",4],["roasted chicken",3],["baked chicken, with cream sauce",3],["duck",2]],"Spicy food":[["curries",2],["guacamole",2],["quesadillas",2],["indian cuisine",2]],"Seafood":[["lobster",4],["oysters",4],["crayfish",3],["scallops",3]],"Pasta and pizza":[["baked al fredo",3],["macaroni and cheese",3],["risotto",2]],"Red meat":[["veal with cream sauce",3],["veal",2],["roasted veal",2],["veal (especially in cream sauce or roasted)",2]]},"Pinot Noir":{"Pork":[["bacon",3],["pork (especially loin)",3],["pork loin (especially roasted)",3]],"Red meat":[["beef bourguignon",4],["veal (especially chops)",3],["beef (especially braised, roasted, or stewed, with fuller-bodied wines)",3],["game",2]],"Cheese":[["Reblochon",3],["Pont-L’Eveque",3],["Brie",2],["Edam",2]],"Chicken":[["duck (especially roasted)",4],["roasted chicken",3],["coq au vin chicken, with red wine sauce",3],["chicken (especially braised, poached, or roasted)",3]],"Spicy food":[["chiles",2],["indian cuisine",2],["mexican cuisine",2],["spicy foods and dishes",2]],"Fish":[["tuna",4],["salmon",4],["salmon (especially broiled, pan-roasted, poached, or grilled)",4],["swordfish",3]],"Lamb":[["lamb (especially roasted or stewed)",2]],"Pasta and pizza":[["risotto with mushrooms",3],["macaroni and cheese",2]],"Seafood":[["calamari spinach",2]],"Dessert":[["strawberries",2]]},"Syrah / Shiraz":{"Pork":[["wild boar",3],["sausage (especially grilled)",3],["barbecue (especially spareribs)",3],["bacon",2]],"Red meat":[["game",3],["hamburgers",3],["stewed steak",3],["grilled steak",3]],"Cheese":[["cheese (especially aged or hard)",3],["Cheddar",2],["Provolone",2],["smoked cheese",2]],"Chicken":[["duck",2],["grilled chicken",2],["roasted chicken",2],["chicken tandoori",2]],"Spicy food":[["red spicy, fruity, tannic",3],["chili",2],["chiles",2],["spicy meat",2]],"Dessert":[["empanadas",2]],"Lamb":[["lamb (especially braised)",3],["braised lamb",2]],"Fish":[["tuna (especially grilled or stewed)",3],["salmon",2]],"Seafood":[["lobster",3]],"Pasta and pizza":[["pasta (especially rich)",2]]},"Tempranillo":{"Pork":[["pork (especially barbecued or roasted)",3],["bacon",2],["chorizo (especially with fruity or young rioja)",2]],"Cheese":[["Manchego",3],["cheese, manchego",3],["Serena",2],["Cabrales",2]],"Chicken":[["duck",2],["roasted chicken",2],["poultry (especially roasted)",2],["duck (especially grilled or roasted)",2]],"Spicy food":[["chiles",3]],"Lamb":[["lamb (especially braised, grilled, roasted, sautéed, or stewed)",4],["lamb and lamb chops (especially roasted)",3],["moussaka",2],["braised lamb",2]],"Seafood":[["paella",3]],"Red meat":[["veal scallopine",2],["veal (especially scallopine)",2],["beef (especially braised or stewed)",2]],"Fish":[["fish (especially grilled)",2]]},"Nebbiolo":{"Red meat":[["game",3],["braised beef",3],["beef (especially braised, grilled, or stewed)",3],["pot roast",2]],"Pork":[["wild boar",2]],"Cheese":[["Fontina",3],["Parmesan",3],["gorgonzola",3],["Castelmagno",3]],"Pasta and pizza":[["risotto",2],["risotto with mushrooms",2],["risotto with white truffles",2],["pasta (especially tomato-sauced)",2]],"Chicken":[["duck and duck confit",2]],"Lamb":[["stew (especially beef or lamb)",2],["lamb (especially grilled or roasted)",2]]},"Cabernet Sauvignon":{"Red meat":[["veal",3],["hamburgers",3],["grilled steak",3],["steak rib eye",3]],"Cheese":[["Cheddar",3],["Camembert",3],["Pierre Robert",3],["cheese (especially aged, blue, or stinky)",3]],"Chicken":[["duck",2],["chicken paprika",2],["roasted chicken",2],["cornish game hens",2]],"Lamb":[["lamb (especially roasted)",4],["baby delicately flavored lamb",2]],"Pasta and pizza":[["baked bolognese",2]],"Spicy food":[["southwestern cuisine",2]],"Dessert":[["chocolate (especially dark bittersweet)",2]]},"Sangiovese":{"Red meat":[["aged steak or grilled",3],["veal (especially chops)",3],["steak (especially grilled)",3],["veal",2]],"Pork":[["sausage",3],["wild boar",3],["prosciutto",2],["grilled pork",2]],"Pasta and pizza":[["pasta with meat or tomato sauce",4],["lasagna",3]],"Cheese":[["Pecorino",3],["cheese (especially aged asiago, gouda, parmesan, pecorino)",3],["Parmesan",2],["Raclette",2]],"Chicken":[["fried chicken",2],["roasted chicken",2],["chicken cacciatore",2],["pasta with meat sauce",2]],"Spicy food":[["chiles pasilla",2]],"Lamb":[["lamb and lamb chops (especially roasted)",3],["moussaka",2]]},"Merlot":{"Red meat":[["steak filet mignon",3],["veal and veal chops",3],["beef (especially grilled or roasted)",3],["steak (especially filet mignon or grilled)",3]],"Cheese":[["cheese (especially blue and other full-flavored cheese)",3],["Romano",2],["Cheddar",2],["Provolone",2]],"Chicken":[["turkey (especially roasted)",3],["duck (especially grilled or roasted)",3],["chicken (especially braised, grilled, or roasted)",3],["chicken liver",2]],"Dessert":[["empanadas",2]],"Spicy food":[["indian cuisine",3],["mexican cuisine",2]],"Fish":[["tuna",2],["salmon",2],["grilled tuna",2],["japanese cuisine",2]],"Lamb":[["lamb and lamb chops (especially grilled, roasted, or stewed)",3]],"Pasta and pizza":[["baked bolognese",2],["macaroni and cheese",2],["tomatoes and tomato sauce",2]],"Pork":[["pork (especially loin, and especially grilled or roasted)",3],["sausage",2],["pork chops (especially grilled or roasted)",2]],"Seafood":[["calamari vegetable, grilled",2]]},"Zinfandel / Primitivo":{"Red meat":[["hamburgers",4],["grilled hamburgers",4],["grilled steak",3]],"Cheese":[["Monterey Jack",3],["cheese (especially rich or strong)",3],["hamburgers (especially grilled, and especially with cheese)",3],["Cheddar",2]],"Chicken":[["barbecued meat (especially chicken or pork especially ribs)",4],["duck",3],["turkey (especially roasted)",3]],"Spicy food":[["barbecue sauce, sweet not spicy",4],["chili",3],["chiles",3],["curries",3]],"Dessert":[["figs",2]],"Pork":[["barbecued meat (especially chicken or pork especially ribs)",4],["sausage",3],["pork (especially chops or roasted)",3],["sausage (especially spicy or grilled)",3]],"Pasta and pizza":[["pasta (especially with meat or spicy sauce)",3],["baked bolognese",2],["pizza with sausage",2],["tomatoes and tomato sauce",2]]},"Grenache / Garnacha":{"Red meat":[["braised beef",3],["game",2],["veal",2],["hamburgers",2]],"Cheese":[["Emmental",2],["Roquefort",2],["Port Salut",2],["Saint-Nectaire",2]],"Chicken":[["roasted chicken",2],["chicken (especially roasted)",2],["duck (especially roasted or as confit)",2],["tikka masala indian-style butter chicken",2]],"Spicy food":[["red spicy, dense, earthy, rich",3],["chili",2]],"Lamb":[["lamb (especially grilled)",3],["braised lamb",2]],"Seafood":[["lobster",2],["calamari niçoise",2]],"Pork":[["sausage",2]],"Fish":[["grilled tuna",2]]},"Petite Sirah":{"Red meat":[["steak (especially grilled)",2]],"Spicy food":[["mexican food",2]]},"Cabernet Franc":{"Pork":[["pork (especially with fruit sauce or roasted)",3],["sausage",2],["cabbage and cabbage-based dishes",2]],"Cheese":[["Goat",2],["cheeses (especially strong-flavored)",2]],"Red meat":[["beef (especially lean, and especially roasted)",3],["veal",2],["steak (especially with pepper)",2]],"Chicken":[["duck",3]],"Lamb":[["lamb (especially chops, loin, or roasted)",3]],"Fish":[["salmon (especially grilled)",3],["grilled salmon",2]]},"Gewürztraminer":{"Pork":[["sausage",3],["pork (especially roasted)",3],["pork with fruit or fruit sauce",3]],"Spicy food":[["curries",3],["thai cuisine",3],["indian cuisine",3],["chinese cuisine",3]],"Cheese":[["Muenster",4],["assorted cheeses",4],["cheese (especially soft or strong/aged, *muenster, roquefort)",3],["smoked food (especially cheese, fish, meat, and other dishes)",3]],"Seafood":[["lobster",2],["fried squid",2],["crab with black bean sauce",2],["shellfish (especially spicy preparations)",2]],"Fish":[["smoked food (especially cheese, fish, meat, and other dishes)",3],["trout",2],["monkfish",2],["smoked salmon",2]],"Dessert":[["ginger desserts",2],["sweet desserts lemon",2],["onions (especially sweet)",2],["fruits (especially tropical, and especially fruity desserts)",2]],"Chicken":[["turkey",3],["pâté (especially duck liver)",2],["duck (especially peking or roasted)",2],["chicken (especially stronger-flavored)",2]]},"Albariño":{"Seafood":[["shellfish",3],["shellfish dishes (especially spicy)",3],["ceviche",2],["mussels, steamed",2]],"Fish":[["fish (especially grilled or spicy preparations)",3]],"Spicy food":[["shellfish dishes (especially spicy)",3],["fish (especially grilled or spicy preparations)",3],["seafood (especially spicy dishes)",2]]},"Barbera":{"Cheese":[["Fontina",2],["Morbier",2],["cheese (especially full-flavored)",2],["hamburgers (especially with bacon and cheese)",2]],"Chicken":[["roasted chicken",2],["chicken (especially grilled or roasted)",2]],"Spicy food":[["chiles pasilla",2],["mexican cuisine",2]],"Pasta and pizza":[["tomatoes and tomato sauce",4],["pasta (especially with tomato, rich cream, meat, or pesto sauce)",4],["pizza (especially pepperoni)",3]],"Pork":[["prosciutto",3],["salami",2],["sausage (especially grilled)",2],["pork (especially grilled or roasted chops)",2]],"Seafood":[["calamari tomato",2]],"Red meat":[["veal chops (especially grilled or roasted)",2],["hamburgers (especially with bacon and cheese)",2]],"Lamb":[["lamb (especially grilled, roasted, or stewed)",2]]},"Dolcetto":{"Cheese":[["pasta (especially with cheese or vegetables)",3],["Fontina",2],["Provolone",2]],"Chicken":[["chicken (especially grilled, roasted, or with tomato sauce)",3],["roasted chicken",2]],"Pasta and pizza":[["pasta (especially with simple sauce)",3],["chicken (especially grilled, roasted, or with tomato sauce)",3],["risotto",2]],"Pork":[["prosciutto",2]],"Red meat":[["hamburgers",2]],"Fish":[["grilled salmon",2]]},"Pinot Grigio / Gris":{"Cheese":[["cheese (especially goat, sheep’s milk, or smoked)",3],["Fontina",2],["macaroni and cheese",2],["smoked cheese, fish, and meat",2]],"Spicy food":[["indian cuisine",2],["chiles jalapeño",2],["spicy food, mildly",2],["spicy foods and dishes",2]],"Seafood":[["clams",4],["mussels",3],["scallops",3],["calamari seafood",3]],"Fish":[["salmon",3],["fish (especially white, and especially baked, grilled, or poached)",3],["sole",2],["trout",2]],"Pork":[["prosciutto",3],["pork (especially roasted)",3],["sausage",2]],"Pasta and pizza":[["pasta (especially with seafood or shellfish)",3],["risotto",2],["macaroni and cheese",2]],"Red meat":[["veal",2],["veal with cream sauce",2]],"Chicken":[["chicken (especially fried, grilled, poached, roasted, or sautéed)",3]],"Dessert":[["onions (especially cooked)",2]]},"Corvina (Amarone, Valpolicella)":{"Cheese":[["Parmesan",3],["cheese (especially blue, creamy, or salty)",3],["Robiola",2],["Provolone",2]],"Pasta and pizza":[["pasta (especially with lighter, or tomato sauce, or baked)",3],["risotto (especially with gorgonzola, mushroom, sausage, or vegetables)",3],["gnocchi",2],["risotto",2]],"Pork":[["sausage (especially pork or grilled)",3],["risotto (especially with gorgonzola, mushroom, sausage, or vegetables)",3],["salami",2]],"Lamb":[["lamb (especially braised, grilled, stewed, or with spices)",3]],"Red meat":[["veal (especially roasted)",2],["short ribs (especially braised)",2]],"Fish":[["tuna",2],["pasta (especially with fish or tomato sauce)",2]],"Dessert":[["nuts (especially pecans, and nut desserts)",2],["chocolate (especially dark, and chocolate desserts)",2]],"Chicken":[["chicken (especially grilled or roasted)",3],["turkey (especially roasted)",2]],"Spicy food":[["mexican food",2]]},"Pinot Blanc":{"Pork":[["choucroute",2]],"Pasta and pizza":[["risotto with vegetables",2]],"Seafood":[["scallops",3],["oysters",2],["calamari green",2],["shellfish",2]],"Fish":[["salmon",3],["sole",2],["trout",2],["soup fish",2]],"Chicken":[["turkey (especially roasted)",3],["chicken (especially roasted or as a salad)",3],["salad (especially green or chicken)",2]]},"Viognier":{"Seafood":[["lobster",3],["crab",2],["mussels",2],["scallops",2]],"Spicy food":[["curries",3],["indian food",2],["indian cuisine",2],["curries with fish, seafood, or poultry",2]],"Fish":[["fish (especially white or stewed)",3],["monkfish",2],["smoked fish and other foods",2]],"Pork":[["pork (especially roasted)",3],["pork with fruit or fruit sauce",2]],"Chicken":[["chicken (especially roasted or with cream sauce)",3],["duck (especially roasted)",2]],"Red meat":[["veal",2]]},"Garganega (Soave)":{"Fish":[["fish (especially baked, fried, poached, or other light preparation)",3],["sardines",2],["fritto misto",2]],"Pasta and pizza":[["pasta (especially with seafood)",3],["risotto",2],["risotto with shrimp or squid",2]],"Seafood":[["pasta (especially with seafood)",3],["shrimp",2],["scallops",2],["calamari seafood",2]],"Chicken":[["chicken (especially as a salad)",3]]},"Malbec":{"Lamb":[["lamb (especially barbecued, braised, or roasted)",3],["braised lamb",2]],"Spicy food":[["mexican cuisine",2]],"Chicken":[["duck and duck confit",2]],"Red meat":[["grilled steak",3],["beef (especially roasted or stewed)",3]],"Pork":[["sausage",2],["pizza (especially with mushrooms or sausage)",2]],"Pasta and pizza":[["pizza (especially with mushrooms or sausage)",2]]},"Marsanne / Roussanne":{"Seafood":[["lobster (especially boiled or steamed)",2]]},"Montepulciano":{"Pasta and pizza":[["pasta (especially with meat, mushroom, or tomato sauce)",3],["pizza with pepperoni",2]],"Lamb":[["lamb (especially braised, grilled, roasted, or stewed)",3]],"Pork":[["pork (especially grilled or roasted)",2]]},"Mourvèdre / Monastrell":{"Fish":[["red snapper",2]],"Seafood":[["calamari niçoise",3]],"Pork":[["sausage",2]],"Chicken":[["poultry (especially grilled)",2]],"Red meat":[["steak (especially grilled)",2]]},"Grüner Veltliner":{"Seafood":[["scallops",3],["lobster",2]],"Fish":[["sushi",3],["swordfish with peppercorn crust",2]],"Red meat":[["veal (especially roasted)",3],["veal wiener schnitzel",2]],"Cheese":[["cheese (especially stinky, fatty, rich, or blue)",2]],"Spicy food":[["thai food and spices",2]]},"Aglianico":{"Red meat":[["beef (especially braised, grilled or stewed)",2]],"Cheese":[["cheese (especially aged)",2]],"Lamb":[["lamb (especially grilled)",2]],"Pork":[["sausage",2]],"Spicy food":[["spicy dishes",2]]},"Tannat":{"Chicken":[["duck and duck confit",2]]},"Vermentino":{"Fish":[["fish (especially simple)",3]],"Pasta and pizza":[["pasta (especially with pesto)",2]]}};
// How strongly Dornenburg & Page recommend each grape with each food, from how they print it
// and how often: 3 = marked classic, or very highly recommended a dozen times or more; 2 =
// very or frequently recommended; 1 = listed. A grape the book doesn't list gets 1.
const BOOK_TIER = {"Cabernet Sauvignon":{"Red meat":3,"Lamb":3,"Pork":1,"Chicken":2,"Fish":2,"Seafood":1,"Pasta and pizza":2,"Cheese":3,"Spicy food":2,"Dessert":1},"Merlot":{"Red meat":3,"Lamb":2,"Pork":2,"Chicken":3,"Fish":2,"Seafood":2,"Pasta and pizza":2,"Cheese":3,"Spicy food":2,"Dessert":1},"Cabernet Franc":{"Red meat":2,"Lamb":2,"Pork":2,"Chicken":2,"Fish":2,"Seafood":1,"Pasta and pizza":1,"Cheese":2,"Spicy food":1,"Dessert":1},"Pinot Noir":{"Red meat":3,"Lamb":2,"Pork":3,"Chicken":3,"Fish":3,"Seafood":2,"Pasta and pizza":2,"Cheese":3,"Spicy food":2,"Dessert":1},"Gamay":{"Red meat":3,"Lamb":1,"Pork":3,"Chicken":3,"Fish":2,"Seafood":2,"Pasta and pizza":2,"Cheese":2,"Spicy food":2,"Dessert":2},"Syrah / Shiraz":{"Red meat":3,"Lamb":2,"Pork":3,"Chicken":3,"Fish":2,"Seafood":2,"Pasta and pizza":2,"Cheese":3,"Spicy food":3,"Dessert":2},"Grenache / Garnacha":{"Red meat":3,"Lamb":2,"Pork":2,"Chicken":2,"Fish":2,"Seafood":2,"Pasta and pizza":2,"Cheese":2,"Spicy food":2,"Dessert":1},"Tempranillo":{"Red meat":2,"Lamb":3,"Pork":3,"Chicken":2,"Fish":2,"Seafood":3,"Pasta and pizza":1,"Cheese":3,"Spicy food":2,"Dessert":1},"Sangiovese":{"Red meat":3,"Lamb":2,"Pork":3,"Chicken":3,"Fish":1,"Seafood":1,"Pasta and pizza":3,"Cheese":3,"Spicy food":2},"Nebbiolo":{"Red meat":3,"Lamb":2,"Pork":2,"Chicken":2,"Fish":1,"Pasta and pizza":2,"Cheese":3},"Montepulciano":{"Red meat":1,"Lamb":2,"Pork":1,"Chicken":1,"Seafood":1,"Pasta and pizza":2},"Corvina (Amarone, Valpolicella)":{"Red meat":2,"Lamb":2,"Pork":2,"Chicken":2,"Fish":2,"Seafood":1,"Pasta and pizza":3,"Cheese":2,"Spicy food":1,"Dessert":2},"Malbec":{"Red meat":3,"Lamb":2,"Pork":2,"Chicken":1,"Pasta and pizza":1,"Cheese":1,"Spicy food":2,"Dessert":1},"Zinfandel / Primitivo":{"Red meat":3,"Lamb":2,"Pork":3,"Chicken":3,"Fish":3,"Seafood":1,"Pasta and pizza":3,"Cheese":3,"Spicy food":3,"Dessert":2},"Tannat":{"Red meat":1,"Lamb":1,"Chicken":1,"Cheese":1},"Mourvèdre / Monastrell":{"Red meat":2,"Lamb":1,"Pork":2,"Chicken":1,"Fish":2,"Seafood":2,"Pasta and pizza":1,"Cheese":1},"Barbera":{"Red meat":2,"Lamb":1,"Pork":2,"Chicken":2,"Fish":1,"Seafood":1,"Pasta and pizza":3,"Cheese":2,"Spicy food":2},"Dolcetto":{"Red meat":2,"Pork":2,"Chicken":2,"Fish":1,"Seafood":1,"Pasta and pizza":3,"Cheese":2,"Spicy food":1},"Aglianico":{"Red meat":2,"Lamb":1,"Pork":1,"Chicken":1,"Fish":1,"Pasta and pizza":1,"Cheese":1,"Spicy food":1},"Nero d'Avola":{"Red meat":1,"Lamb":1,"Pork":1,"Fish":1,"Pasta and pizza":1,"Spicy food":1},"Petite Sirah":{"Red meat":2,"Lamb":1,"Pork":1,"Chicken":1,"Fish":1,"Cheese":2,"Spicy food":1},"Blaufränkisch":{"Red meat":1,"Lamb":1,"Pork":1,"Chicken":1,"Fish":1,"Cheese":1},"Chardonnay":{"Red meat":3,"Pork":3,"Chicken":3,"Fish":3,"Seafood":3,"Pasta and pizza":3,"Cheese":3,"Spicy food":2,"Dessert":1},"Sauvignon Blanc":{"Red meat":2,"Pork":1,"Chicken":3,"Fish":3,"Seafood":3,"Pasta and pizza":2,"Cheese":3,"Spicy food":3,"Dessert":2},"Riesling":{"Red meat":2,"Pork":3,"Chicken":3,"Fish":3,"Seafood":3,"Pasta and pizza":1,"Cheese":3,"Spicy food":3,"Dessert":3},"Pinot Grigio / Gris":{"Red meat":2,"Pork":3,"Chicken":3,"Fish":3,"Seafood":3,"Pasta and pizza":3,"Cheese":3,"Spicy food":2,"Dessert":2},"Gewürztraminer":{"Red meat":1,"Pork":3,"Chicken":3,"Fish":3,"Seafood":2,"Pasta and pizza":1,"Cheese":3,"Spicy food":3,"Dessert":2},"Chenin Blanc":{"Red meat":1,"Pork":2,"Chicken":2,"Fish":3,"Seafood":3,"Pasta and pizza":1,"Cheese":2,"Spicy food":2,"Dessert":2},"Viognier":{"Red meat":1,"Pork":2,"Chicken":2,"Fish":3,"Seafood":3,"Pasta and pizza":1,"Cheese":2,"Spicy food":3,"Dessert":1},"Grüner Veltliner":{"Red meat":2,"Pork":2,"Chicken":1,"Fish":2,"Seafood":3,"Pasta and pizza":1,"Cheese":2,"Spicy food":2,"Dessert":1},"Albariño":{"Pork":1,"Chicken":1,"Fish":2,"Seafood":3,"Pasta and pizza":1,"Cheese":1,"Spicy food":2},"Sémillon":{"Pork":2,"Chicken":2,"Fish":3,"Seafood":2,"Pasta and pizza":1,"Cheese":1,"Spicy food":1,"Dessert":2},"Muscat / Moscato":{"Seafood":1,"Pasta and pizza":1,"Cheese":3,"Spicy food":1,"Dessert":3},"Vermentino":{"Chicken":1,"Fish":2,"Seafood":1,"Pasta and pizza":2},"Garganega (Soave)":{"Red meat":1,"Pork":1,"Chicken":2,"Fish":3,"Seafood":3,"Pasta and pizza":2,"Cheese":1,"Dessert":1},"Pinot Blanc":{"Red meat":1,"Pork":2,"Chicken":2,"Fish":3,"Seafood":3,"Pasta and pizza":2,"Cheese":1,"Spicy food":1},"Marsanne / Roussanne":{"Pork":2,"Chicken":1,"Fish":1,"Seafood":2,"Pasta and pizza":1,"Cheese":1,"Spicy food":1},"Assyrtiko":{"Cheese":1}};
// Stars for a grape with the foods ticked: the book's strength, but a grape whose wines mostly
// don't match the food (a Chardonnay matched to steak by one store note) gets one star.
const STARS = (n) => "★".repeat(n);
const TIER_WORDS = { 3: "the go-to", 2: "a common match", 1: "pairs, but less often chosen" };
function grapeTier(g, foods, share = 1) {
  if (share < 0.5) return 1;
  return Math.max(1, ...[...foods].map((f) => BOOK_TIER[g]?.[f] || 1));
}
// The stars for this wine with one food: its best-placed grape, or one star when the match
// rests only on a store's or Claude's note.
function wineTier(w, food) {
  if (!(grapeFoodLine(w, food) || (w._styleFoods || []).includes(food))) return 1;
  const gs = grapesOf(w).filter((g) => grapeFits(w, g));
  return gs.length ? Math.max(...gs.map((g) => BOOK_TIER[g]?.[food] || 1)) : 1;
}
// The LCBO's tasting notes often say what to serve the wine with. That sentence is shown on
// the wine, and on the same wine at another store, only in browsers that have unlocked the
// LCBO's private list (it never reaches the public site).
const FOOD_WORDS = {
  "Red meat": /\b(steak|beef|red meat|(?<!(mushroom|veggie|vegetarian|bean|salmon|chicken|turkey) )burgers?|prime rib|brisket|ribs?|veal|venison|game)\b/,
  "Lamb": /\blamb\b/, "Pork": /\b(pork|ham|sausages?|charcuterie|prosciutto|bacon)\b/,
  "Chicken": /\b(chicken|poultry|turkey|duck)\b/, "Fish": /\b(fish|salmon|tuna|cod|halibut|trout|sea bass)\b/,
  "Seafood": /\b(seafood|shellfish|oysters?|shrimp|prawns?|mussels|clams|crab|lobster|scallops|calamari)\b/,
  "Pasta and pizza": /\b(pasta|pizza|lasagna|spaghetti|risotto)\b/, "Cheese": /\bcheeses?\b/,
  "Spicy food": /\b(spicy|curry|curries|thai|indian|szechuan|asian)\b/, "Dessert": /\b(dessert|chocolate|cake|tart|pie)\b/,
};
const SERVE = /\b(pair|pairs|serve|enjoy|match|try it|try this|perfect|great|ideal|delicious|lovely|terrific)\b[^.]*\b(with|alongside|for)\b/i;
function noteFoodSentence(note) {
  if (!note) return "";
  const parts = note.split(/(?<=[.!?])\s+/);
  return parts.find((p) => SERVE.test(p) && Object.values(FOOD_WORDS).some((re) => re.test(p.toLowerCase())))?.trim().slice(0, 220) || "";
}
// LCBO listings with a food sentence, found by name for the same wine at another store.
let lcboFoodIndex = null, lcboFoodKey = "", lcboByUpc = null;
function lcboFoodNote(w) {
  if (w.source === "LCBO") return noteFoodSentence(w.note);
  const key = storeListsKey();
  if (lcboFoodKey !== key) {
    lcboFoodKey = key;
    lcboByUpc = null;
    lcboFoodIndex = new Map();
    for (const l of WINES) {
      if (l.source !== "LCBO") continue;
      const sentence = noteFoodSentence(l.note);
      if (!sentence) continue;
      const toks = storeTokens(l.name);
      const k = [...toks].sort((a, b) => b.length - a.length)[0];
      if (k) (lcboFoodIndex.get(k) || lcboFoodIndex.set(k, []).get(k)).push({ l, sentence });
    }
  }
  if (w._lcboFoodKey === key) return w._lcboFood;
  w._lcboFoodKey = key;
  const u = gtin(w.upc);
  if (u) {
    lcboByUpc ??= new Map(WINES.filter((l) => l.source === "LCBO" && gtin(l.upc)).map((l) => [gtin(l.upc), l]));
    const l = lcboByUpc.get(u), sentence = l && noteFoodSentence(l.note);
    if (sentence) return (w._lcboFood = sentence);
  }
  const toks = storeTokens(w.name);
  for (const t of toks) for (const { l, sentence } of lcboFoodIndex.get(t) || [])
    if (typesAgree(w.type, l.type) && sameWineName(w.name, l.name)) return (w._lcboFood = sentence);
  return (w._lcboFood = "");
}
// The dishes Claude named for this wine in a quick score (its own, or the same wine's elsewhere),
// and the foods among them.
const claudePair = (w) => claudeStyle(w)?.pair || "";
function claudeFoods(w) {
  const s = claudePair(w).toLowerCase();
  return new Set(s ? FOODS.filter((f) => FOOD_WORDS[f].test(s)) : []);
}
// The foods the store's own note names.
function storeFoods(w) {
  const s = lcboFoodNote(w).toLowerCase();
  return new Set(s ? FOODS.filter((f) => FOOD_WORDS[f].test(s)) : []);
}

// The grape's line for a food, as [grape, line], when one of the wine's grapes has one. Only
// a grape of the wine's own colour counts: the dash of white Viognier in a red Côte-Rôtie
// doesn't make it a match for lobster.
const WHITE_GRAPES = new Set(["Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio / Gris", "Gewürztraminer", "Chenin Blanc",
  "Viognier", "Grüner Veltliner", "Albariño", "Sémillon", "Muscat / Moscato", "Vermentino", "Verdejo", "Godello", "Chasselas",
  "Garganega (Soave)", "Cortese (Gavi)", "Pinot Blanc", "Marsanne / Roussanne", "Assyrtiko", "Torrontés", "Fiano", "Furmint", "Glera (Prosecco)"]);
const grapeFits = (w, g) => (w.type === "Red" ? !WHITE_GRAPES.has(g) : w.type === "White" ? WHITE_GRAPES.has(g)
  : w.type === "Sparkling" && g === "Glera (Prosecco)"); // rosé and other sparkling use their style lines
// A sweet wine keeps to desserts, cheese and spice, whatever its grape.
const sweetOnly = (w, food) => ["sweet", "medium-sweet"].includes(wineStyle(w).sweet.v) && !["Dessert", "Cheese", "Spicy food"].includes(food);
function grapeFoodLine(w, food) {
  if (sweetOnly(w, food)) return null;
  for (const g of grapesOf(w)) if (grapeFits(w, g) && GRAPE_FOOD[g]?.[food]) return [g, GRAPE_FOOD[g][food]];
  return null;
}

function foodsOf(w) {
  const k = `${ratingsVer}|${ratedNamesVer}|${storeListsKey()}`; // the LCBO's notes count once its list is loaded; Claude's dishes once saved
  if (w._foods && w._foodsKey === k) return w._foods;
  const s = wineStyle(w), body = s.body.v, tannin = s.tannin.v, sweet = s.sweet.v, t = w.type, out = [];
  const sweetish = sweet === "sweet" || sweet === "medium-sweet";
  if (t === "Red") {
    if (body === "full" || tannin === "firm") out.push("Red meat");
    if (body !== "light") out.push("Lamb");
    if (body !== "full" || tannin === "soft") out.push("Pork");
    if (body === "light") out.push("Chicken");
    if (body !== "full" || tannin !== "firm") out.push("Pasta and pizza");
    if (body === "full" || tannin === "firm") out.push("Cheese");
    if (s.fruity.v && tannin !== "firm") out.push("Spicy food");
  } else if (t === "White") {
    if (sweetish) out.push("Spicy food", "Dessert", "Cheese");
    else {
      if (body !== "full") out.push("Fish", "Seafood");
      out.push("Chicken");
      if (body !== "light") out.push("Pork", "Pasta and pizza");
      out.push("Cheese"); // whites are the safer cheese match (Harrington; Dornenburg & Page)
      if (sweet === "off-dry") out.push("Spicy food");
    }
  } else if (t === "Rosé") out.push("Fish", "Seafood", "Chicken", "Pork", "Pasta and pizza", "Spicy food");
  else if (t === "Sparkling") out.push(...(sweetish ? ["Dessert"] : ["Fish", "Seafood", "Chicken", "Cheese"]));
  else if (t === "Dessert" || (t === "Fortified" && sweet !== "dry")) out.push("Dessert", "Cheese");
  else if (t === "Fortified") out.push("Seafood", "Cheese"); // fino, manzanilla
  w._styleFoods = [...out]; // matched by style alone (the rest come from the grape or the store's note)
  // a grape known for a food, or the store's own note naming it, makes it a classic match too
  for (const f of FOODS) if (!out.includes(f) && (grapeFoodLine(w, f) || storeFoods(w).has(f) || claudeFoods(w).has(f))) out.push(f);
  w._foodsKey = k;
  return (w._foods = out);
}

// Adventurous pairings: matches beyond the usual rules that wine writers, sommeliers and two
// pairing books back, each with the dish they name, why it works, the caution they give, and
// the source. Sources read in full: Dornenburg & Page, What to Drink with What You Eat (2006,
// "D&P", by chapter and entry); Harrington, Food and Wine Pairing (2008, by page); Fiona
// Beckett (Decanter, 2026; "Salmon and Pinot Noir"); Wine Folly; Majestic; InsideHook
// (Beverly Crandon); St. Louis Magazine (John Sears); VinePair; Food & Wine (2017).
// A rule only counts when the food isn't already a classic match for the wine.
const TANNIC_GRAPES = ["Cabernet Sauvignon", "Nebbiolo", "Tannat", "Petite Sirah", "Aglianico", "Mourvèdre / Monastrell", "Touriga Nacional", "Saperavi", "Syrah / Shiraz", "Malbec"];
const LIGHT_REDS = ["Pinot Noir", "Gamay", "Barbera", "Dolcetto", "Zweigelt", "Blaufränkisch", "Cabernet Franc", "Corvina (Amarone, Valpolicella)", "Mencía"];
const ADV_RULES = [
  // ---- Fish
  { food: "Fish", when: (c) => c.red && c.dry && c.body !== "full" && !c.tannic && c.has(LIGHT_REDS),
    dish: (c) => c.pick({ "Gamay": "cod, mackerel or sardines, lightly chilled", "Barbera": "grilled bass, halibut or tuna", "Mencía": "grilled sardines and octopus",
      "Cabernet Franc": "grilled salmon or turbot", "Corvina (Amarone, Valpolicella)": "flounder or grilled tuna", "Dolcetto": "grilled salmon or tuna" }) || "grilled salmon or tuna, or white fish cooked with bacon or mushrooms",
    why: "Low tannin keeps fish from tasting metallic, and grilling gives fish the weight for a red",
    warn: "skip it with delicate poached fish", src: "Harrington p. 155, 172; D&P ch. 5, “Fish”" },
  { food: "Fish", when: (c) => c.red && c.dry && c.has(["Merlot", "Zinfandel / Primitivo", "Syrah / Shiraz", "Cabernet Sauvignon", "Grenache / Garnacha", "Nero d'Avola", "Tempranillo"]),
    dish: (c) => c.pick({ "Syrah / Shiraz": "peppercorn-crusted swordfish or grilled tuna", "Cabernet Sauvignon": "black-pepper tuna or swordfish", "Nero d'Avola": "swordfish with capers",
      "Zinfandel / Primitivo": "grilled tuna, or tuna sushi", "Tempranillo": "spicy fish dishes and grilled fish" }) || "grilled tuna or swordfish",
    why: "Tuna and swordfish are steak-like fish that take a red: “Tuna, which is a steak like fish, lends itself to red wine” (Michael Flynn)",
    warn: "never with delicate white fish: tannin turns it metallic", src: "D&P ch. 3 and ch. 5, “Tuna”, “Swordfish”; Harrington p. 155" },
  { food: "Fish", when: (c) => c.white && c.dry && c.body === "full",
    dish: (c) => c.pick({ "Chardonnay": "cod, monkfish or grilled salmon, especially with a butter sauce" }) || "richer fish with butter or cream sauces",
    why: "A big, oaky white matches grilled salmon's weight, and butter bridges the two",
    warn: "not with raw fish or sushi: oak clashes", src: "Harrington p. 172; D&P ch. 5, “Cod”, “Fish: butter sauce”" },
  // ---- Seafood
  { food: "Seafood", when: (c) => c.red && c.dry && c.body !== "full" && !c.tannic && c.has(["Pinot Noir", "Gamay", "Barbera", "Cabernet Franc", "Montepulciano", "Grenache / Garnacha"]),
    dish: (c) => c.pick({ "Gamay": "clams, squid, or shrimp with garlic and anchovy", "Cabernet Franc": "grilled lobster", "Montepulciano": "octopus stewed with tomatoes",
      "Barbera": "sauced seafood, especially in tomato" }) || "lobster or crab, or shellfish in a tomato, mushroom or soy sauce",
    why: "A light, low-tannin red works when the sauce or the lobster's richness bridges to it",
    warn: "not with raw oysters, plain shrimp or scallops, which the books list under avoid for red wine", src: "D&P ch. 5, “Lobster”, “Seafood”; Harrington p. 211" },
  { food: "Seafood", when: (c) => c.white && c.dry && c.body === "full",
    dish: () => "grilled shrimp, oyster stew or baked oysters in cream",
    why: "A buttery white matches rich, cooked shellfish",
    warn: "never with raw oysters: “oak is the biggest no-no” (Rebecca Charles)", src: "D&P ch. 5, “Shrimp”, “Oysters”; Harrington p. 70" },
  // ---- Red meat
  { food: "Red meat", when: (c) => c.sparkling && c.rose, dish: () => "rare roast beef or beef carpaccio",
    why: "A rosé sparkling suits beef “served the color of the Champagne, i.e., rare”", warn: "", src: "D&P ch. 5 and ch. 6, “Champagne: rosé”; Harrington p. 134" },
  { food: "Red meat", when: (c) => c.white && c.has(["Riesling"]) && !c.sweetish, dish: () => "steak tartare, or a roast-beef sandwich",
    why: "A high-acid Riesling cuts raw or cold beef, which “disproved the notion that red meat requires red wine”", warn: "not with a big grilled steak", src: "D&P preface and ch. 5, “Steak tartare”; Harrington p. 85" },
  { food: "Red meat", when: (c) => c.white && c.dry && c.body === "full" && c.has(["Chardonnay", "Viognier", "Marsanne / Roussanne"]),
    dish: (c) => c.pick({ "Viognier": "filet mignon with a citrus hollandaise", "Marsanne / Roussanne": "Asian- or Southwest-style beef with lime" }) || "steak with béarnaise, or veal",
    why: "A rich white can stand up to beef when a buttery or citrus sauce bridges them", warn: "not with plain steak: the books list Chardonnay as one to avoid with red meat", src: "D&P ch. 5, “Steak: with Béarnaise”; ch. 6, “Condrieu”" },
  // ---- Lamb
  { food: "Lamb", when: (c) => c.sparkling && c.rose, dish: () => "rare rack of lamb or noisettes, served pink",
    why: "Red fruit and bubbles suit delicate, rosy lamb", warn: "", src: "D&P ch. 6, “Champagne: rosé”; Fiona Beckett, Decanter 2026" },
  { food: "Lamb", when: (c) => c.rosé && c.dry, dish: () => "grilled lamb, baby lamb, or kebabs and souvlaki",
    why: "A dark, strong rosé works like a light red with grilled lamb", warn: "", src: "D&P ch. 5, “Lamb: baby”, “Lamb: kebabs”; Fiona Beckett, Decanter 2026" },
  { food: "Lamb", when: (c) => c.white && !c.sweetish && c.has(["Viognier", "Marsanne / Roussanne", "Assyrtiko", "Riesling", "Gewürztraminer", "Pinot Grigio / Gris"]),
    dish: (c) => c.pick({ "Viognier": "Moroccan lamb tagine or lamb korma", "Marsanne / Roussanne": "lamb tagine or navarin", "Assyrtiko": "garlic-and-herb grilled lamb, Greek style",
      "Riesling": "spiced lamb curry", "Gewürztraminer": "spiced lamb curry or tagine", "Pinot Grigio / Gris": "lamb kebabs and souvlaki" }),
    why: "Spices, citrus and herbs, not the meat, decide the wine, and a sharp or aromatic white can echo them", warn: "not with a plain roast leg", src: "D&P ch. 5, “Lamb: curry”, “Lamb: tagine”; Fiona Beckett, Decanter 2026" },
  // ---- Pork
  { food: "Pork", when: (c) => c.red && (c.tannic || (c.body === "full" && c.tannin === "firm")),
    dish: (c) => c.pick({ "Malbec": "cassoulet or a thick grilled pork chop", "Syrah / Shiraz": "slow-cooked pork belly or barbecued ribs", "Nebbiolo": "roast pork", "Aglianico": "grilled sausages",
      "Cabernet Sauvignon": "slow-roasted pork shoulder or barbecued ribs", "Tannat": "cassoulet" }) || "cassoulet, pork belly or barbecued ribs",
    why: "The fat tames the tannin and the tannin cuts the fat; of Cahors with cassoulet: “Together, they become a revelation” (Craig Shelton)",
    warn: "not with ham or prosciutto: salt makes tannin taste bitter", src: "D&P ch. 5, “Cassoulet”; Harrington p. 132, 172; Food & Wine 2017" },
  { food: "Pork", when: (c) => c.sparkling && !c.sweetish, dish: () => "a glazed pork roast with apples, or chorizo",
    why: "Bubbles and acidity cut the fat and lift the sweet glaze", warn: "", src: "Harrington p. 131; D&P ch. 5, “Sausage: chorizo”" },
  { food: "Pork", when: (c) => c.fortified && !c.sweetish, dish: () => "Spanish cured ham",
    why: "A dry fino or manzanilla sherry's salty tang mirrors the ham", warn: "", src: "D&P ch. 5, “Ham” and the sherry box" },
  // ---- Chicken
  { food: "Chicken", when: (c) => c.red && c.body !== "light" && c.has(["Zinfandel / Primitivo", "Syrah / Shiraz", "Cabernet Sauvignon", "Nebbiolo", "Tempranillo", "Grenache / Garnacha"]),
    dish: (c) => c.pick({ "Zinfandel / Primitivo": "tandoori or barbecued chicken, or Buffalo wings", "Syrah / Shiraz": "chicken tikka masala or barbecued chicken", "Cabernet Sauvignon": "paprika chicken or roast chicken",
      "Nebbiolo": "braised or stewed chicken", "Tempranillo": "roast chicken (a Rioja Reserva)", "Grenache / Garnacha": "chicken tikka masala" }),
    why: "Spice, smoke and a rich sauce give chicken enough weight for a bigger red", warn: "not with plain poached white meat, which can taste metallic", src: "D&P ch. 5, “Chicken”, “Tandoori” (Alpana Singh); ch. 6, “Bordeaux, red”" },
  { food: "Chicken", when: (c) => c.fortified && !c.sweetish, dish: () => "fried chicken",
    why: "Dry sherry cleanses the palate and its salty tang mirrors the fried crust: “It's a staggering match” (Paul Grieco)", warn: "", src: "D&P ch. 5, “Chicken: fried”" },
  // ---- Pasta and pizza
  { food: "Pasta and pizza", when: (c) => c.sparkling && !c.sweetish, dish: () => "pizza, especially white pizza, and creamy pasta",
    why: "In Naples white pizza goes with “all things with bubbles”, and bubbles cut cream and cheese", warn: "", src: "D&P ch. 5, “Pizza” (Scicolone), “Pasta: cream sauce”; Food & Wine 2017" },
  { food: "Pasta and pizza", when: (c) => c.red && (c.tannic || (c.body === "full" && c.tannin === "firm")),
    dish: (c) => c.pick({ "Corvina (Amarone, Valpolicella)": "spaghetti carbonara", "Syrah / Shiraz": "sausage pizza", "Malbec": "mushroom-and-sausage pizza", "Aglianico": "lamb ragù",
      "Nebbiolo": "pasta with truffle butter", "Cabernet Sauvignon": "deep-dish or meaty pizza" }) || "deep-dish pizza or pasta with a rich meat ragù",
    why: "A big red needs a big dish: meat, cheese and fat to soften its tannin",
    warn: "not with sweet tomato sauce or sweet takeaway pizza: “I think it is the worst pairing” (Greg Harrington, of Chianti with American pizza)", src: "D&P ch. 5, “Pizza”, “Pasta”; Majestic" },
  { food: "Pasta and pizza", when: (c) => c.white && c.body === "light" && c.has(["Riesling"]), dish: () => "pasta with cheese or cream sauce",
    why: "A Kabinett's acidity and touch of sweetness cut the richness", warn: "", src: "D&P ch. 5, “Pasta”" },
  // ---- Cheese
  { food: "Cheese", when: (c) => c.red && c.has(["Gamay", "Dolcetto", "Barbera", "Zweigelt", "Blaufränkisch"]) && c.body !== "full",
    dish: () => "a charcuterie-and-cheese plate with Reblochon, Camembert or aged sheep's cheese",
    why: "Low tannin doesn't fight the cheese the way a big red does", warn: "", src: "D&P ch. 8 (Johnnes); ch. 5, “Cheese: Brie”" },
  // ---- Spicy food
  { food: "Spicy food", when: (c) => c.red && c.dry && c.body !== "light" && c.has(["Syrah / Shiraz", "Malbec", "Tempranillo", "Merlot", "Cabernet Sauvignon", "Barbera", "Sangiovese"]),
    dish: (c) => c.pick({ "Syrah / Shiraz": "Indian food, or dishes with ancho chiles", "Malbec": "dishes with chipotle", "Tempranillo": "dishes with chipotle or other dried chiles",
      "Merlot": "spicier Indian curries with meat", "Cabernet Sauvignon": "goat or lamb curry, or black-pepper steak", "Barbera": "dishes with pasilla chiles", "Sangiovese": "dishes with pasilla chiles" }),
    why: "Warm spices and dried chiles echo a red's spice: “dried chiles work best with reds” (Jill Gubesch)",
    warn: "keep the heat mild: “tannin and alcohol amplify the heat” (Lirette)", src: "D&P ch. 5, “Chiles”, “Indian”; InsideHook (Crandon); Harrington p. 198, 200" },
  { food: "Spicy food", when: (c) => c.sparkling && !c.sweetish, dish: () => "spicy Mexican, Chinese or Indian food",
    why: "“For spice, I like bubbles” (David Rosengarten): bubbles refresh, and a bolder sparkling stands up to heat", warn: "a Cava or a bold sparkling rather than a delicate Champagne",
    src: "D&P ch. 5, “Mexican”; ch. 6, “Sparkling wine”" },
  { food: "Spicy food", when: (c) => c.white && c.dry && c.body === "full", dish: () => "coconut curries and spicier Cajun dishes",
    why: "A fruit-forward New World white has the body for rich, spiced sauces", warn: "keep the heat moderate", src: "Harrington p. 191; D&P ch. 5, “Curries”, “Thai”" },
  // ---- Dessert
  { food: "Dessert", when: (c) => c.red && c.dry && c.body === "full" && c.has(["Cabernet Sauvignon"]), dish: () => "bittersweet dark chocolate",
    why: "Harrington finds bittersweet chocolate and Cabernet a pleasant match, when the chocolate is no sweeter than the wine",
    warn: "disputed: “The idea that red wine and chocolate go together disturbs me” (Joseph Spellman)", src: "Harrington p. 155; D&P ch. 5, “Chocolate”" },
  { food: "Dessert", when: (c) => c.red && c.dry && c.has(["Zinfandel / Primitivo"]) && c.abv >= 15, dish: () => "80% bittersweet chocolate",
    why: "A big, ripe Zinfandel has the body and sweetness of fruit to stand up to dark chocolate", warn: "not milk chocolate", src: "St. Louis Magazine (John Sears); D&P ch. 4 (Alevras)" },
  { food: "Dessert", when: (c) => c.red && c.dry && c.body !== "full" && c.has(["Gamay", "Pinot Noir", "Cabernet Franc"]), dish: () => "strawberries, raspberries or berry desserts that aren't very sweet",
    why: "A fruity red echoes the berries", warn: "", src: "Harrington p. 298, 299; D&P ch. 5, “Berries”, “Strawberries”" },
  { food: "Dessert", when: (c) => c.sparkling && !c.sweetish, dish: () => "coffee and nut desserts, or anything not very sweet",
    why: "Dry bubbles work only when the dessert is less sweet than the wine", warn: "never wedding cake: “is horrifying!” (Madeline Triffon)", src: "D&P ch. 5, “Coffee desserts”, “Cake”; Harrington p. 301" },
  { food: "Dessert", when: (c) => c.white && c.dry && c.body === "full" && c.has(["Chardonnay"]), dish: () => "cheesecake",
    why: "“With cheesecake, you want a big, buttery California Chardonnay” (David Rosengarten)", warn: "", src: "D&P ch. 5, “Cheesecake”" },
];
function advContext(w) {
  const s = wineStyle(w), gs = grapesOf(w).filter((g) => grapeFits(w, g)), sweet = s.sweet.v, t = w.type;
  const name = fold([w.name, w.region_or_grape].filter(Boolean).join(" "));
  return {
    body: s.body.v, tannin: s.tannin.v, abv: w.abv || 0, sweetish: sweet === "sweet" || sweet === "medium-sweet", dry: sweet !== "sweet" && sweet !== "medium-sweet",
    red: t === "Red", white: t === "White", rosé: t === "Rosé", sparkling: t === "Sparkling", fortified: t === "Fortified",
    rose: /\bros(e|é)\b/.test(name), tannic: gs.some((g) => TANNIC_GRAPES.includes(g)),
    has: (list) => gs.some((g) => list.includes(g)), pick: (map) => { const g = gs.find((x) => map[x]); return g ? map[g] : null; },
  };
}
function advAdvice(w, rule) {
  const c = advContext(w);
  const dish = ruleDish(w, rule.food) || rule.dish(c);
  return `${pairSentence(w, rule.food, dish)} ${rule.why}${rule.warn ? `; ${rule.warn}` : ""}. (${rule.src})`;
}
function boldFoodsOf(w) {
  const k = `${ratingsVer}|${ratedNamesVer}|${storeListsKey()}`;
  if (w._bold && w._boldKey === k) return w._bold;
  const c = advContext(w), classic = foodsOf(w), out = [];
  for (const rule of ADV_RULES) {
    if (classic.includes(rule.food) || out.some((b) => b.food === rule.food) || sweetOnly(w, rule.food) && rule.food !== "Dessert") continue;
    if (rule.when(c) && rule.dish(c)) out.push({ food: rule.food, rule, get advice() { return advAdvice(w, rule); } });
  }
  w._boldKey = k;
  return (w._bold = out);
}
// What a classic match is best with, for this kind of wine. Fish and seafood follow Wine
// Folly's fish guide (zesty whites for delicate fish, richer whites for richer fish and
// sauces, dry rosé with meaty fish, sparkling with raw fish and fish tacos); steak and tannin
// follows Wine Spectator's Dr. Vinny; spice and alcohol, and white wine with tomato sauce,
// follow VinePair. The rest is everyday pairing advice, not quoted from anyone.
// ---- Pairing sentences, built from each wine's own details --------------------------------
// Every tag names the wine (its region or style, else its grape), describes it from what we
// know about it (body, tannin, sweetness with the store's own figure, alcohol, fruit), says
// what it suits (the grape's dishes, else dishes for its style) and why, and adds a serving
// tip where one applies. So two wines only read the same when they really are alike.
const PLAIN_GRAPE = (g) => g.replace(/ \(.*\)$/, "").split(" / ")[0];
// "this Copper Moon Merlot", "this Bierzo from Alvaro Palacios", "this Masi Modello Merlot".
// BC writes names as "Region - Producer" or "Producer - Grape"; the side that names a grape or
// a region is the style, the other side the producer. When it can't tell, just the grape.
const NO_YEAR = (x) => String(x || "").replace(/\(repack\)/gi, "").replace(/(?<!\d)(19|20)\d\d(?!\d)/g, " ").replace(/\b(VQA|DOC|DOCG|AOC|AC|IGT)\b/g, "").replace(/\s+/g, " ").trim();
const namesStyle = (x) => {
  const t = fold(x);
  return GRAPES.some(([, re]) => re.test(t)) || RED_STYLE.some(([re]) => re.test(t)) || WHITE_STYLE.some(([re]) => re.test(t));
};
function wineIdentity(w) {
  const name = NO_YEAR(w.name), dash = name.indexOf(" - ");
  const grape = grapesOf(w).find((x) => grapeFits(w, x));
  const plainGrape = grape ? PLAIN_GRAPE(grape) : String(w.type || "wine").toLowerCase();
  if (dash > 1) {
    const left = name.slice(0, dash).trim(), right = name.slice(dash + 3).trim();
    const onlyGrape = (x) => { const t = nameTokens(x); return t.length > 0 && t.every((y) => GRAPE_WORDS.has(y)); };
    if (onlyGrape(left)) return `this ${right} ${left}`;             // "Merlot - Duckhorn Napa"
    if (onlyGrape(right) || (namesStyle(right) && !namesStyle(left))) return `this ${left} ${right}`; // "Copper Moon - Merlot"
    if (namesStyle(left)) return `this ${left} from ${right}`;       // "Bierzo - Descendientes De J Palacios"
    return `this ${plainGrape}`;
  }
  // other stores give the full name: use it when it's short enough to read
  return name && name.length <= 45 ? `this ${name}` : `this ${plainGrape}`;
}
function wineLook(w) {
  const s = wineStyle(w), bits = [];
  if (s.body.v) bits.push(s.body.v === "full" ? "full-bodied" : s.body.v === "medium" ? "medium-bodied" : "light");
  if (w.type === "Red" && (s.tannin.v === "soft" || s.tannin.v === "firm")) bits.push(s.tannin.v);
  if (s.sweet.v && s.sweet.v !== "dry") bits.push(s.sweet.v);
  if (s.fruity.v) bits.push("fruit-forward");
  const kind = { Red: "red", White: "white", "Rosé": "rosé", Sparkling: "sparkling wine", Dessert: "dessert wine", Fortified: "fortified wine" }[w.type] || "wine";
  const words = [...bits, kind].join(bits.length > 1 ? ", " : " ").replace(/, (red|white|rosé|sparkling wine|dessert wine|fortified wine|wine)$/, " $1");
  return `${/^[aeiou]/i.test(words) ? "an" : "a"} ${words}`;
}
// Dishes chosen by grape together with region and body, so a Marlborough Sauvignon and a
// Sancerre, or a Chablis and a buttery California Chardonnay, get different advice. Each rule:
// [food, grape, region words or null, body ("light"/"medium"/"full"/"notlight") or null, dish].
// The first rule that fits wins; otherwise the grape's own line, then the style's. Everyday
// pairing knowledge, not quoted from any source.
const DISH_RULES = [
  // fish: whites
  ["Fish", "Chardonnay", /\b(chablis|macon|petit chablis)\b/, null, "oysters, sole or a delicate white fish with lemon butter"],
  ["Fish", "Chardonnay", /\b(burgundy|bourgogne|meursault|puligny|chassagne|beaune)\b/, null, "sole meunière or halibut in a light butter sauce"],
  ["Fish", "Chardonnay", null, "light", "sole, trout or a delicate white fish with lemon butter"],
  ["Fish", "Chardonnay", /\b(california|napa|sonoma|australia|chile|argentina|south africa)\b/, "full", "salmon or halibut in a cream sauce, or crab cakes"],
  ["Fish", "Chardonnay", null, "full", "salmon in a cream sauce, or lobster"],
  ["Fish", "Chardonnay", null, null, "cod or halibut with a butter sauce"],
  ["Fish", "Sauvignon Blanc", /\b(marlborough|new zealand|awatere)\b/, null, "shellfish, ceviche or Thai fish cakes"],
  ["Fish", "Sauvignon Blanc", /\b(sancerre|pouilly|loire|touraine|menetou)\b/, null, "trout or pike with herbs, or a goat-cheese starter"],
  ["Fish", "Sauvignon Blanc", /\b(bordeaux|graves|pessac|entre.deux.mers)\b/, null, "grilled sea bass or a seafood salad"],
  ["Fish", "Sauvignon Blanc", /\b(chile|casablanca|leyda|south africa|western cape|elgin)\b/, null, "grilled fish tacos or fish with salsa verde"],
  ["Fish", "Sauvignon Blanc", /\b(california|napa|fume)\b/, null, "grilled halibut or swordfish"],
  ["Fish", "Riesling", /\b(mosel|rheingau|pfalz|nahe|germany|kabinett|spatlese)\b/, null, "smoked trout or pickled herring"],
  ["Fish", "Riesling", /\b(alsace|austria|wachau)\b/, null, "pan-fried trout or fish in a cream sauce"],
  ["Fish", "Riesling", /\b(clare|eden|australia)\b/, null, "seafood with lime, or Thai fish"],
  ["Fish", "Riesling", /\b(niagara|ontario|okanagan|british columbia|finger lakes|washington)\b/, null, "pan-fried pickerel or trout"],
  ["Fish", "Pinot Grigio / Gris", /\b(italy|veneto|friuli|alto adige|delle venezie|trentino)\b/, null, "fritto misto or grilled sea bass"],
  ["Fish", "Pinot Grigio / Gris", /\b(alsace|oregon|okanagan|new zealand)\b/, null, "salmon or a richer white fish"],
  ["Fish", "Albariño", null, null, "octopus, grilled sardines or seafood rice"],
  ["Fish", "Grüner Veltliner", null, null, "fried fish, schnitzel-style, or trout"],
  ["Fish", "Chenin Blanc", /\b(vouvray|loire|savennieres|saumur|montlouis)\b/, null, "pike or river fish in a cream sauce"],
  ["Fish", "Chenin Blanc", /\b(south africa|swartland|stellenbosch|western cape)\b/, null, "grilled fish with a little spice"],
  ["Fish", "Viognier", null, null, "lobster, monkfish or a fish curry"],
  ["Fish", "Glera (Prosecco)", null, null, "fried calamari and fish and chips"],
  // fish: reds (adventurous)
  ["Fish", "Pinot Noir", /\b(oregon|willamette|burgundy|bourgogne|sonoma coast)\b/, null, "salmon with mushrooms"],
  ["Fish", "Pinot Noir", /\b(new zealand|central otago|marlborough|martinborough)\b/, null, "seared tuna or salmon"],
  ["Fish", "Pinot Noir", /\b(california|chile|australia|south africa)\b/, null, "barbecued or cedar-plank salmon"],
  ["Fish", "Gamay", null, null, "cod or a tuna niçoise, lightly chilled"],
  ["Fish", "Merlot", /\b(okanagan|british columbia|bordeaux|ontario|niagara)\b/, null, "grilled salmon with herbs"],
  ["Fish", "Merlot", null, null, "barbecued salmon with a sweet glaze"],
  // red meat: reds
  ["Red meat", "Cabernet Sauvignon", /\b(napa|sonoma|california|paso robles)\b/, null, "a ribeye or prime rib"],
  ["Red meat", "Cabernet Sauvignon", /\b(bordeaux|pauillac|margaux|medoc|saint.julien|st.julien|saint.estephe|pessac)\b/, null, "roast beef or a rack of lamb"],
  ["Red meat", "Cabernet Sauvignon", /\b(chile|maipo|colchagua|australia|coonawarra|argentina|south africa)\b/, null, "barbecued steak"],
  ["Red meat", "Cabernet Sauvignon", /\b(okanagan|british columbia|washington|columbia valley|niagara)\b/, null, "grilled striploin"],
  ["Red meat", "Malbec", /\b(argentina|mendoza|uco|salta)\b/, null, "grilled steak with chimichurri"],
  ["Red meat", "Malbec", /\b(cahors|france)\b/, null, "beef stew or duck"],
  ["Red meat", "Syrah / Shiraz", /\b(rhone|hermitage|crozes|cornas|cote.rotie|saint.joseph|st.joseph)\b/, null, "peppered steak or venison"],
  ["Red meat", "Syrah / Shiraz", /\b(australia|barossa|mclaren|south australia)\b/, null, "barbecued brisket or ribs"],
  ["Red meat", "Syrah / Shiraz", /\b(washington|okanagan|british columbia|california)\b/, null, "grilled flank steak with pepper"],
  ["Red meat", "Sangiovese", /\b(brunello|montalcino)\b/, null, "a Florentine T-bone"],
  ["Red meat", "Sangiovese", /\b(chianti)\b/, null, "meatballs in tomato sauce or a grilled steak"],
  ["Red meat", "Tempranillo", /\b(rioja)\b/, null, "roast lamb or beef, and chorizo"],
  ["Red meat", "Tempranillo", /\b(ribera|toro)\b/, null, "grilled steak or roast beef"],
  ["Red meat", "Nebbiolo", null, null, "braised beef, osso buco, or anything with mushrooms or truffle"],
  ["Red meat", "Grenache / Garnacha", /\b(chateauneuf|gigondas|vacqueyras|rhone)\b/, null, "beef daube or a rich stew"],
  ["Red meat", "Grenache / Garnacha", /\b(spain|priorat|campo de borja|calatayud)\b/, null, "grilled lamb or beef skewers"],
  ["Red meat", "Merlot", /\b(bordeaux|pomerol|saint.emilion|st.emilion)\b/, null, "roast beef or filet mignon"],
  ["Red meat", "Merlot", null, "notlight", "roast beef, meatloaf or burgers"],
  ["Red meat", "Zinfandel / Primitivo", null, null, "barbecue ribs, burgers or pulled beef"],
  // red meat: whites (adventurous)
  ["Red meat", "Chardonnay", /\b(california|napa|sonoma|australia)\b/, "full", "steak with béarnaise or creamed spinach"],
  ["Red meat", "Chardonnay", /\b(burgundy|bourgogne|meursault)\b/, null, "veal or a steak in a butter sauce"],
];
function ruleDish(w, food) {
  if (sweetOnly(w, food)) return null;
  const t = fold([w.name, w.region, w.region_or_grape, w.country].filter(Boolean).join(" ")), body = wineStyle(w).body.v;
  const gs = grapesOf(w).filter((g) => grapeFits(w, g));
  for (const [f, g, re, b, dish] of DISH_RULES) {
    if (f !== food || !gs.includes(g) || (re && !re.test(t))) continue;
    if (b && !(b === "notlight" ? body && body !== "light" : body === b)) continue;
    return dish;
  }
  return null;
}

// What this wine suits with a food, as a noun phrase: the grape's own dishes first.
function pairDish(w, food) {
  const rd = ruleDish(w, food);
  if (rd) return rd;
  const gl = grapeFoodLine(w, food);
  if (gl) return gl[1];
  const s = wineStyle(w), body = s.body.v, tannin = s.tannin.v, sweet = s.sweet.v, t = w.type;
  const sweetish = sweet === "sweet" || sweet === "medium-sweet";
  switch (food) {
    case "Fish":
      if (t === "Rosé") return "salmon, tuna and grilled or Mediterranean-style fish";
      if (t === "Sparkling") return "sushi, smoked salmon, fish tacos and fried fish";
      if (t === "Fortified") return "smoked or salted fish";
      if (t === "Red") return body === "light" ? "salmon, trout or seared tuna" : "meatier fish such as swordfish or barbecued salmon";
      return body === "light" ? "delicate white fish such as sole, haddock or sea bass, with lemon, herb or butter sauces"
        : "richer fish such as salmon, halibut or cod, with cream or butter sauces";
    case "Seafood": return t === "White" && body !== "light" ? "lobster, crab and scallops" : t === "Red" ? "crab, lobster and mussels" : "oysters, mussels, clams, shrimp and ceviche";
    case "Red meat":
      if (t === "White") return body === "full" ? "steak with butter or béarnaise, and veal" : "steak tartare";
      return body === "full" || tannin === "firm" ? "grilled or roast steak, prime rib and braises" : "burgers, meatloaf and stews";
    case "Lamb": return body === "full" ? "roast leg of lamb and lamb stew" : "grilled lamb chops";
    case "Pork": return t === "Red" ? (body === "light" ? "pork tenderloin, ham and sausages" : "roast pork, chops and ribs") : "roast pork, chops and ham";
    case "Chicken": return t === "Red" ? "roast chicken and chicken with mushrooms" : body === "full" ? "roast chicken and creamy chicken dishes" : "grilled chicken and lighter dishes with herbs or lemon";
    case "Pasta and pizza": return t === "Red" ? (body === "full" ? "pasta with meat sauce and lasagna" : "tomato pasta and pizza") : body === "full" ? "creamy pasta such as carbonara" : "pasta with seafood, pesto or tomato";
    case "Cheese": return sweetish || t === "Dessert" || t === "Fortified" ? "blue and strong, salty cheeses" : t === "Red" ? (body === "full" || tannin === "firm" ? "hard, aged cheeses such as Parmesan, aged Cheddar or Gouda" : "soft and washed-rind cheeses such as Brie or Reblochon")
      : t === "Sparkling" ? "Brie, Camembert and triple-crème cheeses" : body === "full" ? "creamy, nutty cheeses such as Brie or Comté" : "fresh goat cheese, feta and young cheeses";
    case "Spicy food": return sweetish || sweet === "off-dry" ? "Thai, Indian or Szechuan dishes" : "mildly spiced dishes";
    case "Dessert": return "desserts no sweeter than the wine";
    default: return "this kind of dish";
  }
}
// Facts about this particular wine that change the advice: its alcohol (BC and the LCBO give
// it), whether it comes from a warm or a cool place, and its measured sugar.
const WARM_PLACES = /\b(california|napa|sonoma|paso robles|lodi|australia|barossa|mclaren|argentina|mendoza|chile|south africa|spain|portugal|sicily|puglia|apulia|sardinia|rhone|languedoc|roussillon|washington|columbia valley|okanagan desert|israel|lebanon|greece)\b/;
const COOL_PLACES = /\b(burgundy|bourgogne|loire|alsace|champagne|germany|mosel|austria|new zealand|marlborough|central otago|ontario|niagara|prince edward county|oregon|willamette|tasmania|switzerland|okanagan|british columbia|nova scotia|england|chablis|beaujolais|piedmont|alto adige)\b/;
function climateOf(w) {
  const t = fold([w.name, w.region, w.region_or_grape, w.country].filter(Boolean).join(" "));
  if (COOL_PLACES.test(t)) return "cool";
  if (WARM_PLACES.test(t) || ["USA", "United States", "Australia", "Argentina", "Chile", "South Africa", "Spain", "Portugal"].includes(w.country)) return "warm";
  return null;
}
function wineFacts(w, food) {
  const s = wineStyle(w), abv = w.abv, sweet = s.sweet, t = w.type, climate = climateOf(w);
  const sugar = sweet.measured && /\d/.test(sweet.how) ? ` (${sweet.how})` : "";
  if (food === "Spicy food") {
    if (sweet.v && sweet.v !== "dry") return `its touch of sweetness${sugar} cools the heat`;
    if (abv >= 14) return `at ${abv}% alcohol it will make the heat seem stronger, so keep it to mild spice`;
    if (abv && abv <= 12.5) return `at a modest ${abv}% alcohol it won't fan the heat`;
  }
  if ((food === "Cheese" || food === "Dessert") && sweet.v && sweet.v !== "dry") return `its sweetness${sugar} suits ${food === "Cheese" ? "salty blue cheeses" : "a dessert no sweeter than it"}`;
  // what alcohol and place mean for this food
  const ripe = abv >= 14 || (climate === "warm" && !(abv && abv <= 12.5));
  const fresh = (abv && abv <= 12.5) || (climate === "cool" && !(abv >= 14));
  const pct = abv ? `at ${abv}% alcohol, ` : "";
  const place = climate === "warm" && ripe ? "warm-climate " : climate === "cool" && fresh ? "cool-climate " : "";
  if (food === "Fish" || food === "Seafood") {
    if (t === "White" && ripe) return `${pct}its ${place}riper fruit suits grilled or richer fish rather than delicate fillets`;
    if (t === "White" && fresh) return `${pct}its ${place}freshness suits delicate fish and lemon`;
    if (t === "Red" && ripe) return `${pct}a ${place}riper red: keep to meaty fish such as tuna or barbecued salmon`;
    if (t === "Red" && fresh) return `${pct}a ${place}lighter red, gentle enough for salmon or trout`;
  }
  if (food === "Red meat" || food === "Lamb") {
    if (abv >= 14) return `${pct}a ${place}ripe, powerful style for charred, richer cuts`;
    if (abv && abv <= 12.5) return `${pct}a lighter style, better with leaner cuts`;
    if (climate === "warm") return `${pct}a warm-climate, ripe style that suits the grill`;
    if (climate === "cool") return `${pct}a cool-climate, fresher style for simpler roasts`;
  }
  if (food === "Pork" || food === "Chicken") {
    if (ripe) return `${pct}its ${place}ripe fruit suits barbecue and sweet glazes`;
    if (fresh) return `${pct}its ${place}freshness suits herbs, lemon and simple roasts`;
  }
  if (food === "Pasta and pizza") {
    if (fresh) return `${pct}its ${place}freshness matches tomato's acidity`;
    if (ripe) return `${pct}a ${place}riper style for meaty sauces`;
  }
  return "";
}
const serveTip = (w) => (w.type === "Red" && wineStyle(w).body.v === "light" ? " Serve it slightly cool." : "");
const capFirst = (x) => x.charAt(0).toUpperCase() + x.slice(1);
// "This Copper Moon Merlot (a medium-bodied, soft red) suits grilled salmon with herbs; at 14%
// alcohol, a warm-climate, riper style: better with grilled… Serve it slightly cool."
// The price says what kind of meal it's for: an everyday bottle or a special one.
const PRICE_MEAL = {
  low: { "Fish": "fish tacos or fish and chips", "Seafood": "a shrimp or mussel supper", "Red meat": "burgers or a weeknight steak",
    "Lamb": "lamb burgers or kofta", "Pork": "sausages or pork chops", "Chicken": "a weeknight roast chicken", "Pasta and pizza": "pizza night",
    "Cheese": "a casual cheese plate", "Spicy food": "takeout curry or tacos", "Dessert": "a simple fruit dessert" },
  high: { "Fish": "a whole roast fish, halibut or lobster", "Seafood": "lobster or a seafood platter", "Red meat": "prime rib or a dry-aged steak",
    "Lamb": "a rack of lamb", "Pork": "a pork roast or porchetta", "Chicken": "a roast capon or coq au vin", "Pasta and pizza": "a special pasta such as truffle or lobster",
    "Cheese": "a fine aged cheese board", "Spicy food": "a special curry or Szechuan feast", "Dessert": "a special dessert" },
};
function priceNote(w, food, dish = "") {
  const p = priceOf(w);
  if (p == null) return "";
  if (p < 15) return dish.includes(PRICE_MEAL.low[food]) || dish === WEEKNIGHT_DISH[food] || dish === LEAN_DISH[food] ? " An easy weeknight bottle."
    : ` An easy weeknight bottle: think ${PRICE_MEAL.low[food] || "everyday meals"}.`;
  if (p >= 40) return GRAND_DISH.test(dish) ? " A special-occasion bottle." : ` A special-occasion bottle: worth ${PRICE_MEAL.high[food] || "a special dinner"}.`;
  return "";
}
// A dish that agrees with the wine: lighter or lower-alcohol wines get the leaner version of a
// meat dish, and an everyday bottle isn't pointed at prime rib or lobster.
const GRAND_DISH = /prime rib|ribeye|dry-aged|rack of lamb|lobster|halibut|filet mignon|florentine|t-bone|roast leg of lamb|whole roast/i;
const LEAN_DISH = { "Red meat": "flank steak, burgers or a beef stir-fry", "Lamb": "grilled lamb chops or kofta" };
const WEEKNIGHT_DISH = { "Red meat": "a weeknight steak, burgers or meatloaf", "Lamb": "lamb chops or lamb burgers",
  "Fish": "pan-fried fish, fish tacos or fish and chips", "Seafood": "shrimp, mussels or a seafood pasta" };
function fitDish(w, food, dish) {
  const body = wineStyle(w).body.v, light = (body && body !== "full") || (w.abv && w.abv <= 12.5);
  if (LEAN_DISH[food] && w.type === "Red" && light && GRAND_DISH.test(dish)) dish = LEAN_DISH[food];
  const p = priceOf(w);
  if (p != null && p < 15 && WEEKNIGHT_DISH[food] && GRAND_DISH.test(dish)) dish = WEEKNIGHT_DISH[food];
  return dish;
}
function pairSentence(w, food, dish) {
  dish = fitDish(w, food, dish);
  const fact = wineFacts(w, food);
  return `${capFirst(wineIdentity(w))} (${wineLook(w)}) suits ${dish}${fact ? `; ${fact}` : ""}.${priceNote(w, food, dish)}${serveTip(w)}`;
}

// The advice that holds for every wine with a food, shown once under Food (not on each card).
// Red with fish: Fiona Beckett; steak and tannin: Wine Spectator; spice and alcohol: VinePair;
// shellfish and iron: the 2009 study reported by Phys.org.
// One short line from the experts quoted in Dornenburg & Page, per food (checked word for word).
const FOOD_QUOTES = {
  "Fish": ["Tuna, which is a steak like fish, lends itself to red wine", "Michael Flynn"],
  "Seafood": ["it will taste like it is out of a can", "Bernard Sun, on red wine with delicate shellfish"],
  "Red meat": ["disproved the notion that red meat requires red wine", "Dornenburg & Page, on German Riesling with beef tartare"],
  "Lamb": ["served the color of the Champagne, i.e., rare", "Dornenburg & Page, on rosé Champagne with lamb"],
  "Pork": ["Together, they become a revelation.", "Craig Shelton, on Cahors with cassoulet"],
  "Chicken": ["It's a staggering match.", "Paul Grieco, on dry sherry with fried chicken"],
  "Pasta and pizza": ["I think it is the worst pairing", "Greg Harrington, on Chianti with sweet American pizza"],
  "Cheese": ["Tannins often clash with cheeses, so red wines are less successful", "Max McCalman"],
  "Spicy food": ["For spice, I like bubbles", "David Rosengarten"],
  "Dessert": ["The idea that red wine and chocolate go together disturbs me.", "Joseph Spellman, master sommelier"],
};
const FOOD_GUIDE = {
  "Fish": "Whites: crisp, light ones for delicate fish and lemon or herb sauces, fuller ones for salmon, halibut and cream sauces. Reds with fish: light, soft ones, best when the fish is seared, grilled or barbecued, or has a spicy crust; poached fish and butter sauces usually call for a white.",
  "Seafood": "Crisp whites and sparkling for oysters, mussels and shrimp; fuller whites for lobster and crab. A 2009 study found some reds can leave a fishy aftertaste with shellfish, depending on the wine's iron, so a red here is an experiment.",
  "Red meat": "The fat in the meat smooths out a red's firm tannins, so bigger reds suit richer cuts and softer reds leaner ones. A full, oaky white also has the weight for steak, especially with butter or béarnaise.",
  "Lamb": "Fuller reds for roasts and stews, softer, fruitier ones for grilled chops with herbs.",
  "Pork": "Pork goes both ways. Riesling is the classic white (with choucroute, sausages and roast pork) and Pinot Noir or Beaujolais the classic reds; fruitier reds for barbecue and sweet glazes, fuller whites for creamy sauces.",
  "Chicken": "Match the sauce more than the bird: light whites for herbs and lemon, fuller whites for cream, light reds for mushrooms or roast chicken.",
  "Pasta and pizza": "Tomato sauces want acidity: a juicy red or a crisp white. Creamy sauces suit a fuller white; meat sauces a fuller red.",
  "Cheese": "Whites are the safer choice with most cheeses: tasters in Harrington's research rated them closest to an ideal match, and tannin often clashes. Crisp whites for goat cheese, Champagne for Brie and triple-crème, Riesling or Gewürztraminer for washed-rind and blue. Big reds for hard, aged cheeses such as Parmesan or aged Cheddar; something sweet for blue.",
  "Spicy food": "A touch of sweetness cools the heat, and high alcohol makes it seem hotter, so off-dry and lower-alcohol wines do best.",
  "Dessert": "The wine should be at least as sweet as the dessert.",
};

// The book's dishes for this wine's grape and food, up to three, leaving out what the sentence
// already names; a lighter wine leans to grilled, poached and cold dishes, a fuller one to
// braised, roasted and stewed ones, so two wines of a grape needn't get the same three.
const LIGHT_COOK = /\b(poached|grilled|cold|lean|lighter|light|raw|sauteed|steamed|tartare|carpaccio|simple)\b/;
const RICH_COOK = /\b(braised|roasted|roast|stewed|rich|fuller|barbecued|cream|smoked|aged|strong)\b/;
function bookDishes(w, food, main = "") {
  if (sweetOnly(w, food)) return null;
  const g = grapesOf(w).find((x) => grapeFits(w, x) && BOOK_DISHES[x]?.[food]);
  if (!g) return null;
  const body = wineStyle(w).body.v, want = body === "light" ? LIGHT_COOK : body === "full" ? RICH_COOK : null, said = fold(main);
  const list = BOOK_DISHES[g][food]
    .filter(([d]) => !said.includes(fold(d).split(/,| \(/)[0].replace(/^(grilled|roasted|braised|cold) /, "")))
    .map(([d, lvl], i) => ({ d, lvl, sc: lvl * 2 + (want && want.test(fold(d)) ? 1 : 0) - i / 100 }))
    .sort((a, b) => b.sc - a.sc).slice(0, 3);
  return list.length ? { g, list } : null;
}
function bookLine(w, food, main) {
  const b = bookDishes(w, food, main);
  if (!b) {
    const g = grapesOf(w).find((x) => grapeFits(w, x) && BOOK_DISHES[x]?.[food]);
    const cl = g && !sweetOnly(w, food) && BOOK_DISHES[g][food].find(([, lvl]) => lvl === 4);
    return cl ? ` Dornenburg & Page's pairing guide marks ${cl[0].split(/,| \(/)[0]} as a classic with ${PLAIN_GRAPE(g)}.` : "";
  }
  const names = b.list.map((x) => x.d), classic = b.list.find((x) => x.lvl === 4);
  const join = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return ` Dornenburg & Page's pairing guide lists ${PLAIN_GRAPE(b.g)} with ${join}${classic ? `, marking ${classic.d.split(/,| \(/)[0]} as a classic` : ""}.`;
}
function classicAdvice(w, food) { const d = pairDish(w, food); return pairSentence(w, food, d) + bookLine(w, food, d); }

function foodMatchScore(w) {
  if (!state.food.size) return null;
  let best = null;
  const said = storeFoods(w), cl = claudeFoods(w), bold = state.foodBold ? boldFoodsOf(w).map((b) => b.food) : [];
  for (const f of state.food) {
    const sc = said.has(f) || cl.has(f) ? 4 : grapeFoodLine(w, f) ? 3 : foodsOf(w).includes(f) ? 2 : bold.includes(f) ? 1 : null;
    if (sc != null && (best == null || sc > best)) best = sc;
  }
  return best;
}

// The badge on a card for each food ticked: a classic match (the usual recommendation), or,
// with adventurous pairings included, an adventurous one with its advice.
function boldAdviceHtml(w) {
  if (!state.food.size) return "";
  const classic = foodsOf(w).filter((f) => state.food.has(f));
  const bold = state.foodBold ? boldFoodsOf(w).filter((b) => state.food.has(b.food)) : [];
  const said = lcboFoodNote(w), saysTicked = [...storeFoods(w)].some((f) => state.food.has(f));
  // the classic lines and the store's own note share one purple paragraph, to save room
  // a match that rests only on the store's own note is described by that note alone
  const ownLine = (f) => grapeFoodLine(w, f) || (w._styleFoods || []).includes(f);
  // each box shows only its heading; the write-up opens on a click, to keep the card short
  const own = classic.filter(ownLine), many = own.length > 1;
  const classicBits = [...own.map((f) => `${many ? `<strong>With ${esc(f.toLowerCase())}:</strong> ` : ""}${esc(classicAdvice(w, f))}`),
    ...(said && saysTicked ? [`<strong>The LCBO's note${w.source === "LCBO" ? "" : " for this wine"}:</strong> “${esc(said)}”`] : []),
    ...(claudePair(w) ? [`<strong>Claude's pick for this wine (from its research):</strong> ${esc(claudePair(w))}.`] : [])];
  const tierOf = (f) => wineTier(w, f);
  const title = own.length === 1 ? `${STARS(tierOf(own[0]))} Classic pairing with ${own[0].toLowerCase()}${tierOf(own[0]) === 1 ? " (pairs, but less often chosen)" : ""}`
    : own.length ? `Classic pairings: ${own.map((f) => `${f.toLowerCase()} ${STARS(tierOf(f))}`).join(" · ")}` : "Pairing notes for this wine";
  const more = `<span class="pair-more" aria-hidden="true"></span>`;
  return (classicBits.length ? `<details class="classic-pair"><summary><svg class="pair-icon" aria-hidden="true"><use href="#i-dine"/></svg> <strong>${esc(title)}</strong>${more}</summary>${classicBits.join(" ")}</details>` : "") +
    bold.map((b) => `<details class="bold-pair"><summary>🍷 <strong>Adventurous pairing with ${esc(b.food.toLowerCase())}</strong>${more}</summary>${esc(b.advice)}</details>`).join("");
}

// Tick lists with counts, like Country: each counts wines with the other choices applied.
function tickCounts(skip, valuesOf) {
  const counts = new Map();
  for (const w of findPool()) if (matches(w, skip)) for (const v of valuesOf(w)) counts.set(v, (counts.get(v) || 0) + 1);
  return counts;
}
// What each grape tastes like, in plain words, for anyone who doesn't know their grapes.
const GRAPE_INFO = {
  "Cabernet Sauvignon": "full-bodied, blackcurrant and cedar, firm tannins; ages well",
  "Merlot": "medium to full, plum and chocolate, soft and smooth",
  "Cabernet Franc": "medium-bodied, red berries, pepper and herbs",
  "Pinot Noir": "light, cherry and raspberry, silky, gentle tannins",
  "Gamay": "light and juicy, strawberry and cherry, very soft (Beaujolais)",
  "Syrah / Shiraz": "full-bodied, blackberry and pepper; riper and softer as Australian Shiraz",
  "Grenache / Garnacha": "full and warm, ripe strawberry and spice, soft tannins",
  "Tempranillo": "medium to full, cherry, leather and vanilla (Rioja, Ribera del Duero)",
  "Sangiovese": "medium-bodied, sour cherry and herbs, lively, firm (Chianti, Brunello)",
  "Nebbiolo": "full, rose and tar, high tannin; needs age (Barolo, Barbaresco)",
  "Montepulciano": "medium, dark cherry, soft and easy (Montepulciano d'Abruzzo)",
  "Corvina (Amarone, Valpolicella)": "from light and cherry (Valpolicella) to rich and raisined (Amarone)",
  "Malbec": "full-bodied, plum and blackberry, soft tannins (Argentina)",
  "Zinfandel / Primitivo": "full, jammy blackberry and spice, soft",
  "Touriga Nacional": "full, dark fruit and violets, firm (Portugal's Douro and Dão)",
  "Carmenère": "medium to full, dark fruit with a green-pepper note, soft (Chile)",
  "Pinotage": "full, smoky dark fruit (South Africa)",
  "Tannat": "very full, dark fruit, very firm tannins (Uruguay, Madiran)",
  "Mourvèdre / Monastrell": "full, dark fruit and earth, firm",
  "Barbera": "medium, bright cherry, juicy, low tannin",
  "Dolcetto": "light to medium, black cherry and almond, soft",
  "Aglianico": "full, dark fruit and smoke, firm (southern Italy)",
  "Nero d'Avola": "full, ripe plum, soft (Sicily)",
  "Petite Sirah": "very full and inky, blueberry, firm",
  "Petit Verdot": "full, dark and floral, firm; usually blended",
  "Carignan": "medium to full, dark fruit and spice, rustic",
  "Mencía": "medium, red fruit and floral, fresh (Spain's Bierzo)",
  "Blaufränkisch": "medium, dark cherry and spice, lively (Austria)",
  "Zweigelt": "light to medium, cherry, soft (Austria)",
  "Saperavi": "full, dark fruit, firm (Georgia)",
  "Xinomavro": "medium, sour cherry and tomato leaf, firm (Greece; like Nebbiolo)",
  "Agiorgitiko": "medium to full, plum and spice, soft (Greece)",
  "Chardonnay": "from crisp and lemony (Chablis) to rich, buttery and oaky",
  "Sauvignon Blanc": "light and zesty, citrus, gooseberry and fresh herbs",
  "Riesling": "aromatic, lime and peach, high acidity; bone dry to sweet",
  "Pinot Grigio / Gris": "light and crisp (Grigio) to rounder and spicier (Gris)",
  "Gewürztraminer": "full and perfumed, lychee and rose, often off-dry",
  "Chenin Blanc": "apple and honey, dry to sweet (Vouvray)",
  "Viognier": "full, apricot and blossom, soft",
  "Grüner Veltliner": "light to medium, green apple and white pepper (Austria)",
  "Albariño": "light and fresh, citrus and sea-salt (Spain, Portugal)",
  "Sémillon": "waxy and lemony when dry; honeyed in Sauternes",
  "Muscat / Moscato": "grapey and floral, usually sweet and light",
  "Vermentino": "light, citrus and herbs, crisp (Italy, southern France)",
  "Verdejo": "light, citrus and fennel (Rueda)",
  "Godello": "medium, pear and mineral (Spain)",
  "Chasselas": "light, delicate, mineral (Switzerland)",
  "Garganega (Soave)": "light to medium, almond and lemon",
  "Cortese (Gavi)": "light and crisp, lime and green apple",
  "Pinot Blanc": "light to medium, apple, soft and gentle",
  "Marsanne / Roussanne": "full, pear, honey and nuts (Rhône whites)",
  "Assyrtiko": "dry, lemon and mineral, very crisp (Santorini)",
  "Torrontés": "aromatic, floral and peachy, dry (Argentina)",
  "Fiano": "medium, pear and hazelnut (southern Italy)",
  "Furmint": "dry and crisp, or the sweet Tokaji of Hungary",
  "Glera (Prosecco)": "light sparkling, pear and apple",
};
const grapeLabel = (g) => `<span class="sweet-name"><span>${esc(g)}` +
  `${foodTier.has(g) ? ` <span class="food-star tier-${foodTier.get(g)}" title="Classic for the food you ticked: ${TIER_WORDS[foodTier.get(g)]}">${STARS(foodTier.get(g))}</span>` : ""}` +
  `${foodAdv.has(g) ? ` <span class="food-adv" title="An adventurous grape for the food you ticked">🍷</span>` : ""}</span>` +
  `${GRAPE_INFO[g] ? `<small>${esc(GRAPE_INFO[g])}</small>` : ""}</span>`;
let foodTier = new Map(); // classic grapes for the ticked food, with their stars (1-3)
let foodAdv = new Set();  // grapes whose matches for the ticked food are mostly adventurous
function renderGrapes() {
  if (!$("grape-list")) return;
  const counts = tickCounts("grape", grapesOf), q = fold(state.grapeQ);
  const names = [...new Set([...counts.keys(), ...state.grapes])].filter((g) => !q || fold(g).includes(q))
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b));
  $("grape-list").innerHTML = names.length
    ? names.map((g) => { const c = counts.get(g) || 0; return checkbox("grape", g, state.grapes.has(g), grapeLabel(g), c, c ? "" : " zero"); }).join("")
    : `<p class="hint">No grape matches “${esc(state.grapeQ)}”.</p>`;
  // what the stars mean, right where they are
  const foods = [...state.food].map((f) => f.toLowerCase()).join(" or ");
  const inTier = (n) => [...foodTier].filter(([, t]) => t === n).length;
  const tierBtn = (n, label) => (inTier(n) ? `<button type="button" class="btn btn-mini" data-action="tick-tier" data-tier="${n}">Tick ${STARS(n)} ${label} (${inTier(n)})</button>` : "");
  $("grape-star-note").innerHTML = (foodTier.size || foodAdv.size) && !state.grapeOut
    ? `<strong>For ${esc(foods)}:</strong> <span class="food-star tier-3">★★★</span> the go-to · <span class="food-star tier-2">★★</span> a common match · ` +
      `<span class="food-star tier-1">★</span> pairs, but less often chosen` + (foodAdv.size ? ` · <span class="food-adv">🍷</span> adventurous` : "") +
      ` (stars from Dornenburg & Page's pairing guide). Tick any grapes you like, one or many.` +
      `<span class="mini-row">${tierBtn(3, "go-to grapes")}${tierBtn(2, "common grapes")}${tierBtn(1, "off-the-beaten-path grapes")}` +
      `${foodAdv.size ? `<button type="button" class="btn btn-mini" data-action="tick-adv">Tick 🍷 adventurous grapes (${foodAdv.size})</button>` : ""}` +
      `${state.grapes.size ? `<button type="button" class="btn btn-mini" data-action="untick-grapes">Untick all grapes (${state.grapes.size})</button>` : ""}</span>` : "";
  $("grape-star-note").hidden = !$("grape-star-note").innerHTML;
  $("grape-list").classList.toggle("leaving-out", state.grapeOut);
  $("grape-out").setAttribute("aria-pressed", String(state.grapeOut));
  $("grape-out").textContent = state.grapeOut ? "✓ Leaving out grapes" : "Leave out grapes";
  $("grape-all").hidden = state.grapeOut;
  $("grape-hint").textContent = state.grapeOut
    ? "Tick a grape to leave it out (it shows an ✕); every other grape is shown, and wines whose grape isn't known stay in. Press the button again to go back to choosing."
    : "From the store's grape list, the name, or the region (Barolo is Nebbiolo, Rioja is Tempranillo). A blend counts for each grape it names. Tick one or more.";
}
// Food doesn't choose grapes: it narrows the wines, and the grape counts follow. So with a
// food ticked, say which grapes those wines most often are (and star them in the grape list).
let hiddenTypes = new Set();
const TYPE_PLURAL = { Red: "reds", White: "whites", "Rosé": "rosés", Sparkling: "sparkling wines", Dessert: "dessert wines", Fortified: "fortified wines" };
function renderFood() {
  if (!$("food-list")) return;
  const counts = tickCounts("food", (w) => [...new Set([...foodsOf(w), ...(state.foodBold ? boldFoodsOf(w).map((b) => b.food) : [])])]);
  $("food-list").innerHTML = FOODS.map((f) => { const c = counts.get(f) || 0; return checkbox("food", f, state.food.has(f), esc(f), c, c ? "" : " zero"); }).join("");
  // Which grapes the wines for this food are, split into classic and adventurous matches:
  // ★ marks the most common classic grapes, 🍷 the grapes whose matches are mostly adventurous.
  foodTier = new Map();
  foodAdv = new Set();
  let line = "";
  if (state.food.size) {
    const classicN = new Map(), advN = new Map(), allN = new Map();
    const skipFood = { ...state, food: new Set() };
    for (const w of findPool()) {
      const fit = grapesOf(w).filter((g) => grapeFits(w, g) || w.type === "Rosé");
      if (fit.length && matches(w, "grape", skipFood)) for (const g of fit) allN.set(g, (allN.get(g) || 0) + 1);
      if (!matches(w, "grape")) continue;
      const classic = foodsOf(w).some((f) => state.food.has(f));
      for (const g of fit) { const m = classic ? classicN : advN; m.set(g, (m.get(g) || 0) + 1); }
    }
    // a grape gets stars only when a fair share of its wines match (not one store note out of
    // hundreds) and its matches aren't mostly adventurous ones
    for (const [g, n] of classicN) {
      const share = n / (allN.get(g) || n);
      if (share >= 0.05 && n >= (advN.get(g) || 0)) foodTier.set(g, grapeTier(g, state.food, share));
    }
    const byTier = (t) => [...classicN].filter(([g]) => foodTier.get(g) === t).sort((a, b) => b[1] - a[1]);
    const adv = state.foodBold ? [...advN].filter(([g, n]) => n > (classicN.get(g) || 0)).sort((a, b) => b[1] - a[1]) : [];
    foodAdv = new Set(adv.map(([g]) => g));
    const foods = [...state.food].map((f) => f.toLowerCase()).join(" or ");
    const list = (arr) => arr.map(([name, n]) => `<strong>${esc(name)}</strong> (${n.toLocaleString()})`).join(", ");
    const tierLine = (t, label) => { const xs = byTier(t); return xs.length ? `<span class="food-star tier-${t}">${STARS(t)}</span> <strong>${label}:</strong> ${list(xs.slice(0, 6))}${xs.length > 6 ? ` and ${xs.length - 6} more` : ""}.` : ""; };
    line = [tierLine(3, `Go-to grapes for ${esc(foods)}`), tierLine(2, "Common matches"), tierLine(1, "Pairs, but less often chosen")].filter(Boolean).join("<br>");
    if (adv.length) line += `<br><span class="food-adv">🍷</span> <strong>Adventurous grapes:</strong> ${list(adv.slice(0, 6))}.`;
    if (line) line += ` These are marked under Grape; ticking a food doesn't choose a grape for you.`;
  }
  // matches the colour choice hides, e.g. adventurous whites for steak while only Red is ticked
  hiddenTypes = new Set();
  if (state.food.size && state.types.size) {
    const n = new Map();
    for (const w of findPool()) if (!state.types.has(w.type) && matches(w, "type")) n.set(w.type, (n.get(w.type) || 0) + 1);
    if (n.size) {
      hiddenTypes = new Set(n.keys());
      const what = [...n].sort((a, b) => b[1] - a[1]).map(([t, k]) => `${k.toLocaleString()} ${esc(TYPE_PLURAL[t] || t.toLowerCase())}`).join(", ");
      line += `${line ? "<br>" : ""}<strong>Hidden by your colour choice:</strong> ${what} also go with ${esc([...state.food].join(" or ").toLowerCase())}${state.foodBold ? " (classic or adventurous)" : ""}. <button type="button" class="btn btn-mini" data-action="show-hidden-types">Show them too</button>`;
    }
  }
  const guide = [...state.food].map((f) => FOOD_GUIDE[f] ? `<br><strong>How to pair with ${esc(f.toLowerCase())}:</strong> ${esc(FOOD_GUIDE[f])}` +
    (FOOD_QUOTES[f] ? ` <em>“${esc(FOOD_QUOTES[f][0])}”</em> (${esc(FOOD_QUOTES[f][1])})` : "") : "").join("");
  $("food-note").innerHTML = line + guide;
  $("food-note").hidden = !$("food-note").innerHTML;
}

// Vintage and alcohol sliders: lowest and highest, the count changing as they move.
const VINT_SLIDE = { min: 1970, max: THIS_YEAR, step: 1 };
const ABV_SLIDE = { min: 5, max: 20, step: 0.5 };
function rangeHtml(id, conf, lo, hi, fmt) {
  return `<div class="price-slider side-slider">
    <label for="${id}-lo">From: <strong id="${id}-lo-v">${fmt(lo ?? conf.min, "lo")}</strong></label>
    <input type="range" id="${id}-lo" min="${conf.min}" max="${conf.max}" step="${conf.step}" value="${lo ?? conf.min}">
    <label for="${id}-hi">To: <strong id="${id}-hi-v">${fmt(hi ?? conf.max, "hi")}</strong></label>
    <input type="range" id="${id}-hi" min="${conf.min}" max="${conf.max}" step="${conf.step}" value="${hi ?? conf.max}">
    <p class="ps-count" id="${id}-count" aria-live="polite">${rangeCountText()}</p>
  </div>`;
}
const vintFmt = (v, end) => (end === "lo" && v <= VINT_SLIDE.min ? "any" : end === "hi" && v >= VINT_SLIDE.max ? "newest" : String(v));
const abvFmt = (v, end) => (end === "lo" && v <= ABV_SLIDE.min ? "any" : end === "hi" && v >= ABV_SLIDE.max ? "any" : `${v}%`);
function rangeCountText() {
  const n = findPool().reduce((k, w) => k + matches(w), 0);
  return `<strong>${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}</strong> with your choices`;
}
function renderRanges() {
  if ($("vint-range")) $("vint-range").innerHTML = rangeHtml("vs", VINT_SLIDE, state.vintFrom, state.vintTo, vintFmt);
  if ($("abv-range")) $("abv-range").innerHTML = rangeHtml("as", ABV_SLIDE, state.abvFrom, state.abvTo, abvFmt);
  if ($("old-only")) $("old-only").checked = state.oldOnly;
  if ($("food-bold")) $("food-bold").checked = state.foodBold;
}
let rangeFrame = 0;
function rangeSlide(id, which, done) {
  const conf = id === "vs" ? VINT_SLIDE : ABV_SLIDE, fmt = id === "vs" ? vintFmt : abvFmt;
  let lo = +$(`${id}-lo`).value, hi = +$(`${id}-hi`).value;
  if (lo > hi) { if (which === "lo") hi = lo; else lo = hi; $(`${id}-lo`).value = lo; $(`${id}-hi`).value = hi; }
  const [kFrom, kTo] = id === "vs" ? ["vintFrom", "vintTo"] : ["abvFrom", "abvTo"];
  state[kFrom] = lo > conf.min ? lo : null;
  state[kTo] = hi < conf.max ? hi : null;
  $(`${id}-lo-v`).textContent = fmt(lo, "lo");
  $(`${id}-hi-v`).textContent = fmt(hi, "hi");
  state.shown = PAGE_SIZE;
  if (done) { refresh(); return; }
  cancelAnimationFrame(rangeFrame);
  rangeFrame = requestAnimationFrame(() => { $(`${id}-count`).innerHTML = rangeCountText(); });
}

function renderTypes() {
  const counts = countBy("type", "type");
  $("type-list").innerHTML = TYPES
    .filter((t) => counts.has(t) || state.types.has(t))
    .map((t) => checkbox("type", t, state.types.has(t), typePill(t), counts.get(t) || 0))
    .join("");
}

// The side panel's sweetness boxes: the same four steps as "Find me a wine", with what
// each means in BC's code and the LCBO's grams of sugar, and how many wines each has.
const SWEET_DETAIL = { dry: "BC 0–1 · LCBO up to 4 g/L", "off-dry": "BC 2–4 · LCBO 4–12 g/L",
  "medium-sweet": "BC 5–7 · LCBO 12–45 g/L", sweet: "BC 8–10 · LCBO over 45 g/L" };
function renderSweet() {
  const c = lastFinderCounts?.sweetStyle;
  $("sweet-list").innerHTML = SWEET_LEVELS.map((v) => checkbox("sweetStyle", v, state.sweetStyle.has(v),
    `<span class="sweet-name">${SWEET_LABEL[v]}<small>${SWEET_DETAIL[v]}</small></span>`, c ? c.get(v) || 0 : null)).join("");
}

function syncInputs() {
  $("q").value = state.q;
  $("country-q").value = state.countryQ;
  $("not-rated").checked = state.notRated;
  $("bottle-only").checked = state.bottleOnly;
  renderSorts();
}

function filtersOnCount() {
  return state.countries.size + state.types.size + state.sweetStyle.size + state.grapes.size + state.food.size +
    (state.vintFrom != null || state.vintTo != null) + state.oldOnly + (state.abvFrom != null || state.abvTo != null) + (state.priceFrom != null) +
    (state.priceTo != null) + !!state.q + state.newOnly + !state.bottleOnly + !state.notRated;
}

// ---- Rendering: results --------------------------------------------------------

function cellarCard(w) {
  const on = shortlist.some((s) => s.id === w.id);
  const facts = [w.country !== "Country not stated" ? w.country : null, w.region_or_grape, w.varietal].filter(Boolean).map(esc).join(" · ");
  const scores = [w.my_score != null ? `${esc(w.owner)}'s score <strong>${w.my_score}</strong>` : null,
    w.ct_score != null ? `CellarTracker community <strong>${+w.ct_score.toFixed(1)}</strong>` : null,
    w.drink_from || w.drink_to ? esc(`Drink ${w.drink_from ?? "now"}–${w.drink_to ?? "?"}`) : null].filter(Boolean).join(" · ");
  return `<article class="wine wine-${esc(w.type)} wine-cellar${on ? " on-list" : ""}">
    <h3 class="wine-name">${esc(w.name)}</h3>
    <div class="wine-price wine-price-cellar">In ${esc(w.source)}</div>
    <p class="wine-facts">${typePill(w.type)} ${facts}</p>
    <p class="wine-detail"><span class="badge badge-cellar">${esc(w.source)}</span>${w.size_ml && w.size_ml !== 750 ? ` ${esc(sizeText(w))}` : ""} · ${esc(sweetText(w))}</p>
    ${scores ? `<p class="wine-detail mw-scores">${scores}</p>` : ""}${soldAtHtml(w)}${ratingsHtml(w)}${familyLinksHtml(w)}
    <div class="wine-actions">
      ${researchButton(w)}
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>
      ${quickMarkButton(w)}
      ${shoppingButton(w)}
      <button type="button" class="btn btn-ew" data-action="mw-where" data-id="${esc(w.id)}">Where can I buy it?</button>
      <a class="btn ext btn-ct" href="${cellarTrackerUrl(w)}" target="_blank" rel="noopener">CellarTracker</a>
      <a class="btn ext btn-we" href="${wineEnthusiastUrl(w)}" target="_blank" rel="noopener">Wine Enthusiast</a>
      <a class="btn ext btn-vivino" href="${vivinoUrl(w)}" target="_blank" rel="noopener">Vivino</a>
      ${rateButton(w)}
    </div>
  </article>`;
}

function wineCard(w) {
  if (w.kind === "cellar") return cellarCard(w);
  const on = shortlist.some((s) => s.id === w.id);
  const facts = [w.country, w.vintage].filter(Boolean).map(esc).join(" · ");
  const detail = [sizeText(w), w.abv != null ? `${w.abv}% alcohol` : null, sweetText(w)].filter(Boolean).map(esc).join(" · ");
  const badges = sourceBadge(w.source) + (w.new_since_last ? `<span class="badge badge-new">New</span>` : "");
  const calgary = CALGARY.has(w.source) ? `<p class="wine-detail">Calgary retailer — check shipping to BC.</p>` : "";
  const lcbo = w.source === "LCBO" ? lcboDetailHtml(w) : w.source === "Lucullus" ? lucullusDetailHtml(w)
    : w.source === "Weinshop365" ? weinshop365DetailHtml(w) : "";
  const scores = w.retailer_scores ? `<p class="wine-detail"><span class="badge badge-score">★ ${esc(w.retailer_scores)}</span></p>` : "";
  const retailer = w.url ? `<a class="btn ext" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(sourceLabel(w.source))} page</a>` : "";
  return `<article class="wine wine-${esc(w.type)}${on ? " on-list" : ""}">
    <h3 class="wine-name">${esc(w.name)}</h3>
    <div class="wine-price">${priceHtml(w)}</div>
    <p class="wine-facts">${typePill(w.type)} ${facts}</p>
    <p class="wine-detail">${detail} ${badges}</p>${scores}${calgary}${lcbo}${ratingsHtml(w)}${familyLinksHtml(w)}
    <div class="wine-actions">
      ${researchButton(w)}
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>
      ${quickMarkButton(w)}
      ${shoppingButton(w)}
      <a class="btn ext btn-ct" href="${cellarTrackerUrl(w)}" target="_blank" rel="noopener">CellarTracker</a>
      <a class="btn ext btn-we" href="${wineEnthusiastUrl(w)}" target="_blank" rel="noopener">Wine Enthusiast</a>
      <a class="btn ext btn-vivino" href="${vivinoUrl(w)}" target="_blank" rel="noopener">Vivino</a>
      ${retailer}
      <button type="button" class="btn btn-ew" data-ew="${esc(w.id)}" aria-expanded="false">Find it elsewhere</button>
      ${rateButton(w)}
    </div>
  </article>`;
}

let lastResults = [];

// The cellars ticked under "Family cellars", all their wines.
function cellarWinesTicked(st = state) {
  const cels = [...st.sources].filter((x) => !ALL_SOURCES.includes(x));
  return cellarFindWines().filter((w) => cels.includes(w.source));
}

// "5,386 wines at BC Liquor - LDB"; "Cellar 1: the LCBO sells 50 of its 169 wines · 31 with
// your choices"; or, with nothing ticked, what to tick.
function countHeadingHtml(n) {
  const cels = [...state.sources].filter((x) => !ALL_SOURCES.includes(x)), stores = storesTicked();
  const wines = (k) => `${k.toLocaleString()} ${k === 1 ? "wine" : "wines"}`;
  if (!state.sources.size) return "No store or cellar ticked";
  if (!cels.length || !stores.length) return `${wines(n)} ${esc(storesPhrase())}`;
  const all = cellarWinesTicked(), sold = all.filter((w) => storeMatchesOf(w.id).some((x) => stores.includes(x.source))).length;
  const who = stores.length === 1 ? `the ${sourceLabel(stores[0])} sells` : `${stores.length} stores sell`;
  return `${esc(cels.join(" and "))}: ${esc(who)} ${sold.toLocaleString()} of ${cels.length === 1 ? "its" : "their"} ${wines(all.length)}` +
    (n !== sold ? ` · ${n.toLocaleString()} with your choices` : "");
}

function renderResults() {
  lastResults = findPool().filter((w) => matches(w)).sort(currentSort());
  const n = lastResults.length;
  // "5,386 wines at BC Liquor - LDB", and how many other bottle sizes the standard-bottle box hides
  const hiddenSizes = state.bottleOnly ? findPool().reduce((k, w) =>
    k + (!STANDARD_ML.has(w.size_ml) && matches(w, null, { ...state, bottleOnly: false })), 0) : 0;
  $("result-count").innerHTML = countHeadingHtml(n) +
    (hiddenSizes ? `<span class="count-note">standard bottles; ${hiddenSizes.toLocaleString()} other ${hiddenSizes === 1 ? "size" : "sizes"} hidden</span>` : "");

  renderChoiceChips();
  renderSortStatus();

  if (!n) {
    const newHint = state.newOnly && !WINES.some((w) => w.new_since_last)
      ? "<p>“New” wines appear once a second BC price list has come out, so they can be compared.</p>" : "";
    $("result-list").innerHTML = !state.sources.size
      ? `<div class="empty"><p>Tick a store under <strong>Sold by</strong>, or a family cellar under <strong>Family cellars</strong>, to see wines.</p></div>`
      : `<div class="empty">${newHint}${emptyHelpHtml()}
      <button type="button" class="btn" data-action="start-over">Start over</button></div>`;
  } else {
    // "3 of 15" on each card, in the order shown
    const of = n.toLocaleString();
    $("result-list").innerHTML = lastResults.slice(0, state.shown).map((w, i) =>
      wineCard(w).replace('<h3 class="wine-name">', `<h3 class="wine-name"><span class="wine-seq">${(i + 1).toLocaleString()} of ${of}</span>`)
        .replace('<div class="wine-actions">', `${boldAdviceHtml(w)}<div class="wine-actions">`)).join("");
  }
  const more = n - state.shown;
  $("show-more").hidden = more <= 0;
  $("show-more").textContent = `Show ${Math.min(more, PAGE_SIZE)} more wines (${more.toLocaleString()} not shown yet)`;

  const on = filtersOnCount();
  $("filter-toggle").textContent = ($("filter-body").classList.contains("open") ? "Hide filters" : "Show filters") +
    (on ? ` (${on} chosen)` : "");
}

// "Your choices": where the wines come from, then each choice as a chip with its own ✕,
// so one can be dropped without opening the panels.
let choiceChips = [];
function renderChoiceChips() {
  const stores = storesTicked(), cels = [...state.sources].filter((x) => !ALL_SOURCES.includes(x));
  const where = !state.sources.size ? "No store or cellar ticked"
    : cels.length ? `${cels.join(", ")}${stores.length ? `, sold by ${stores.map(sourceLabel).join(" or ")}` : " (the whole cellar)"}`
    : `At ${stores.map(sourceLabel).join(", ")}`;
  choiceChips = [...choicesMade(),
    ...(state.bottleOnly ? [["Standard bottles", (x) => { x.bottleOnly = false; }]] : [])];
  const chips = choiceChips.map(([label], k) =>
    `<span class="chip">${esc(label)}<button type="button" class="chip-x" data-chip="${k}" aria-label="Remove: ${esc(label)}">✕</button></span>`);
  $("active-filters").innerHTML = `<span class="choices-head">Your choices</span> <span class="choices-where">${esc(where)}</span>` +
    (state.pickLabel ? ` <span class="chip chip-pick">${esc(state.pickLabel)}</span>` : "") +
    (chips.length ? ` ${chips.join(" ")}` : ` <span class="hint-inline">nothing else chosen: everything is shown</span>`);
}
function removeChip(k) {
  const c = choiceChips[k];
  if (!c) return;
  c[1](state);
  state.pickLabel = "";
  state.shown = PAGE_SIZE;
  syncInputs();
  refresh();
}

// The choices now made, each as [what to call it, how to undo it].
function choicesMade(st = state) {
  const out = [], label = (key, v) => finderRows().find((r) => r[1] === key)?.[2].find((o) => o[0] === v)?.[1] || v;
  if (st.priceFrom != null || st.priceTo != null)
    out.push([st.priceFrom == null ? `Under $${st.priceTo}` : st.priceTo == null ? `$${st.priceFrom} and up` : `$${st.priceFrom}–$${st.priceTo}`, FINDER_CLEAR.price]);
  if (st.types.size) out.push([[...st.types].join(" or "), FINDER_CLEAR.colour]);
  for (const key of ["body", "tannin", "sweetStyle"]) if (st[key].size) out.push([[...st[key]].map((v) => label(key, v)).join(" or "), FINDER_CLEAR[key]]);
  if (st.continent) out.push([st.continent, FINDER_CLEAR.continent]);
  if (st.countries.size) out.push([(st.countryOut ? "leaving out " : "") + (st.countries.size > 2 ? `${st.countries.size} countries` : [...st.countries].join(st.countryOut ? " and " : " or ")), (x) => { x.countries = new Set(); }]);
  if (st.wellRated) out.push(["Only well rated", FINDER_CLEAR.wellRated]);
  if (st.fruity) out.push(["Fruity & ripe", FINDER_CLEAR.fruity]);
  if (st.longFinish) out.push(["Long finish", FINDER_CLEAR.longFinish]);
  if (st.readyNow) out.push(["Ready to drink now", FINDER_CLEAR.readyNow]);
  if (st.ratedOnly) out.push(["Scored by Claude or the family", FINDER_CLEAR.ratedOnly]);
  if (st.q) out.push([`the words “${st.q}”`, (x) => { x.q = ""; }]);
  if (!st.notRated) out.push(["measured sweetness only", (x) => { x.notRated = true; }]);
  if (st.newOnly) out.push(["new wines only", (x) => { x.newOnly = false; }]);
  if (st.grapes.size) out.push([(st.grapeOut ? "leaving out " : "") + [...st.grapes].join(st.grapeOut ? " and " : " or "), (x) => { x.grapes = new Set(); }]);
  if (st.food.size) out.push([`Goes with ${[...st.food].join(" or ").toLowerCase()}${st.foodBold ? " (adventurous too)" : ""}`, (x) => { x.food = new Set(); }]);
  if (st.vintFrom != null || st.vintTo != null) out.push([`Vintage ${st.vintFrom ?? "any"}–${st.vintTo ?? "newest"}`, (x) => { x.vintFrom = x.vintTo = null; }]);
  if (st.oldOnly) out.push(["10 years or older", (x) => { x.oldOnly = false; }]);
  if (st.abvFrom != null || st.abvTo != null) out.push([`Alcohol ${st.abvFrom ?? ABV_SLIDE.min}–${st.abvTo ?? ABV_SLIDE.max}%`, (x) => { x.abvFrom = x.abvTo = null; }]);
  return out;
}

// For an empty list: the one choice (or two together) whose removal brings back the most wines.
let emptyFix = null;
function emptyHelpHtml() {
  emptyFix = null;
  const made = choicesMade(), pool = findPool();
  const count = (undo) => { const st = cloneState(state); undo.forEach(([, f]) => f(st)); return pool.reduce((k, w) => k + matches(w, null, st), 0); };
  let best = null;
  for (const c of made) { const n = count([c]); if (n && (!best || n > best.n)) best = { undo: [c], n }; }
  if (!best) {
    for (let i = 0; i < made.length; i++) for (let j = i + 1; j < made.length; j++) {
      const n = count([made[i], made[j]]);
      if (n && (!best || n > best.n)) best = { undo: [made[i], made[j]], n };
    }
  }
  if (!best) return `<p>No wines match these choices. Try removing a few, or start again.</p>`;
  emptyFix = best.undo;
  const names = best.undo.map(([l]) => `<strong>“${esc(l)}”</strong>`);
  const why = names.length === 1 ? `${names[0]} rules out every wine here` : `${names[0]} and ${names[1]} together rule out every wine here`;
  return `<p>No wines match all these choices: ${why}.</p>
    <p><button type="button" class="btn btn-primary" data-action="empty-fix">Without ${names.length === 1 ? "it" : "them"}: show ${best.n.toLocaleString()} ${best.n === 1 ? "wine" : "wines"}</button></p>`;
}

function applyEmptyFix() {
  if (!emptyFix) return;
  emptyFix.forEach(([, f]) => f(state));
  state.pickLabel = "";
  state.shown = PAGE_SIZE;
  syncInputs();
  refresh();
}

// When the list is sorted by a rating, say how many wines actually have one, so a list
// with none (shown cheapest first) doesn't look wrongly sorted.
// For each rating sort: its name, which wines count as scored, and how to say so.
const RATING_SORTS = {
  best: { name: "Best rated first", has: (w) => familyScore(w) != null, scored: "scored by Claude or the family", from: "from Claude or the family" },
  claude: { name: "Claude's score", has: (w) => SORT_KEYS.claude.get(w) != null, scored: "scored by Claude", from: "from Claude" },
  mine: { name: "My rating", has: (w) => SORT_KEYS.mine.get(w) != null, scored: "rated by you on this computer", from: "from you" },
  family: { name: "Family members' ratings", has: (w) => SORT_KEYS.family.get(w) != null, scored: "rated by a family member", from: "from a family member" },
  ct: { name: "CellarTracker score", has: (w) => SORT_KEYS.ct.get(w) != null, scored: "with a CellarTracker score", from: "on CellarTracker" },
};
const SCORE_LIST_MAX = 100; // "Get quick Claude scores (next 25)" is suggested once the list is this short

// When the list is sorted by a rating, say how many wines actually have one, so the
// unscored ones (cheapest first) don't look wrongly sorted; and, for a short list, offer
// to have Claude score more.
function renderSortStatus() {
  renderFinderSummary();
  const box = $("sort-status");
  if (!box) return;
  const first = sortGroup(state.sorts[0] || ""), rs = RATING_SORTS[first], n = lastResults.length;
  const rated = rs && n ? lastResults.filter(rs.has).length : n;
  if (!rs || !n || rated === n) { box.hidden = true; return; }
  const rest = n - rated, next = state.sorts[1] ? "in your “then by” order" : "cheapest first";
  const zyn = first === "best" ? lastResults.filter((w) => !rs.has(w) && w.retailer_scores).length : 0;
  const wines = (k) => `${k.toLocaleString()} ${k === 1 ? "wine" : "wines"}`;
  let html = rated
    ? `<strong>${esc(rs.name)}:</strong> the ${wines(rated)} ${rs.scored} ${rated === 1 ? "is" : "are"} at the top. ` +
      (zyn ? `Next come ${wines(zyn)} on ZYN's 90+ list; then the ` : "The ") +
      `other ${wines(rest - zyn)} ${rest - zyn === 1 ? "has" : "have"} no score yet and follow, ${next}.`
    : `<strong>${esc(rs.name)}:</strong> ${n === 1 ? "this wine has" : `none of these ${wines(n)} has`} a score ${rs.from} yet, ` +
      (zyn ? `so the ${wines(zyn)} on ZYN's 90+ list come first and the rest follow, ${next}.` : `so ${n === 1 ? "it's" : "they're"} shown ${next}.`);
  if (first !== "mine") {
    html += n > SCORE_LIST_MAX
      ? `<br><span class="hint">To have Claude score some of these, narrow the list with Find me a wine first.</span>`
      : `<br>Claude can run a quick check on ${rest <= 25 ? `the ${rest === 1 ? "remaining wine" : `${rest} remaining wines`}` : `the next 25 of the ${rest.toLocaleString()} remaining wines`} ` +
        `to help your ranking: tap <strong>Get quick Claude scores (next 25)</strong> at the bottom of the page.`;
  }
  box.innerHTML = html;
  box.hidden = false;
}

function renderAll() {
  renderFinder();
  renderSidePrice();
  renderFood();
  renderGrapes();
  renderRanges();
  renderSources();
  renderCountries();
  renderTypes();
  renderSweet();
  syncInputs();
  renderResults();
}

// Re-render everything except the input being typed in.
function refresh() {
  renderFinder();
  renderSweet();
  renderSidePrice();
  renderFood();
  renderGrapes();
  renderRanges();
  renderCountries();
  renderTypes();
  renderResults();
}

// ---- Shortlist ---------------------------------------------------------------

// "Portugal 7, Chile 5" — so wines left over from an earlier search are obvious.
function shortlistCountries() {
  const n = new Map();
  for (const w of shortlist) {
    const c = w.kind === "typed" ? "added by name" : w.country;
    n.set(c, (n.get(c) || 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(", ");
}

function saveShortlist() {
  storeSet(STORE.shortlist, shortlist);
  for (const el of document.querySelectorAll(".sl-count")) el.textContent = shortlist.length;
  $("sl-summary").textContent = shortlist.length ? `(${shortlistCountries()})` : "";
}

function toggleShortlist(id) {
  closeClaudeSteps(); // its copied question no longer matches the list
  const i = shortlist.findIndex((s) => s.id === id);
  if (i >= 0) shortlist.splice(i, 1);
  else {
    const w = findWine(id);
    if (w) { const { _s, _w, ...copy } = w; shortlist.push(copy); }
  }
  saveShortlist();
}

// ---- Shopping List: wines to buy, kept in this browser -------------------------------
// Separate from the Short List (which is for asking Claude). Each wine is kept as it was when
// added, and shown with today's details when the store list still has it.
let shopping = (() => { const v = storeGet(STORE.shopping, []); return Array.isArray(v) ? v : []; })();
const onShopping = (id) => shopping.some((s) => s.id === id);
function shoppingButton(w) {
  if (w.kind === "typed") return "";
  const on = onShopping(w.id);
  return `<button type="button" class="btn btn-shop" data-shop="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Shopping List (tap to remove)" : "🛒 Click to add wine to Shopping List"}</button>`;
}
function saveShopping() {
  storeSet(STORE.shopping, shopping);
  for (const el of document.querySelectorAll(".shop-count")) el.textContent = shopping.length;
}
function toggleShopping(id) {
  const i = shopping.findIndex((s) => s.id === id);
  if (i >= 0) shopping.splice(i, 1);
  else {
    const w = findWine(id);
    if (w) { const { _s, _w, ...copy } = w; shopping.push({ ...copy, added: todayIso() }); }
  }
  saveShopping();
  const on = onShopping(id);
  for (const b of document.querySelectorAll(`[data-shop="${CSS.escape(id)}"]`)) {
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "✓ On Shopping List (tap to remove)" : "🛒 Click to add wine to Shopping List";
  }
  if (!$("view-shopping").hidden) renderShopping();
}
function renderShopping() {
  if (!$("shop-list")) return;
  const items = shopping.map((s) => findWine(s.id) || s);
  const byStore = new Map();
  for (const w of items) if (w.kind !== "cellar" && w.price != null) {
    const k = sourceLabel(w.source), v = byStore.get(k) || { n: 0, sum: 0 };
    byStore.set(k, { n: v.n + 1, sum: v.sum + (+w.price || 0) });
  }
  const totals = [...byStore].map(([k, v]) => `${v.n} at ${esc(k)}: <strong>${money(v.sum)}</strong>`).join(" · ");
  $("shop-summary").innerHTML = items.length
    ? `<strong>${items.length} ${items.length === 1 ? "wine" : "wines"}</strong> on your Shopping List${totals ? `. ${totals} (one bottle of each)` : ""}.`
    : `Your Shopping List is empty. Press <strong>🛒 Click to add wine to Shopping List</strong> on any wine in Find wines or My wines.`;
  $("shop-clear").hidden = !items.length;
  $("shop-list").innerHTML = items.map((w, i) => wineCard(w)
    .replace('<h3 class="wine-name">', `<h3 class="wine-name"><span class="wine-seq">${i + 1} of ${items.length}</span>`)
    .replace('<div class="wine-actions">', `${boldAdviceHtml(w)}<div class="wine-actions"><button type="button" class="btn btn-shop-remove" data-shop-remove="${esc(w.id)}">✕ Remove from Shopping List</button>`)).join("");
}

// "$25.99 at BC Liquor - LDB", or "from Alex's cellar" for a wine with no shop price.
function priceText(w) {
  if (w.kind === "typed") return "added by name, not on my store lists";
  if (w.kind === "cellar" || w.price == null) return `from ${sourceLabel(w.source)}`;
  return `${priceStr(w)} at ${sourceLabel(w.source)}`;
}

function wineLine(w, i, forClaude = false) {
  const bits = [w.country !== "Country not stated" ? w.country : null, w.type !== "Other" ? w.type : null,
    w.size_ml ? sizeText(w) : null, priceText(w)];
  let line = `${i + 1}. ${w.name} — ${bits.filter(Boolean).join(", ")}`;
  if (w.vintage) line += `, vintage ${w.vintage}`;
  if (w.retailer_scores) line += `; ${w.retailer_scores}`;
  if (w.my_score != null) line += `; ${w.owner} scored it ${w.my_score}`;
  if (w.ct_score != null) line += `; CellarTracker community score ${w.ct_score}`;
  if (forClaude) {
    const inCellars = cellarMatches(w).map((m) => `${m.source}${m.vintages.length ? ` has the ${m.vintages.join(", ")}` : ""}`);
    if (inCellars.length) line += `; in our family's cellars: ${inCellars.join("; ")}`;
    const r = ratingOf(w.id);
    // Claude's own earlier scores are left out so it judges afresh; people's own points are useful context.
    if (r.mine) line += `; my own rating: ${r.mine.points}/100`;
    const f = frOf(w.id);
    if (f.family && !r.mine) line += `; our family's rating: ${f.family.points}/100`;
    line += ` [${w.id}]`;
  }
  return line;
}

function shortlistText() {
  return `Wine short list (${shortlist.length} ${shortlist.length === 1 ? "wine" : "wines"})\n\n` +
    shortlist.map(wineLine).join("\n") +
    "\n\nPrices exclude tax; availability not guaranteed.";
}

let claudeMode = "about"; // "about" (tell me about these) or "rank" (rank by reviews)

// Asks Claude to end with a link back to this page carrying its own ratings
// (see offerSavedRatings). {BASE} becomes this page's address.
const SAVE_LINK_TEMPLATE = `Last of all, please give me a link I can click to save your ratings. For each wine, give your own overall rating out of 100, based on what the reviewers say (your judgement, not a copy of any one critic's score). The link is easy to miss, so:
- Make the very first line of your answer, once only: "Your save link is at the bottom of this answer."
- Put the link at the very end, after everything else including your sources, below a horizontal line (---). Above it, write these three lines exactly, each in bold:
"⬇️ To save this research: 2 clicks ⬇️"
"Step 1: click the copy icon (two folders on top of each other) on the far left in the grey row below the “Create a doc” button."
"Step 2: then click this link:"
Then write the link as the largest heading (one #), itself the link, exactly in this form, one entry per wine joined by semicolons:
# [💾 Save these ratings to my Wine Finder]({BASE}#save=CODE~POINTS~VINTAGE~NOTE;CODE~POINTS~VINTAGE~NOTE)
- Then, in italics: "(The “Create a doc” button below is Claude's own. It makes a document of this answer to keep or send. It doesn't save your ratings.)"
- End with one more horizontal line (---), so the save link stands apart from the buttons under the answer.
CODE is the wine's code in square brackets in my list; POINTS is your rating (leave it empty if you found no reviews); VINTAGE is the vintage your rating is for, or NV; NOTE is up to eight words, with + instead of spaces and no semicolons or tildes.`;

// "Get quick Claude scores (next 25)": a quick review score for each wine, no write-up, so a
// store's list can be sorted. Claude ends with a #scores= link (read by parseSaveHash).
const SCORE_BATCH = 25;
const SCORE_TEMPLATE = `I'd like a quick review score for each of these wines, so I can sort a shop's list by what reviewers say. {ABOUT_ME}

Here are the wines, with the vintage, where each is sold and the price, and a code in square brackets:
{WINES}

For each wine, please:
- Search the web for professional reviews and community notes (for example Wine Enthusiast, Decanter, James Suckling, Vinous, Jancis Robinson, CellarTracker).
- Give your own overall score out of 100, based on what the reviewers say (your judgement, not a copy of any one critic's score), and the vintage it applies to. If you only find reviews of another vintage, you may use them, but give that vintage.
- In up to eight words, say what your score rests on, for example: WE 92, Decanter 90 for 2021.
- Describe its style from the reviews and the tasting notes: body (light, medium or full), tannin (soft, medium or firm; for whites, leave it empty), sweetness (dry, off-dry, medium-sweet or sweet), whether it's fruit-forward (ripe and fruity-tasting even when dry, like many Malbecs or Australian Shiraz: yes or no), how long its flavour lasts after swallowing (the finish: short, medium or long), and when to drink it (from year to year).
- Name its main grapes (up to four words) and the dishes it's best with (up to eight words, as specific as you can, for example: lamb chops with rosemary, mushroom risotto), from what you've already found and the wine's style. Don't search just for these.
- If you can't find any reviews, say so plainly rather than estimating the score; give the style only if you know the wine.

Keep the answer short: one line per wine, in my order, as: number. wine — score (vintage) — what it rests on — body, tannin, sweetness, fruit-forward or not, finish — drink from–to — grapes — best with.

Last of all, after a horizontal line (---), give me a link to save the scores, as the largest heading (one #), itself the link, exactly in this form, one entry per wine joined by semicolons:
# [💾 Save these scores to my Wine Finder]({BASE}#scores=CODE~POINTS~VINTAGE~NOTE~BODY~TANNIN~SWEET~DRINK~FRUIT~FINISH~PAIR~GRAPES;CODE~POINTS~VINTAGE~NOTE~BODY~TANNIN~SWEET~DRINK~FRUIT~FINISH~PAIR~GRAPES)
CODE is the wine's code in square brackets in my list; POINTS is your score (leave it empty if you found no reviews); VINTAGE is the vintage your score is for, or NV; NOTE is what it rests on, up to eight words, with + instead of spaces and no semicolons or tildes; BODY is light, medium or full; TANNIN is soft, medium or firm (empty for whites); SWEET is dry, off-dry, medium-sweet or sweet; DRINK is the drinking window as 2024-2030; FRUIT is yes if it's fruit-forward, otherwise no; FINISH is short, medium or long; PAIR is the dishes it's best with, up to eight words; GRAPES is its main grapes, up to four words (both with + instead of spaces and no semicolons or tildes). Leave any of these empty if you don't know.`;

let scorePicks = [];

// Already scored, in any vintage and at any store: Claude's research, an earlier quick
// score, or "no reviews found" from an earlier search. These aren't looked up again.
// A thin score doesn't count as scored: a quick score from before quick scores gathered the
// style, food and grapes, or a score from the older "rank these wines" runs (a score and a
// line, no write-up). The next quick-score run, or the olive button, fills the details in.
// A wine with a full write-up always counts as scored.
const olderQuick = (c) => !!c?.quick && !(c.body || c.sweet || c.pair || c.grapes || c.drinkFrom);
const thinScore = (c) => !(c.body || c.sweet || c.pair || c.grapes || c.drinkFrom);
const claudeRatingsOf = (w) => [ratingOf(w.id).claude, frOf(w.id).claude, ...relatedRatings(w).map((r) => r.f.claude)].filter(Boolean);
const hasClaudeRating = (w) => notesFor(w).length > 0 || claudeRatingsOf(w).some((c) => !thinScore(c));

function scoreLine(w, i) {
  const price = w.currency ? `${w.currency} ${Number(w.price_local).toFixed(2)}` : money(w.price);
  return `${i + 1}. ${w.name}${w.vintage ? `, ${w.vintage}` : ""} — ${sourceLabel(w.source)}, ${price} [${w.id}]`;
}

function scorePrompt() {
  const about = String(storeGet(STORE.aboutMe, "") || "").trim();
  return SCORE_TEMPLATE.replace("{ABOUT_ME}", about)
    .replace("{BASE}", location.href.split("#")[0].split("?")[0])
    .replace("{WINES}", scorePicks.map(scoreLine).join("\n"))
    .replace(/[ \t]+\n/g, "\n");
}

// Step 1: pick the first 25 unscored wines of the list as it's sorted now, and explain.
// Wines marked one by one for a quick score ("＋ Add Claude Quick Score" on a card), kept in
// this browser until Claude's scores for them are saved.
const quickMarks = new Set((() => { const v = storeGet(STORE.quickMarks, []); return Array.isArray(v) ? v : []; })());
function quickMarkButton(w) {
  if (w.kind === "typed" || (hasClaudeRating(w) && !quickMarks.has(w.id))) return ""; // already scored: nothing to mark
  const on = quickMarks.has(w.id);
  return `<button type="button" class="btn btn-quickmark" data-qmark="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ Marked for a Quick Score (tap to unmark)" : "＋ Add Claude Quick Score"}</button>`;
}
function saveQuickMarks() {
  storeSet(STORE.quickMarks, [...quickMarks]);
  const n = quickMarks.size, b = $("score-marked");
  if (b) { b.hidden = !n; b.textContent = `Get Marked Quick Scores Now (${n})`; }
}
function toggleQuickMark(id) {
  if (quickMarks.has(id)) quickMarks.delete(id); else quickMarks.add(id);
  saveQuickMarks();
  for (const b of document.querySelectorAll(`[data-qmark="${CSS.escape(id)}"]`)) {
    const on = quickMarks.has(id);
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "✓ Marked for a Quick Score (tap to unmark)" : "＋ Add Claude Quick Score";
  }
}

function openScoreDialog(marked = false) {
  if (marked) return openMarkedScoreDialog();
  const list = lastResults.filter((w) => w.kind !== "typed");
  let skipped = 0;
  scorePicks = [];
  for (const w of list) {
    if (scorePicks.length >= SCORE_BATCH) break;
    if (hasClaudeRating(w)) skipped++; else scorePicks.push(w);
  }
  const refresh = scorePicks.filter((w) => claudeRatingsOf(w).length).length;
  $("score-result").hidden = true;
  $("score-go").textContent = "Open Claude with my question";
  if (!scorePicks.length) {
    $("score-intro").textContent = list.length
      ? "Every wine at the top of this list already has a Claude score. Change the filters or the order to score others."
      : "There are no wines in the list. Choose some with the filters first.";
    $("score-list").innerHTML = "";
    $("score-steps").hidden = $("score-go").hidden = true;
  } else {
    $("score-intro").innerHTML = `Claude will look up reviews for the first <strong>${scorePicks.length}</strong> ${scorePicks.length === 1 ? "wine" : "wines"} in your list that don't have a Claude score yet` +
      (skipped ? ` (${skipped} already scored ${skipped === 1 ? "was" : "were"} skipped)` : "") +
      (refresh ? `, including ${refresh} with an older, shorter score, to add their style, grapes and food` : "") +
      `, and give each a score out of 100. The scores are kept and shared with the family, so nobody looks them up twice.`;
    $("score-list").innerHTML = scorePicks.map((w) => `<li>${esc(w.name)}${w.vintage ? ` <span class="hint">${esc(String(w.vintage))}</span>` : ""}</li>`).join("");
    $("score-steps").hidden = $("score-go").hidden = false;
  }
  $("score-text").value = scorePicks.length ? scorePrompt() : "";
  $("score-dialog").showModal?.();
}

// The wines marked on their cards, up to a batch of 25 (the rest stay marked for next time).
function openMarkedScoreDialog() {
  const marked = [...quickMarks].map((id) => findWine(id)).filter(Boolean);
  scorePicks = marked.filter((w) => !hasClaudeRating(w)).slice(0, SCORE_BATCH);
  const done = marked.filter((w) => hasClaudeRating(w));
  for (const w of done) quickMarks.delete(w.id); // scored meanwhile (here or by the family)
  saveQuickMarks();
  $("score-result").hidden = true;
  $("score-go").textContent = "Open Claude with my question";
  if (!scorePicks.length) {
    $("score-intro").textContent = "None of the wines you marked still needs a score" + (done.length ? `: ${done.length} already ${done.length === 1 ? "has" : "have"} one.` : ".");
    $("score-list").innerHTML = "";
    $("score-steps").hidden = $("score-go").hidden = true;
  } else {
    const left = marked.length - done.length - scorePicks.length;
    $("score-intro").innerHTML = `Claude will look up reviews for the <strong>${scorePicks.length}</strong> ${scorePicks.length === 1 ? "wine" : "wines"} you marked` +
      (left > 0 ? ` (the other ${left} stay marked for the next batch)` : "") +
      `, and give each a score out of 100. The scores are kept and shared with the family, so nobody looks them up twice.`;
    $("score-list").innerHTML = scorePicks.map((w) => `<li>${esc(w.name)}${w.vintage ? ` <span class="hint">${esc(String(w.vintage))}</span>` : ""}</li>`).join("");
    $("score-steps").hidden = $("score-go").hidden = false;
  }
  $("score-text").value = scorePicks.length ? scorePrompt() : "";
  $("score-dialog").showModal?.();
}

// Step 2: open Claude with the question (copied too, as a backup).
async function goScoreClaude() {
  const prompt = scorePrompt();
  const { url, prefilled } = claudeLink(prompt);
  const res = $("score-result");
  res.hidden = false;
  res.innerHTML = prefilled ? "Opening Claude…" : "Copying your question and opening Claude…";
  const r = await openClaudeHere(url, prompt);
  res.innerHTML = newTabMessage(r, url) + ` When it's done, click <strong>💾 Save these scores to my Wine Finder</strong> at the end of its answer.`;
  $("score-go").textContent = "Open Claude again";
}

function claudePrompt(mode = claudeMode) {
  const about = String(storeGet(STORE.aboutMe, "") || "").trim();
  return (mode === "rank" ? RANK_TEMPLATE : PROMPT_TEMPLATE)
    .replace("{ABOUT_ME}", about)
    .replace("{SAVE_LINK}", SAVE_LINK_TEMPLATE.replace("{BASE}", location.href.split("#")[0].split("?")[0]))
    .replace("{WINES}", shortlist.map((w, i) => wineLine(w, i, true)).join("\n") + (shortlist.some((w) => w.kind === "typed")
      ? "\n\nThe wines marked “added by name” aren't on my store lists (BC Liquor, BSW, ZYN). If you know where they're sold in BC, Alberta or Ontario, please mention it."
      : ""))
    .replace(/[ \t]+\n/g, "\n");
}

// Short List page: add a wine by name; as you type, say whether it's on our lists.
const renderSlAddHits = debounce(() => {
  const q = $("sl-add-q").value.trim();
  const out = $("sl-add-hits");
  if (q.length < 3) { out.innerHTML = ""; return; }
  if (!allLoaded()) { loadAllSources().then(renderSlAddHits); out.innerHTML = `<p class="hint">Checking the store lists…</p>`; return; }
  const hits = listHits(q);
  out.innerHTML = familyHitsHtml(q) + (hits.length
    ? `<p><strong>Found on our store lists (${hits.length}).</strong> You can add one of these, with its price, instead:</p>
       <ul class="ew-hit-list">${hits.slice(0, 5).map(hitRow).join("")}</ul>
       ${hits.length > 5 ? `<p class="hint">Showing the 5 cheapest. Try more words to narrow it down.</p>` : ""}`
    : `<p><strong>Not on the BC Liquor, BSW or ZYN lists.</strong> If it's not in the family's wines above either, it will be added by name, and Claude will be told so.</p>`);
}, 300);

function addFromShortlistBox() {
  const q = $("sl-add-q").value.trim();
  if (!q) { $("sl-add-q").focus(); return; }
  setStatus(addTypedWine(q) ? `Added “${q}”.` : `“${q}” is already on the list.`);
  $("sl-add-q").value = "";
  $("sl-add-hits").innerHTML = "";
  renderShortlist();
}

function renderShortlist() {
  saveShortlist();
  const empty = shortlist.length === 0;
  $("sl-empty").hidden = !empty;
  $("sl-actions").hidden = empty;
  $("sl-keep").hidden = empty;
  $("sl-keep").textContent = `${shortlist.length} ${shortlist.length === 1 ? "wine" : "wines"}: ${shortlistCountries()}. ` +
    "Wines stay on this list, even after Start over or closing the page, until you remove them or press “Clear the list”.";
  $("sl-warning").hidden = shortlist.length <= CLAUDE_SOFT_LIMIT;
  $("sl-warning").textContent = `You have ${shortlist.length} wines. Claude works best with up to about 10 at a time — you can still ask about all of them.`;
  $("sl-list").innerHTML = shortlist.map((w) => `<li><div class="sl-row">
      <div><div class="sl-name">${esc(w.name)}</div>
      <div>${esc([w.country !== "Country not stated" ? w.country : null, w.type !== "Other" ? w.type : null, w.vintage, w.size_ml ? sizeText(w) : null].filter(Boolean).join(" · "))}</div>
      <div>${w.kind === "cellar" || w.price == null ? esc(priceText(w)) : `<strong>${priceHtml(w)}</strong> at ${esc(sourceLabel(w.source))}`}</div>
      ${ratingsHtml(w)}${w.kind === "cellar" ? "" : familyLinksHtml(w)}</div>
      <div class="sl-buttons">
        ${researchButton(w)}${rateButton(w)}
        <button type="button" class="btn btn-ew" data-ew="${esc(w.id)}" aria-expanded="false">Find it elsewhere</button>
        <button type="button" class="btn" data-remove="${esc(w.id)}">Remove</button>
      </div>
    </div></li>`).join("");
  renderPrintArea();
}

function renderPrintArea() {
  $("print-area").innerHTML = shortlist.length
    ? `<h1>Wine short list</h1><ol>${shortlist.map((w) => `<li><span class="pa-name">${esc(w.name)}</span><br>
        ${esc([w.country !== "Country not stated" ? w.country : null, w.type !== "Other" ? w.type : null, w.vintage, w.size_ml ? sizeText(w) : null].filter(Boolean).join(" · "))} — ${esc(priceText(w))}</li>`).join("")}</ol>
       <p class="pa-foot">Prices exclude tax; availability not guaranteed. Printed ${new Date().toLocaleDateString()}.</p>`
    : "<h1>Wine short list</h1><p>The list is empty.</p>";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function setStatus(msg) {
  $("sl-status").textContent = msg;
  clearTimeout(setStatus.t);
  setStatus.t = setTimeout(() => { $("sl-status").textContent = ""; }, 8000);
}

// claude.ai/new?q=... types the question into Claude's message box (verified 2026-10-23;
// it does not send it). Very long links can be refused, so past this length we fall
// back to the clipboard alone.
const CLAUDE_PREFILL_MAX = 7000;

// Claude opens in this tab, in place of the Wine Finder. Claude's own link back always opens
// a fresh Wine Finder tab, so this leaves two tabs (Claude and the Wine Finder) instead of
// three; the browser's Back button in Claude also returns here. The question is copied
// first, in case the link can't carry it all.
// When the question is too long for the link it has to be pasted, so Claude opens in a new
// tab instead and this page stays put, with the paste instructions on screen.
// Research and quick scores open Claude in a new tab, as they always have: when the link
// carries the question, open first and copy as a backup; when it has to be pasted, copy
// first (copying can fail once the new tab has focus). Only the restaurant page, whose
// question always fits, replaces this page (inPlace), so a dinner round trip leaves two tabs.
async function openClaudeHere(url, prompt, inPlace = false) {
  const prefilled = url.includes("?q=");
  if (inPlace && prefilled) {
    const copied = await copyText(prompt);
    savePlace();
    location.assign(url);
    return { newTab: false, opened: true, copied, prefilled };
  }
  let win, copied;
  const open = () => { win = window.open(url, "_blank"); if (win) win.opener = null; }; // "noopener" would make this return null
  if (prefilled) { open(); copied = await copyText(prompt); } else { copied = await copyText(prompt); open(); }
  return { newTab: true, opened: !!win, copied, prefilled };
}

// What to show after Claude opened in a new tab.
function newTabMessage(r, url) {
  if (!r.opened) return `Your browser stopped the new tab from opening. Please press the button again, or <a href="${esc(url)}" target="_blank" rel="noopener">open Claude here</a>.`;
  if (r.prefilled) return `Claude is open in a new tab with your question already typed in. Go to it, check the question, and ${SEND}.` +
    (r.copied ? ` If its message box is empty, click in it and press <strong>Ctrl+V</strong>: the question is copied.` : "");
  return r.copied ? `Claude is open in a new tab. In it, ${PASTE}.`
    : `Claude is open in a new tab. Please copy the question from the box below (select it and press <strong>Ctrl+C</strong>), then ${PASTE}.`;
}

function claudeLink(prompt) {
  // Spaces as "+" (standard in a web address's query) keep the link about a fifth shorter
  // than "%20", so a Short List of about 10 wines still fits.
  const prefillUrl = `${CLAUDE_URL}?q=${encodeURIComponent(prompt).replace(/%20/g, "+")}`;
  const prefilled = prefillUrl.length <= CLAUDE_PREFILL_MAX;
  return { url: prefilled ? prefillUrl : CLAUDE_URL, prefilled };
}

const SEND = `press <strong>Enter</strong> (or the orange arrow) to send it`;
const PASTE = `click in Claude's message box, press <strong>Ctrl+V</strong> (or right-click → Paste), then ${SEND}`;
const ZOOM_TIP = `<p class="tip"><strong>Text too small?</strong> In the Claude window, hold <strong>Ctrl</strong> and press <strong>+</strong> to make it bigger (<strong>Ctrl</strong> and <strong>0</strong> puts it back). The browser remembers the size for next time.</p>`;

// Step 1 of Ask Claude: explain what will happen, before any tab opens.
function askClaude(mode = "about") {
  claudeMode = mode;
  const { prefilled } = claudeLink(claudePrompt());
  const what = prefilled
    ? `<li>Claude opens in a new tab with your question <strong>already typed in</strong>.</li>
       <li>Above the question, Claude shows a note saying “Use caution before running this prompt”. It shows that for every question that arrives by link. This one comes from your Short List, so it's fine to send.</li>
       <li>Check the question, then ${SEND}.</li>
       <li>When Claude finishes, press Claude's <strong>copy button</strong> under its answer (two folders on top of each other, on the far left), then click <strong>💾 Save these ratings to my Wine Finder</strong> at the very bottom.</li>`
    : `<li>Claude opens in a new tab, and your question is copied.</li>
       <li>Your list is too long to type in automatically, so ${PASTE}.</li>
       <li>When Claude finishes, press Claude's <strong>copy button</strong> under its answer (two folders on top of each other, on the far left), then click <strong>💾 Save these ratings to my Wine Finder</strong> at the very bottom.</li>`;
  const notice = $("ask-notice");
  notice.hidden = false;
  $("ask-claude").hidden = $("ask-claude-rank").hidden = true;
  const n = `${shortlist.length} ${shortlist.length === 1 ? "wine" : "wines"}`;
  const done = shortlist.filter((w) => notesFor(w).length);
  notice.innerHTML = `<p class="big">${mode === "rank" ? `Asking Claude to rank your ${n} by reviews` : `Asking Claude about your ${n}`}</p>
    ${done.length ? `<p class="warning">📖 ${done.length === 1 ? `“${esc(done[0].name)}” already has` : `${done.length} of these wines already have`} Claude Research Results from the family. Read them first with the 📖 button on each wine: you may not need to ask again.</p>` : ""}
    <p>Here's what happens when you press the button below:</p>
    <ol class="steps">${what}</ol>
    <img class="save-steps-img" src="images/save-steps.png?v=3" alt="To save Claude&#39;s research, 2 clicks: first click the copy icon (two folders on top of each other, on the far left) under Claude&#39;s answer, then click the 💾 Save these ratings to my Wine Finder link.">
    ${ZOOM_TIP}
    <p class="dialog-actions">
      <button type="button" class="btn btn-big btn-claude" id="go-claude">Open Claude with my question</button>
      <button type="button" class="btn" data-action="hide-notice">Back to my list</button>
    </p>
    <p id="claude-result" class="status-box" role="status" hidden></p>
    <details><summary>See the question</summary><textarea id="prompt-text" readonly></textarea></details>`;
  $("prompt-text").value = claudePrompt();
  notice.scrollIntoView({ block: "start" });
}

// Step 2: open Claude (and copy the question as a backup).
async function goClaude() {
  const prompt = claudePrompt();
  const { url, prefilled } = claudeLink(prompt);
  const result = $("claude-result");
  result.hidden = false;
  result.innerHTML = prefilled ? "Opening Claude…" : "Copying your question and opening Claude…";
  const r = await openClaudeHere(url, prompt);
  result.innerHTML = newTabMessage(r, url);
  $("go-claude").textContent = "Open Claude again";
}

function closeClaudeSteps() {
  $("ask-notice").hidden = true;
  $("ask-claude").hidden = $("ask-claude-rank").hidden = false;
}

// ---- My wines (CellarTracker cellars + wines added by hand) ---------------------------
// Kept in this browser only (localStorage), with a backup file. Nothing is published.
// CellarTracker lets people choose their export columns, so columns are recognised by
// name; the import shows a preview of what it found before anything is saved.

const CT_COLUMNS = { // field: CellarTracker column names it may use (compared ignoring case/spaces)
  name: ["wine", "winename", "name", "userwine1"],
  vintage: ["vintage"],
  producer: ["producer"],
  designation: ["designation"],
  vineyard: ["vineyard"],
  country: ["country"],
  region: ["appellation", "subregion", "region"], // most specific first
  varietal: ["varietal", "mastervarietal", "grape", "grapes"],
  colour: ["color", "colour"],
  category: ["category"],
  type: ["type"],
  size: ["size", "bottlesize"],
  quantity: ["quantity", "qty", "totalquantity", "bottles"],
  price: ["price", "purchaseprice", "value", "valuation"],
  my: ["my", "myscore", "myrating", "score", "rating"],
  ct: ["ct", "cscore", "communityscore", "ctscore"],
  drinkFrom: ["beginconsume", "drinkfrom"],
  drinkTo: ["endconsume", "drinkto"],
  location: ["location"],
  bin: ["bin"],
  notes: ["note", "notes", "privatenote"],
};
const MW_PAGE = 50;

let myWines = { cellars: {}, manual: [] };
let mwPending = null; // parsed import awaiting "Save"
const mwView = { q: "", owner: "all", sort: "name", shown: MW_PAGE, open: false }; // open: the wine list is showing

function loadMyWines() {
  const saved = storeGet(STORE.myWines, null);
  if (saved && typeof saved === "object") {
    myWines = { cellars: saved.cellars || {}, manual: Array.isArray(saved.manual) ? saved.manual : [] };
  }
}

function saveMyWines() {
  try {
    localStorage.setItem(STORE.myWines, JSON.stringify(myWines));
    return true;
  } catch {
    mwStatus("Couldn't save on this computer (the browser may be full or private). Please save a backup file.");
    return false;
  }
}

function allMyWines() {
  return [...Object.values(myWines.cellars).flatMap((c) => c.wines), ...sharedCellarWines(), ...myWines.manual];
}

const findWine = (id) => WINES.find((x) => x.id === id) || allMyWines().find((x) => x.id === id) ||
  shortlist.find((x) => x.id === id);

function mwStatus(msg) { $("mw-status").textContent = msg; }

// CSV or tab-delimited text -> rows of fields (quotes, doubled quotes and line breaks in quotes handled).
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const colKey = (s) => fold(s).replace(/[^a-z0-9]/g, "");

function ctType(colour, category, type) {
  const s = fold([colour, category, type].join(" "));
  if (/sparkling|champagne/.test(s)) return "Sparkling";
  if (/fortified|port\b|sherry|madeira/.test(s)) return "Fortified";
  if (/sweet|dessert/.test(s)) return "Dessert";
  if (/rose/.test(s)) return "Rosé";
  if (/red/.test(s)) return "Red";
  if (/white/.test(s)) return "White";
  return "Other";
}

function ctSize(s) {
  const t = fold(s);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  if (m) return Math.round(m[2] === "ml" ? +m[1] : +m[1] * 1000);
  if (/magnum/.test(t)) return 1500;
  if (/half/.test(t)) return 375;
  return 750;
}

const num = (s) => { const n = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : null; };
const scoreOf = (s) => { const n = num(s); return n != null && n >= 50 && n <= 100 ? n : null; };
const slug = (s) => colKey(s) || "x";

// Rows from a CellarTracker export -> {wines, used, unused} or {error}.
function readCellar(text, owner) {
  const rows = parseDelimited(text);
  if (rows.length < 2) return { error: "The file looks empty." };
  const header = rows[0].map(colKey);
  const idx = {};
  for (const [field, names] of Object.entries(CT_COLUMNS)) {
    idx[field] = names.map((n) => header.indexOf(n)).filter((i) => i >= 0);
  }
  if (!idx.name.length && !idx.producer.length) {
    return { error: `This doesn't look like a CellarTracker export: there's no “Wine” column. Columns found: ${rows[0].join(", ")}.` };
  }
  const get = (r, field) => {
    for (const i of idx[field]) { const v = (r[i] ?? "").trim(); if (v) return v; }
    return "";
  };
  const used = new Set(Object.values(idx).flat());
  const grouped = new Map();
  for (const r of rows.slice(1)) {
    const name = get(r, "name") || [get(r, "producer"), get(r, "designation"), get(r, "vineyard")].filter(Boolean).join(" ");
    if (!name) continue;
    let vintage = parseInt(get(r, "vintage"), 10);
    vintage = vintage >= 1800 && vintage <= 2100 ? vintage : null; // CellarTracker writes 1001 for non-vintage
    const size_ml = ctSize(get(r, "size"));
    const key = `${fold(name)}|${vintage}|${size_ml}`; // the "Individual Bottles" view has one row per bottle
    const qty = num(get(r, "quantity")) ?? 1;
    if (grouped.has(key)) { grouped.get(key).quantity += qty; continue; }
    grouped.set(key, {
      id: `cellar-${slug(owner)}-${grouped.size + 1}`,
      kind: "cellar",
      owner,
      source: `${owner}'s cellar`,
      name: vintage && !name.includes(String(vintage)) ? `${name} ${vintage}` : name,
      vintage,
      producer: get(r, "producer") || null,
      region_or_grape: get(r, "region") || null,
      varietal: get(r, "varietal") || null,
      country: get(r, "country") || "Country not stated",
      type: ctType(get(r, "colour"), get(r, "category"), get(r, "type")),
      size_ml,
      pack: 1,
      quantity: qty,
      price: num(get(r, "price")),
      my_score: scoreOf(get(r, "my")),
      ct_score: scoreOf(get(r, "ct")),
      drink_from: parseInt(get(r, "drinkFrom"), 10) || null,
      drink_to: parseInt(get(r, "drinkTo"), 10) || null,
      location: [get(r, "location"), get(r, "bin")].filter(Boolean).join(", ") || null,
      notes: get(r, "notes") || null,
    });
  }
  const wines = [...grouped.values()];
  if (!wines.length) return { error: "No wines found in the file." };
  return {
    wines,
    used: rows[0].filter((_, i) => used.has(i)),
    unused: rows[0].filter((_, i) => !used.has(i) && rows[0][i].trim()),
  };
}

async function readFileText(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // Older exports may be Windows-1252; accents would come out as "\uFFFD".
  return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

let mwFile = null;

async function importCellarFile(file) {
  mwFile = file;
  const owner = $("mw-owner").value.trim();
  const box = $("mw-preview");
  box.hidden = false;
  if (!owner) {
    box.innerHTML = `<p class="big">Whose cellar is this?</p>
      <div class="typed-row"><input type="text" id="mw-owner2" autocomplete="off" placeholder="a first name, for example Alex">
      <button type="button" class="btn btn-primary" data-action="mw-owner-go">Continue</button></div>`;
    $("mw-owner2").focus();
    return;
  }
  const res = readCellar(await readFileText(file), owner);
  if (res.error) { box.innerHTML = `<p><strong>Couldn't read that file.</strong> ${esc(res.error)}</p>`; mwPending = null; return; }
  mwPending = { owner, file: file.name, wines: res.wines };
  const bottles = res.wines.reduce((n, w) => n + (w.quantity || 0), 0);
  const scored = res.wines.filter((w) => w.my_score != null).length;
  const ct = res.wines.filter((w) => w.ct_score != null).length;
  const replacing = myWines.cellars[owner] ? ` This replaces the ${myWines.cellars[owner].wines.length} wines imported before.` : "";
  box.innerHTML = `<p class="big">${esc(owner)}'s cellar: ${res.wines.length} wines (${bottles} bottles)</p>
    <p>${scored} have ${esc(owner)}'s own score, and ${ct} have the CellarTracker community score.${esc(replacing)}</p>
    <p class="hint">Columns used: ${esc(res.used.join(", "))}.${res.unused.length ? ` Not used: ${esc(res.unused.join(", "))}.` : ""}</p>
    <ul class="mw-sample">${res.wines.slice(0, 3).map((w) => `<li>${esc(w.name)} · ${esc(w.country)}</li>`).join("")}</ul>
    <p class="dialog-actions">
      <button type="button" class="btn btn-primary" data-action="mw-confirm">Save ${esc(owner)}'s cellar</button>
      <button type="button" class="btn" data-action="mw-cancel-import">Cancel</button>
    </p>`;
}

function confirmImport() {
  if (!mwPending) return;
  const { owner, file, wines } = mwPending;
  myWines.cellars[owner] = { imported: new Date().toISOString().slice(0, 10), file, wines };
  mwPending = null;
  $("mw-preview").hidden = true;
  $("mw-file").value = "";
  if (saveMyWines()) mwStatus(`Saved ${owner}'s cellar: ${wines.length} wines.` + (storeGet(STORE.ghKey, "")
    ? ` To show it to the whole family, press “Share ${owner}'s cellar with the family” below.` : ""));
  cellarsChanged();
  mwView.owner = owner;
  renderMyWines();
}

function removeCellar(owner) {
  if (!window.confirm(`Remove your private copy of ${owner}'s cellar (${myWines.cellars[owner].wines.length} wines) from this computer?\n\n` +
    `The family keeps the shared copy on the website; only the bottle counts and bin locations go from your screen.`)) return;
  delete myWines.cellars[owner];
  cellarsChanged();
  mwView.owner = "all";
  saveMyWines();
  renderMyWines();
}

function saveManual(e) {
  e.preventDefault();
  const name = $("mw-name").value.trim();
  if (!name) return;
  const id = $("mw-edit-id").value || `manual-${Date.now()}`;
  const vintage = parseInt($("mw-vintage").value, 10) || null;
  const w = {
    id, kind: "manual", owner: null,
    source: $("mw-where").value.trim() || "Added by hand",
    name, vintage,
    country: $("mw-country").value.trim() || "Country not stated",
    type: "Other", size_ml: 750, pack: 1,
    price: num($("mw-price").value),
    notes: $("mw-notes").value.trim() || null,
  };
  const i = myWines.manual.findIndex((x) => x.id === id);
  if (i >= 0) myWines.manual[i] = w; else myWines.manual.push(w);
  saveMyWines();
  mwStatus(i >= 0 ? `Updated “${name}”.` : `Added “${name}”.`);
  if (i < 0) mwView.owner = "all"; // show the new wine, whatever list was being viewed
  clearManualForm();
  renderMyWines();
}

function editManual(id) {
  const w = myWines.manual.find((x) => x.id === id);
  if (!w) return;
  $("mw-edit-id").value = w.id;
  $("mw-name").value = w.name;
  $("mw-where").value = w.source === "Added by hand" ? "" : w.source;
  $("mw-vintage").value = w.vintage ?? "";
  $("mw-country").value = w.country === "Country not stated" ? "" : w.country;
  $("mw-price").value = w.price ?? "";
  $("mw-notes").value = w.notes ?? "";
  $("mw-save").textContent = "Save changes";
  $("mw-cancel").hidden = false;
  $("mw-add-h").scrollIntoView({ block: "start" });
  $("mw-name").focus({ preventScroll: true });
}

function clearManualForm() {
  $("mw-form").reset();
  $("mw-edit-id").value = "";
  $("mw-save").textContent = "Add this wine";
  $("mw-cancel").hidden = true;
}

function deleteManual(id) {
  const w = myWines.manual.find((x) => x.id === id);
  if (!w || !window.confirm(`Delete “${w.name}” from My wines?`)) return;
  myWines.manual = myWines.manual.filter((x) => x.id !== id);
  saveMyWines();
  renderMyWines();
}

const MW_SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  my: (a, b) => (b.my_score ?? -1) - (a.my_score ?? -1) || a.name.localeCompare(b.name),
  ct: (a, b) => (b.ct_score ?? -1) - (a.ct_score ?? -1) || a.name.localeCompare(b.name),
  vintage: (a, b) => (a.vintage ?? 9999) - (b.vintage ?? 9999) || a.name.localeCompare(b.name),
  drink: (a, b) => (a.drink_to ?? 9999) - (b.drink_to ?? 9999) || a.name.localeCompare(b.name),
};

function mwRow(w) {
  const on = shortlist.some((s) => s.id === w.id);
  const facts = [w.country, w.region_or_grape, w.varietal, w.type !== "Other" ? w.type : null,
    w.size_ml && w.size_ml !== 750 ? sizeText(w) : null].filter(Boolean).map(esc).join(" · ");
  const scores = [w.my_score != null ? `${esc(w.owner)}'s score <strong>${w.my_score}</strong>` : null,
    w.ct_score != null ? `CellarTracker community <strong>${+w.ct_score.toFixed(1)}</strong>` : null].filter(Boolean).join(" · ");
  const drink = w.drink_from || w.drink_to ? `Drink ${w.drink_from ?? "now"}–${w.drink_to ?? "?"}` : "";
  const where = w.kind === "cellar"
    ? `${esc(w.source)}${w.quantity ? ` · ${w.quantity} ${w.quantity === 1 ? "bottle" : "bottles"}` : ""}${w.location ? ` · ${esc(w.location)}` : ""}`
    : `${esc(w.source)}${w.price != null ? ` · ${money(w.price)}` : ""}`;
  const manualButtons = w.kind === "manual"
    ? `<button type="button" class="btn" data-action="mw-edit" data-id="${esc(w.id)}">Edit</button>
       <button type="button" class="btn btn-danger" data-action="mw-delete" data-id="${esc(w.id)}">Delete</button>` : "";
  const title = w.vintage && !w.name.includes(String(w.vintage)) ? `${w.name} ${w.vintage}` : w.name;
  return `<li class="mw-row">
    <div class="sl-name">${esc(title)}</div>
    <div>${where}</div>
    ${facts ? `<div>${facts}</div>` : ""}
    ${scores || drink ? `<div class="mw-scores">${[scores, esc(drink)].filter(Boolean).join(" · ")}</div>` : ""}
    ${w.notes ? `<div class="hint">${esc(w.notes)}</div>` : ""}
    <div class="wine-actions">
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>
      <button type="button" class="btn btn-ew" data-action="mw-where" data-id="${esc(w.id)}">Where can I buy it?</button>
      <a class="btn ext btn-ct" href="${cellarTrackerUrl(w)}" target="_blank" rel="noopener">CellarTracker</a>
      ${manualButtons}
    </div>
  </li>`;
}

function renderMyWines() {
  const all = allMyWines();
  const owners = Object.entries(myWines.cellars);
  const shared = visibleShared();
  const keeper = !!storeGet(STORE.ghKey, "");
  const chip = (value, label, n) => `<button type="button" class="btn btn-mini" data-action="mw-owner" data-owner="${esc(value)}"
      aria-pressed="${mwView.owner === value}">${esc(label)} (${n})</button>`;
  const mini = (action, data, label, cls = "") => `<button type="button" class="btn btn-mini ${cls}" data-action="${action}" ${data}>${esc(label)}</button>`;
  $("mw-owners").innerHTML = all.length ? chip("all", "All", all.length) +
    owners.map(([o, c]) => chip(o, `${o}'s cellar`, c.wines.length)).join("") +
    shared.map(([slot, c]) => chip(cellarLabel(slot), `${cellarTitle(slot)} (shared)`, (c.wines || []).length)).join("") +
    (myWines.manual.length ? chip("manual", "Added by hand", myWines.manual.length) : "") +
    `<span class="mw-owner-tools">` +
    (mwView.open ? mini("mw-hide", "", "Hide the wines") : "") +
    shared.map(([slot]) => mini("mw-name-cellar", `data-slot="${esc(slot)}"`, cellarNames()[slot] ? `Rename ${cellarTitle(slot)}` : `Name ${cellarTitle(slot)}`)).join("") +
    (keeper ? owners.map(([o]) => mini("mw-share", `data-owner="${esc(o)}"`,
      slotFor(o) ? `Update the shared copy of ${o}'s cellar` : `Share ${o}'s cellar with the family`, "btn-share")).join("") : "") +
    (keeper ? Object.keys(sharedCellars).map((slot) => mini("mw-unshare", `data-slot="${esc(slot)}"`, `Take ${cellarTitle(slot)} off the website`, "btn-danger")).join("") : "") +
    owners.map(([o]) => mini("mw-remove", `data-owner="${esc(o)}"`, `Remove my private copy of ${o}'s cellar`, "btn-danger")).join("") +
    `</span>`
    : "";
  const words = fold(mwView.q).split(/\s+/).filter(Boolean);
  const list = all.filter((w) => {
    if (mwView.owner === "manual" && w.kind !== "manual") return false;
    if (mwView.owner !== "all" && mwView.owner !== "manual" && w.owner !== mwView.owner) return false;
    const s = fold([w.name, w.producer, w.region_or_grape, w.varietal, w.country, w.source].filter(Boolean).join(" "));
    return words.every((t) => s.includes(t));
  }).sort(MW_SORTS[mwView.sort]);
  $("mw-list-h").textContent = all.length ? `${list.length.toLocaleString()} ${list.length === 1 ? "wine" : "wines"}` : "No wines yet";
  if (all.length && !mwView.open && !mwView.q) { // a cellar can be hundreds of wines: list them only when asked
    $("mw-list").innerHTML = `<li class="empty">Press a cellar's button above, or search, to see its wines.</li>`;
    $("mw-more").hidden = true;
    return;
  }
  $("mw-list").innerHTML = list.slice(0, mwView.shown).map(mwRow).join("") ||
    (all.length ? `<li class="empty">No wines match.</li>` : `<li class="empty">Import a cellar or add a wine above.</li>`);
  $("mw-more").hidden = list.length <= mwView.shown;
  $("mw-more").textContent = `Show more (${(list.length - mwView.shown).toLocaleString()} not shown yet)`;
}

function mwWhereCanIBuy(id) {
  const w = allMyWines().find((x) => x.id === id);
  if (!w) return;
  showView("shortlist");
  const input = document.querySelector("#ew-top .ew-q");
  input.value = storeSearchWords(w);
  updateElsewhere(input.closest(".elsewhere"));
  $("ew-h").scrollIntoView({ block: "start" });
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify({ app: "wine-finder", saved: new Date().toISOString(), myWines, ratings }, null, 1)],
    { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `my-wines-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  mwStatus("Backup file saved (look in your Downloads folder).");
}

async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const mw = data.myWines || data;
    if (!mw || typeof mw.cellars !== "object" || !Array.isArray(mw.manual)) throw new Error("not a backup");
    const n = Object.values(mw.cellars).reduce((k, c) => k + c.wines.length, 0) + mw.manual.length;
    const nr = data.ratings && typeof data.ratings === "object" ? Object.keys(data.ratings).length : 0;
    if (!window.confirm(`Replace My wines with the ${n} wines${nr ? ` and ${nr} ratings` : ""} in this backup?`)) return;
    myWines = { cellars: mw.cellars, manual: mw.manual };
    saveMyWines();
    cellarsChanged();
    if (nr) { ratings = data.ratings; saveRatings(); }
    mwView.owner = "all";
    renderMyWines();
    mwStatus(`Restored ${n} wines from the backup.`);
  } catch {
    mwStatus("That file isn't a My wines backup.");
  } finally {
    $("mw-restore").value = "";
  }
}

function wireMyWines() {
  $("mw-file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importCellarFile(f); });
  $("mw-form").addEventListener("submit", saveManual);
  $("mw-cancel").addEventListener("click", clearManualForm);
  $("mw-q").addEventListener("input", debounce(() => { mwView.q = $("mw-q").value; mwView.shown = MW_PAGE; renderMyWines(); }, 200));
  $("mw-sort").addEventListener("change", () => { mwView.sort = $("mw-sort").value; mwView.shown = MW_PAGE; renderMyWines(); });
  $("mw-more").addEventListener("click", () => { mwView.shown += MW_PAGE; renderMyWines(); });
  $("mw-backup").addEventListener("click", downloadBackup);
  $("mw-restore").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) restoreBackup(f); });
}

// ---- Ratings: "Claude's rating" and "Your rating" (points out of 100) -----------------
// Kept on this computer (localStorage) and in the backup file. Claude's rating arrives
// through a "save" link at the end of Claude's answer; it is Claude's own overall
// judgement after reading reviews, never a copy of a critic's score (critics' terms
// forbid compiling their scores; see Design/CLAUDE.md §11).
let ratings = {};

function loadRatings() {
  const r = storeGet(STORE.ratings, {});
  ratings = r && typeof r === "object" && !Array.isArray(r) ? r : {};
}
function saveRatings() { storeSet(STORE.ratings, ratings); }
const ratingOf = (id) => ratings[id] || {};
const todayIso = () => new Date().toISOString().slice(0, 10);
const shortDate = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

function ratingsHtml(w) {
  const r = ratingOf(w.id), f = frOf(w.id), parts = [frHtml(w)].filter(Boolean);
  // the same score saved here and published (the published copy also says who ran it)
  const same = (a, b) => b && ["points", "vintage", "note", "quick", "date"].every((k) => (a[k] ?? null) === (b[k] ?? null)) &&
    (a.family == null || JSON.stringify(a) === JSON.stringify(b));
  if (r.claude && !same(r.claude, f.claude)) {
    const c = r.claude;
    parts.push(`${c.quick ? `<button type="button" class="rating rating-claude rating-quick quick-btn" data-quick="${esc(w.id)}" data-quick-src="own" aria-label="Claude quick score ${c.points ?? ""}: show the details">` : `<span class="rating rating-claude">`}` +
      `Claude <strong>${c.points ?? "found no reviews"}</strong>${c.quick ? " (Quick Score Only)" : ""}` +
      `${c.vintage ? ` (${esc(String(c.vintage))})` : ""}${c.note ? ` · ${esc(c.note)}` : ""}` +
      ` <span class="rating-date">${esc(shortDate(c.date))}</span>${c.quick ? `<span class="quick-more">ⓘ Details</span></button>` : "</span>"}` +
      (!c.quick && styleText(c) ? `<span class="rating rating-style">${esc(styleText(c))}</span>` : ""));
  }
  if (r.mine && !same(r.mine, f.family)) {
    parts.push(`<span class="rating rating-mine">My rating <strong>${r.mine.points}</strong>` +
      `${r.mine.note ? ` · ${esc(r.mine.note)}` : ""}</span>`);
  }
  return parts.length ? `<p class="wine-ratings">${parts.join("")}</p>` : "";
}

function rateButton(w) {
  const mine = ratingOf(w.id).mine;
  return `<button type="button" class="btn btn-rate" data-rate="${esc(w.id)}" aria-expanded="false">${mine
    ? `Your rating: ${mine.points}` : "☆ Your rating"}</button>`;
}

function toggleRatePanel(btn) {
  const host = btn.closest(".wine, li");
  const open = host.querySelector(".rate-panel");
  if (open) { open.remove(); btn.setAttribute("aria-expanded", "false"); return; }
  const id = btn.dataset.rate;
  const mine = ratingOf(id).mine || {};
  const panel = document.createElement("div");
  panel.className = "rate-panel";
  panel.innerHTML = `<div class="rate-row">
      <label>Your rating, out of 100<input type="number" class="rate-points" inputmode="numeric" min="50" max="100" value="${mine.points ?? ""}" placeholder="e.g. 88"></label>
      <label class="rate-note-label">Note (optional)<input type="text" class="rate-note" maxlength="80" value="${esc(mine.note || "")}" placeholder="e.g. lovely with lamb"></label>
    </div>
    <p class="hint">Most wines worth buying score between 80 and 95.</p>
    <p class="rate-msg" role="status"></p>
    <div class="rate-row">
      <button type="button" class="btn btn-primary" data-rate-save="${esc(id)}">Save my rating</button>
      ${mine.points ? `<button type="button" class="btn btn-danger" data-rate-clear="${esc(id)}">Remove my rating</button>` : ""}
    </div>`;
  host.appendChild(panel);
  btn.setAttribute("aria-expanded", "true");
  panel.querySelector(".rate-points").focus();
}

function refreshRatedViews() {
  ratingsVer++;
  if (!$("view-shortlist").hidden) renderShortlist();
  else if (!$("view-find").hidden) renderResults();
}

function saveMyRating(id, btn) {
  const panel = btn.closest(".rate-panel");
  const points = parseInt(panel.querySelector(".rate-points").value, 10);
  if (!(points >= 50 && points <= 100)) {
    panel.querySelector(".rate-msg").textContent = "Please enter a number from 50 to 100.";
    panel.querySelector(".rate-points").focus();
    return;
  }
  const w = findWine(id);
  ratings[id] = { ...ratingOf(id), name: w?.name || ratingOf(id).name || id,
    mine: { points, note: panel.querySelector(".rate-note").value.trim().slice(0, 80) || null, date: todayIso() } };
  saveRatings();
  refreshRatedViews();
}

function clearMyRating(id) {
  const r = { ...ratingOf(id) };
  delete r.mine;
  if (r.claude) ratings[id] = r; else delete ratings[id];
  saveRatings();
  refreshRatedViews();
}

// The style Claude gives with a quick score: BODY~TANNIN~SWEET~DRINK, each checked
// against its few allowed words (anything else is dropped rather than guessed).
const CR_STYLE = { body: ["light", "medium", "full"], tannin: ["soft", "medium", "firm"], sweet: SWEET_LEVELS };
function readStyle([body = "", tannin = "", sweet = "", drink = "", fruit = "", finish = "", pair = "", grapes = ""]) {
  const pick = (v, list) => (list.includes(v.toLowerCase()) ? v.toLowerCase() : null);
  const out = { body: pick(body, CR_STYLE.body), tannin: pick(tannin, CR_STYLE.tannin), sweet: pick(sweet.replace(/\s+/g, "-"), CR_STYLE.sweet) };
  const m = /^((?:19|20)\d\d)\s*[-–]\s*((?:19|20)\d\d)$/.exec(drink);
  if (m && +m[1] <= +m[2]) { out.drinkFrom = +m[1]; out.drinkTo = +m[2]; }
  if (/^(yes|no)$/i.test(fruit.trim())) out.fruity = /^yes$/i.test(fruit.trim());
  if (/^(short|medium|long)$/i.test(finish.trim())) out.finish = finish.trim().toLowerCase();
  pair = pair.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  if (pair.length > 2) out.pair = pair.slice(0, 90);
  grapes = grapes.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  if (grapes.length > 2) out.grapes = grapes.slice(0, 60);
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}

// "full-bodied, soft tannins, dry · drink 2024–2030"
function styleText(c) {
  if (!c) return "";
  const bits = [c.body && `${c.body}-bodied`, c.tannin && `${c.tannin} tannins`, c.sweet, c.fruity && "fruit-forward", c.finish && `${c.finish} finish`].filter(Boolean).join(", ");
  const drink = c.drinkFrom ? `drink ${c.drinkFrom}–${c.drinkTo}` : "";
  return [bits, drink, c.pair && `best with ${c.pair}`].filter(Boolean).join(" · ");
}

// Every wine code a link may carry: a store listing, a family cellar wine, or one added by hand or by name.
const WINE_CODE = /^(bcl|bsw|zyn|luc|wsh|lcbo|cellar|manual|typed)-[\w.-]{1,80}$/;

// The link Claude makes: <page>#save=CODE~POINTS~VINTAGE~NOTE;CODE~... (#scores= for quick scores)
// It comes from Claude's answer, so every field is checked and nothing is saved
// until the person presses "Save these ratings".
function parseSaveHash(hash) {
  const m = /^#(save|scores)=([\s\S]*)$/.exec(hash || "");
  if (!m) return parseShareHash(hash);
  const quick = m[1] === "scores"; // quick scores: no write-up to keep
  let raw = m[2].replace(/\+/g, " ");
  try { raw = decodeURIComponent(raw); } catch { /* keep as is */ }
  const items = [];
  for (const part of raw.split(";")) {
    const [code = "", pts = "", vin = "", ...rest] = part.split("~").map((s) => s.trim());
    if (!WINE_CODE.test(code)) continue;
    const style = quick ? readStyle(rest.slice(1)) : {};
    const n = parseInt(pts, 10);
    const points = /^\d{2,3}$/.test(pts) && n >= 50 && n <= 100 ? n : null;
    if (pts && points === null) continue; // a score we can't trust: skip rather than guess
    items.push({
      id: code,
      points,
      vintage: /^(19|20)\d\d$/.test(vin) ? +vin : /^nv$/i.test(vin) ? "NV" : null,
      note: (quick ? rest[0] || "" : rest.join(" ")).replace(/\s+/g, " ").slice(0, 80) || null,
      ...(quick ? { quick: true, ...style } : {}),
    });
  }
  return items;
}

// A link emailed by family (see emailRatings): Claude's and their own ratings, plus the name.
function parseShareHash(hash) {
  const m = /^#share=([\s\S]*)$/.exec(hash || "");
  if (!m) return null;
  let raw = m[1].replace(/\+/g, " ");
  try { raw = decodeURIComponent(raw); } catch { /* keep as is */ }
  const score = (s) => { const n = parseInt(s, 10); return /^\d{2,3}$/.test(s) && n >= 50 && n <= 100 ? n : null; };
  const items = [];
  for (const part of raw.split(";")) {
    const [code = "", cp = "", vin = "", cnote = "", mp = "", mnote = "", name = ""] = part.split("~").map((s) => s.trim());
    if (!WINE_CODE.test(code)) continue;
    const claudeOk = cp === "" || score(cp) !== null, mine = score(mp);
    if (!claudeOk) continue;
    const hasClaude = cp !== "" || cnote !== "" || vin !== "";
    if (!hasClaude && mine === null) continue;
    items.push({
      id: code, shared: true,
      points: score(cp),
      claude: hasClaude,
      vintage: /^(19|20)\d\d$/.test(vin) ? +vin : /^nv$/i.test(vin) ? "NV" : null,
      note: cnote.slice(0, 80) || null,
      mine: mine === null ? null : { points: mine, note: mnote.slice(0, 80) || null },
      name: name.slice(0, 60) || null,
    });
  }
  return items;
}

let pendingSave = null;
let pendingHash = "";   // the save link that opened the box: the copied answer must contain it
let writeupText = "";   // Claude's whole answer, once found

function offerSavedRatings() {
  const items = parseSaveHash(location.hash);
  if (!items) return;
  pendingHash = location.hash;
  history.replaceState(history.state, "", location.pathname + location.search); // don't offer it again on reload
  pendingSave = items;
  const shared = items.some((it) => it.shared), quick = items.some((it) => it.quick);
  const nameOf = (it) => findWine(it.id)?.name || (sharedIdOf(it.id) && findWine(sharedIdOf(it.id))?.name) || ratingOf(it.id).name || it.name;
  const n = `${items.length} ${items.length === 1 ? "wine" : "wines"}`;
  $("save-q").textContent = !items.length ? "This link didn't contain any ratings that could be read."
    : shared ? `Ratings emailed from family for ${n}. Save them?` : quick ? `Save Claude's scores for ${n}?` : `Save Claude's ratings for ${n}?`;
  $("save-list").innerHTML = items.map((it) => `<li><strong>${esc(nameOf(it) || `Wine ${it.id} (not found on this computer)`)}</strong>` +
    (it.claude === false ? "" : `<br>Claude's ${it.quick ? "score" : "rating"}: <strong>${it.points ?? "no reviews found"}</strong>${it.vintage ? ` (${esc(String(it.vintage))})` : ""}${it.note ? ` · ${esc(it.note)}` : ""}` +
      (styleText(it) ? `<br><span class="hint">${esc(styleText(it))}</span>` : "")) +
    (it.mine ? `<br>Family member's own rating: <strong>${it.mine.points}</strong>${it.mine.note ? ` · ${esc(it.mine.note)}` : ""}` : "") +
    `</li>`).join("");
  $("save-help").hidden = items.length > 0;
  $("save-yes").hidden = items.length === 0;
  $("save-yes").textContent = "Save";
  $("save-yes").dataset.done = "";
  $("save-no").hidden = false;
  $("save-result").innerHTML = "";
  $("save-writeup").hidden = items.length === 0 || shared || quick;
  $("save-writeup-text").value = "";
  writeupText = "";
  $("save-name-row").hidden = !!myName();
  $("save-dialog").showModal?.();
  if (!$("save-writeup").hidden) { showWriteupState(); checkWriteup(); }
  // Quick scores from Claude save straight away: clicking Claude's save link was the
  // confirmation. (The first time, the box still asks for a first name.)
  if (quick && !shared && items.length && myName()) {
    $("save-q").textContent = `Saving Claude's scores for ${n}…`;
    confirmSavedRatings().then(() => { $("save-q").textContent = `Claude's scores for ${n}`; });
  }
}

async function confirmSavedRatings() {
  if ($("save-yes").dataset.done) { $("save-dialog").close(); return; } // the button now says Close
  const items = pendingSave || [];
  if (!items.length) return;
  if (!myName()) {
    const n = $("save-name").value.trim();
    if (!n) { $("save-result").textContent = "Please type your first name first."; $("save-name").focus(); return; }
    storeSet(STORE.myName, n.slice(0, 30));
  }
  const ids = items.map((it) => it.id);
  if (!$("save-writeup").hidden && !writeupText) { showWriteupState(); return; } // Save isn't shown then, but just in case
  const text = writeupText;
  const parts = text ? splitWriteup(text, ids) : {};
  const today = todayIso(), from = myName(), notes = localNotes();
  const send = [];
  for (const it of items) {
    if (!findWine(it.id) && sharedIdOf(it.id) && sharedIdOf(it.id) !== it.id) it.id = sharedIdOf(it.id);
    const real = (n) => (n && n !== it.id ? n : null); // an earlier save may have stored the code as the name
    const name = findWine(it.id)?.name || real(ratingOf(it.id).name) || it.name || real(frOf(it.id).name) ||
      (it.id.startsWith("typed-") ? it.id.slice(6).replace(/-/g, " ") : it.id); // a typed wine's code is its name
    const r = { ...ratingOf(it.id), name };
    const style = Object.fromEntries(["body", "tannin", "sweet", "fruity", "finish", "pair", "grapes", "drinkFrom", "drinkTo"].filter((k) => it[k] != null).map((k) => [k, it[k]]));
    const claude = it.claude !== false ? { points: it.points, vintage: it.vintage, note: it.note, date: today, ...(it.quick ? { quick: true, ...style } : {}) } : null;
    const mine = it.mine ? { ...it.mine, date: today } : null;
    if (claude) r.claude = claude;
    if (mine) r.mine = mine;
    ratings[it.id] = r;
    const writeup = parts[it.id] || parts[ids[items.indexOf(it)]] || "";
    if (writeup) notes[it.id] = { name, from, date: today, text: writeup };
    send.push({ id: sharedIdOf(it.id) || it.id, name, claude, mine, writeup, from, date: today });
  }
  saveRatings();
  storeSet(STORE.notes, notes);
  if (items.some((it) => quickMarks.delete(it.id))) saveQuickMarks(); // their quick scores are in
  pendingSave = null;
  const nNotes = Object.keys(parts).length;
  const quick = items.some((it) => it.quick);
  const gotText = quick ? "Your list is now sorted best rated first." : nNotes ? `Claude's write-up kept for ${nNotes} ${nNotes === 1 ? "wine" : "wines"}.` : "No write-up was found, so only the ratings were saved.";
  if (quick) { // show the scored list straight away: best scored first, then by price
    state.sorts = ["best-desc", "", ""];
    state.shown = PAGE_SIZE;
    renderSorts();
  }
  $("save-yes").disabled = true;
  $("save-result").textContent = "Saving…";
  try {
    if (isKeeper()) {
      await publishResearch(send);
      $("save-result").innerHTML = `<strong>Saved and published ✓</strong> ${esc(gotText)} Everyone sees it after reloading.`;
    } else {
      await sendToInbox(send, from);
      $("save-result").innerHTML = `<strong>Saved ✓</strong> — also sent to the website keeper for the family site. ${esc(gotText)}`;
    }
  } catch (e) {
    $("save-result").innerHTML = `<strong>Saved on this computer ✓</strong> ${esc(gotText)} But it couldn't be ${isKeeper() ? "published" : "sent on"} (${esc(e.message)}).
      <button type="button" class="btn" id="save-email-fallback">Email it instead</button>`;
  } finally {
    $("save-yes").disabled = false;
  }
  $("save-yes").textContent = "Close";
  $("save-yes").dataset.done = "1";
  $("save-no").hidden = $("save-howto").hidden = true;
  refreshRatedViews();
}

function scrollToFamilyBox() { document.querySelector(".fr-box")?.scrollIntoView({ block: "start" }); }

// ---- Emailing ratings to the family ----------------------------------------------
// Anyone can email the ratings on their computer (Claude's and their own) as one link:
// <page>#share=CODE~CLAUDE~VINTAGE~CLAUDENOTE~MINE~MYNOTE~NAME;...
// The website keeper clicks it, saves, and publishes them as Family ratings.
const shareClean = (s, max) => String(s ?? "").replace(/[~;\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// Wines in a computer's own cellar copy have the owner's name in their code, so their
// ratings stay on that computer (the shared copy's wines, cellar-c1-…, can be rated).
const privateId = (id) => /^cellar-/.test(id) && !/^cellar-c\d+-/.test(id);

// A private cellar code (cellar-jon-154) -> the same wine in the shared copy (cellar-c1-154),
// matched by name and vintage, so its ratings can be published. null if it isn't shared.
const sharedIdCache = new Map();
function sharedIdOf(id) {
  if (!privateId(id)) return id;
  if (sharedIdCache.has(id)) return sharedIdCache.get(id);
  let out = null;
  const key = (w) => `${fold(w.name)}|${w.vintage ?? ""}`;
  const local = Object.values(myWines.cellars).flatMap((c) => c.wines).find((w) => w.id === id);
  if (local) {
    const own = slotFor(local.owner); // the owner's shared copy first, then any other
    for (const slot of [own, ...Object.keys(sharedCellars)].filter(Boolean)) {
      const hit = (sharedCellars[slot]?.wines || []).find((w) => key(w) === key(local));
      if (hit) { out = hit.id; break; }
    }
  } else { // not on this computer: use the cellar this computer has named after the owner
    const m = /^cellar-(.+)-(\d+)$/.exec(id);
    const slot = m && Object.keys(sharedCellars).find((s) => slug(cellarNames()[s] || "") === m[1]);
    if (slot && (sharedCellars[slot].wines || []).some((w) => w.id === `cellar-${slot}-${m[2]}`)) out = `cellar-${slot}-${m[2]}`;
  }
  sharedIdCache.set(id, out);
  return out;
}

function unpublishedIds() {
  return Object.keys(ratings).filter((id) => !privateId(id) || sharedIdOf(id)).filter((id) => {
    const r = ratings[id], f = frOf(id);
    return (r.claude && JSON.stringify(r.claude) !== JSON.stringify(f.claude)) ||
      (r.mine && JSON.stringify(r.mine) !== JSON.stringify(f.family));
  });
}

function shareLink(ids) {
  const entries = ids.map((id) => {
    const r = ratingOf(id), c = r.claude || {}, m = r.mine || {};
    const name = findWine(id)?.name || r.name || "";
    return [id, c.points ?? "", c.vintage ?? "", shareClean(c.note, 80), m.points ?? "", shareClean(m.note, 80),
      shareClean(name, 60)].join("~");
  });
  return location.href.split("#")[0].split("?")[0] + "#share=" + encodeURIComponent(entries.join(";")).replace(/%20/g, "+");
}

function emailRatings() {
  const ids = unpublishedIds();
  if (!ids.length) { frStatus("There are no new ratings on this computer to send."); return; }
  const link = shareLink(ids);
  const lines = ids.map((id) => {
    const r = ratingOf(id), bits = [];
    if (r.claude) bits.push(`Claude ${r.claude.points ?? "no reviews"}${r.claude.vintage ? ` (${r.claude.vintage})` : ""}`);
    if (r.mine) bits.push(`mine ${r.mine.points}`);
    return `- ${findWine(id)?.name || r.name || id}: ${bits.join(", ")}`;
  });
  const subject = `Wine ratings for the family Wine Finder (${ids.length} ${ids.length === 1 ? "wine" : "wines"})`;
  const head = "Here are my wine ratings from Basil's Wine Finder.\n\n";
  const tail = `\n\nClick this link to add them to the Wine Finder:\n${link}\n`;
  let body = head + lines.join("\n") + tail;
  if (body.length > 1700) body = head.trim() + tail; // long lists: the link alone carries everything
  sendEmail(subject, body, frStatus);
}


// ---- Family ratings (FR): ratings published to the website for everyone -------------
// data/ratings.json in the repository, read by every visitor's page. Only someone with
// write access to the repository can publish: either one click with a GitHub key kept
// in that person's own browser (never in this code), or by downloading the file and
// uploading it on GitHub. The file is public, so it holds wine codes, points, vintages
// and short notes, never people's names.
const PUBLISH = { owner: "mikemeddings", repo: "wine-finder", path: "data/ratings.json", branch: "main" };
let familyRatings = {};
const frOf = (id) => familyRatings[id] || (privateId(id) && familyRatings[sharedIdOf(id)]) || {};
const claudeScore = (w) => ratingOf(w.id).claude?.points ?? frOf(w.id).claude?.points ?? null;

// The same wine rated under another listing (another store, a cellar, a name typed in),
// found by name once per wine. Only the few rated names are compared, each first by its
// longest word, so this stays quick across every store.
let ratingsVer = 0; // goes up whenever ratings change, so the answers below are worked out again
let ratedNames = [], ratedNamesVer = "";
function ratedTwin(w) {
  const ver = `${Object.keys(familyRatings).length}:${ratingsVer}`;
  if (ratedNamesVer !== ver) {
    ratedNamesVer = ver;
    ratedNames = Object.entries(familyRatings)
      .filter(([, r]) => r.name && (r.claude?.points || r.family?.points || r.claude?.body || r.claude?.drinkFrom || r.claude?.fruity != null || r.claude?.finish || r.claude?.pair))
      .map(([id, r]) => ({ id, r, key: [...storeTokens(r.name)].sort((a, b) => b.length - a.length)[0] || "" }))
      .filter((x) => x.key.length > 2);
  }
  if (w._twinVer !== ver) {
    const text = w._s ?? fold([w.name, w.producer, w.region_or_grape].filter(Boolean).join(" "));
    const twinR = [...twinIds(w)].map((id) => ratedNames.find((x) => x.id === id)).find(Boolean)?.r;
    w._twin = twinR ||
      ratedNames.find((x) => x.id !== w.id && text.includes(x.key) && sameWineName(w.name, x.r.name) &&
        (!(findWine(x.id)?.type || x.r.type) || typesAgree(w.type, findWine(x.id)?.type || x.r.type)))?.r || null;
    w._twinVer = ver;
  }
  return w._twin;
}

// "Best rated first": Claude's score (for this listing, or the same wine elsewhere), then
// CellarTracker, then the family's own. Wines on ZYN's 90+ list come after every scored
// wine (as 1), and unscored wines last.
function bestScore(w) {
  const twin = ratedTwin(w);
  return claudeScore(w) ?? twin?.claude?.points ?? w.my_score ?? w.ct_score ?? ratingOf(w.id).mine?.points ??
    frOf(w.id).family?.points ?? twin?.family?.points ?? (w.retailer_scores ? 1 : null);
}
const familyScore = (w) => { const s = bestScore(w); return s != null && s > 1 ? s : null; };
const wellRated = (w) => (familyScore(w) ?? 0) >= WELL_RATED || !!w.retailer_scores;

function frHtml(w) {
  const f = frOf(w.id), parts = [];
  if (f.claude) parts.push(`${f.claude.quick ? `<button type="button" class="rating rating-fr rating-quick quick-btn" data-quick="${esc(w.id)}" data-quick-src="fr" aria-label="Claude quick score ${f.claude.points ?? ""}: show the details">` : `<span class="rating rating-fr">`}` +
    `Claude <strong>${f.claude.points ?? "found no reviews"}</strong>${f.claude.quick ? " (Quick Score Only)" : ""}` +
    `${f.claude.vintage ? ` · ${esc(String(f.claude.vintage))}` : ""}${f.claude.note ? ` · ${esc(f.claude.note)}` : ""}` +
    `${f.claude.quick ? `<span class="quick-more">ⓘ Details</span></button>` : "</span>"}` +
    (!f.claude.quick && styleText(f.claude) ? `<span class="rating rating-style">${esc(styleText(f.claude))}</span>` : ""));
  if (f.family) parts.push(`<span class="rating rating-fr">Family <strong>${f.family.points}</strong>` +
    `${f.family.note ? ` · ${esc(f.family.note)}` : ""}</span>`);
  return parts.join("");
}

// The published file merged with this computer's ratings: newer ratings win, and
// nothing already published is removed.
function mergedForPublish(base) {
  const out = JSON.parse(JSON.stringify(base || {}));
  const newer = (a, b) => !b || (a.date || "") >= (b.date || "");
  for (const [own, r] of Object.entries(ratings)) {
    const id = sharedIdOf(own); // private cellar codes go out under the shared copy's code
    if (!id) continue;
    const e = out[id] || {};
    if (r.name) e.name = r.name;
    if (r.claude && newer(r.claude, e.claude)) e.claude = { ...r.claude };
    if (r.mine && newer(r.mine, e.family)) e.family = { ...r.mine };
    if (e.claude || e.family) out[id] = e;
  }
  return out;
}

const unpublishedCount = () => unpublishedIds().length;

const ratingsFileText = (map) => JSON.stringify({ updated: todayIso(), ratings: map }, null, 1) + "\n";
const toBase64 = (text) => { let s = ""; for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b); return btoa(s); };
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function frStatus(msg) { $("fr-status").textContent = msg; }

function renderFamilyBox() {
  const n = unpublishedCount();
  const hasKey = !!storeGet(STORE.ghKey, "");
  $("fr-count").textContent = n
    ? `${n} ${n === 1 ? "wine has" : "wines have"} ratings on this computer that aren't shared with the family yet.`
    : "Everything rated on this computer is already published (or nothing has been rated yet).";
  $("fr-publish").hidden = !hasKey;
  $("fr-email").disabled = !n;
  $("fr-publish").disabled = !n;
  $("fr-key-state").textContent = hasKey ? "A publishing key is saved on this computer." : "No publishing key on this computer.";
  $("fr-key-forget").hidden = !hasKey;
}

async function ghFetch(method, body, path = PUBLISH.path) {
  const key = storeGet(STORE.ghKey, "");
  const url = `https://api.github.com/repos/${PUBLISH.owner}/${PUBLISH.repo}/contents/${path}` +
    (method === "GET" ? `?ref=${PUBLISH.branch}&t=${Date.now()}` : "");
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) {
    const why = r.status === 401 ? "GitHub refused the key; it may have expired or been mistyped."
      : r.status === 403 || r.status === 404 ? "The key doesn't have permission to write to the wine-finder repository."
      : r.status === 409 || r.status === 422 ? "conflict"
      : `GitHub answered with error ${r.status}.`;
    throw new Error(why);
  }
  return r.json();
}

async function publishFamilyRatings() {
  $("fr-publish").disabled = true;
  frStatus("Publishing…");
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = await ghFetch("GET");
      const published = JSON.parse(fromBase64(cur.content)).ratings || {};
      const merged = mergedForPublish(published);
      try {
        await ghFetch("PUT", { message: `Family ratings (${Object.keys(merged).length} wines)`,
          content: toBase64(ratingsFileText(merged)), sha: cur.sha, branch: PUBLISH.branch });
        familyRatings = merged;
        frStatus(`Published ${Object.keys(merged).length} wines' ratings. Everyone will see them within a couple of minutes (after reloading the page).`);
        renderFamilyBox();
        return;
      } catch (e) {
        if (e.message !== "conflict" || attempt === 1) throw e; // someone published at the same moment: try once more
      }
    }
  } catch (e) {
    frStatus(`Not published. ${e.message === "conflict" ? "Please try again in a minute." : e.message}`);
  } finally {
    $("fr-publish").disabled = false;
  }
}

function downloadFamilyFile() {
  const blob = new Blob([ratingsFileText(mergedForPublish(familyRatings))], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ratings.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  frStatus("ratings.json is in your Downloads folder. Upload it to the data folder of the wine-finder repository on GitHub (it replaces the old one).");
}

function saveGhKey() {
  const key = $("fr-key").value.trim();
  if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(key)) { frStatus("That doesn't look like a GitHub key (they start with github_pat_)."); return; }
  storeSet(STORE.ghKey, key);
  $("fr-key").value = "";
  frStatus("Key saved on this computer only.");
  renderFamilyBox();
}

function forgetGhKey() {
  try { localStorage.removeItem(STORE.ghKey); } catch { /* ignore */ }
  frStatus("Key removed from this computer.");
  renderFamilyBox();
}

// ---- Shared family cellars ---------------------------------------------------------
// data/cellars.json holds the cellars the website keeper shared, trimmed for a public
// file: no prices, bin locations, private notes or bottle counts, and no owner names.
// Each cellar has a neutral key (c1, c2…) and each computer names it ("Jon") for itself.
const CELLARS_PATH = "data/cellars.json";
let sharedCellars = {};
let sharedWinesCache = null, cellarIndex = null;
const cellarMatchCache = new Map();
const cellarNames = () => { const n = storeGet(STORE.cellarNames, {}); return n && typeof n === "object" ? n : {}; };
const slotNumber = (slot) => slot.replace(/\D/g, "");
const cellarLabel = (slot) => cellarNames()[slot] || `Cellar ${slotNumber(slot)}`;
const cellarTitle = (slot) => (cellarNames()[slot] ? `${cellarNames()[slot]}'s cellar` : `Cellar ${slotNumber(slot)}`);
const slotFor = (owner) => Object.keys(sharedCellars).find((s) => fold(cellarNames()[s] || "") === fold(owner));

// Shared cellars this computer doesn't already have its own copy of.
function visibleShared() {
  const local = new Set(Object.keys(myWines.cellars).map(fold));
  return Object.entries(sharedCellars).filter(([slot]) => !local.has(fold(cellarLabel(slot))));
}

function sharedCellarWines() {
  sharedWinesCache ??= visibleShared().flatMap(([slot, c]) => (Array.isArray(c.wines) ? c.wines : [])
    .filter((w) => w && w.id && w.name)
    .map((w) => ({ ...w, kind: "cellar", owner: cellarLabel(slot), source: cellarTitle(slot), shared: slot })));
  return sharedWinesCache;
}

// Cellar wines as Find-wines rows (no price: they're already in someone's cellar).
let cellarFindCache = null;
function cellarFindWines() {
  cellarFindCache ??= allMyWines().filter((w) => w.kind === "cellar").map((w) => ({ ...w,
    country: w.country || "Country not stated",
    _s: fold([w.name, w.producer, w.region_or_grape, w.varietal].filter(Boolean).join(" ")),
    _w: words(w.name) }));
  return cellarFindCache;
}
const findPool = () => (cellarOn() ? cellarFindWines() : WINES);

function cellarsChanged() {
  placeWords = null;
  sharedIdCache.clear();
  cellarFindCache = null;
  storeMatchIndex = null;
  sharedWinesCache = null;
  cellarIndex = null;
  cellarMatchCache.clear();
  updateCellarSorts();
}

const trimForShare = (wines, slot) => wines.map((w, i) => Object.fromEntries(Object.entries({
  id: `cellar-${slot}-${i + 1}`, name: w.name, vintage: w.vintage, producer: w.producer,
  region_or_grape: w.region_or_grape, varietal: w.varietal, country: w.country, type: w.type,
  size_ml: w.size_ml, my_score: w.my_score, ct_score: w.ct_score, drink_from: w.drink_from, drink_to: w.drink_to,
}).filter(([, v]) => v != null && v !== "")));

// Read a JSON file in the repository, change it, write it back (once more if someone
// else wrote at the same moment).
async function ghUpdate(path, change, message) {
  for (let attempt = 0; ; attempt++) {
    const cur = await ghFetch("GET", null, path);
    const data = JSON.parse(fromBase64(cur.content));
    change(data);
    try {
      await ghFetch("PUT", { message, content: toBase64(JSON.stringify(data, null, 1) + "\n"), sha: cur.sha, branch: PUBLISH.branch }, path);
      return data;
    } catch (e) {
      if (e.message !== "conflict" || attempt === 1) throw e;
    }
  }
}

async function shareCellar(owner) {
  const c = myWines.cellars[owner];
  if (!c) return;
  if (!storeGet(STORE.ghKey, "")) { mwStatus("Only the person who looks after the website can share cellars (it needs the publishing key)."); return; }
  let slot = slotFor(owner);
  if (!slot) { let n = 1; while (sharedCellars[`c${n}`]) n++; slot = `c${n}`; }
  mwStatus(`Sharing ${owner}'s cellar…`);
  try {
    const data = await ghUpdate(CELLARS_PATH, (d) => {
      d.updated = todayIso();
      d.cellars = d.cellars && typeof d.cellars === "object" ? d.cellars : {};
      d.cellars[slot] = { updated: todayIso(), wines: trimForShare(c.wines, slot) };
    }, `Share a family cellar (${c.wines.length} wines)`);
    sharedCellars = data.cellars;
    storeSet(STORE.cellarNames, { ...cellarNames(), [slot]: owner });
    cellarsChanged();
    renderMyWines();
    mwStatus(`Shared ${owner}'s cellar: ${c.wines.length} wines, without prices, bin locations, notes or bottle counts. ` +
      `On the website it's called “Cellar ${slotNumber(slot)}”; each family member can name it “${owner}” on their own computer.`);
  } catch (e) {
    mwStatus(`Not shared. ${e.message === "conflict" ? "Please try again in a minute." : e.message}`);
  }
}

async function unshareCellar(slot) {
  if (!window.confirm(`Take ${cellarTitle(slot)} off the website? Nobody in the family will see it any more (copies on people's own computers stay).`)) return;
  try {
    const data = await ghUpdate(CELLARS_PATH, (d) => { if (d.cellars) delete d.cellars[slot]; d.updated = todayIso(); },
      "Stop sharing a family cellar");
    sharedCellars = data.cellars || {};
    cellarsChanged();
    mwView.owner = "all";
    renderMyWines();
    mwStatus("That cellar is no longer shared on the website.");
  } catch (e) {
    mwStatus(`Not changed. ${e.message === "conflict" ? "Please try again in a minute." : e.message}`);
  }
}

function nameCellar(slot) {
  const name = window.prompt(`Whose cellar is ${cellarTitle(slot)}? Type a first name. It's kept on this computer only.`,
    cellarNames()[slot] || "");
  if (name == null) return;
  const names = cellarNames();
  if (name.trim()) names[slot] = name.trim().slice(0, 30); else delete names[slot];
  storeSet(STORE.cellarNames, names);
  cellarsChanged();
  mwView.owner = "all";
  if (!$("view-mywines").hidden) renderMyWines(); else renderResults();
}

// ---- "In Jon's cellar" on store wines ------------------------------------------------
// Cellar names and store names are written differently, so this is a careful guess:
// every distinctive word of the store's name must appear in the cellar wine's details,
// at least two of them in its name or producer, and at least one of those must be
// neither a grape nor a place ("Cabernet Sauvignon - O-61" is not Jon's Don Melchor). When the
// cellar wine has its own name (Oculus), the store's name must have it too.
const MATCH_STOP = new Set(("red white rose wine wines blend vin vino the and del della des les las los " +
  "chateau domaine bodega bodegas estate estates winery vineyard vineyards cellars reserve reserva sparkling dry brut " +
  "vigna vigneto vigneti").split(" ")); // "Vigna Enrico VI Barolo" is Jon's "Barolo Enrico VI"
const GRAPE_WORDS = new Set(("cabernet sauvignon merlot pinot noir grigio gris blanc franc chardonnay syrah shiraz " +
  "malbec carmenere tempranillo sangiovese nebbiolo zinfandel primitivo riesling gewurztraminer petit petite verdot " +
  "grenache garnacha mourvedre monastrell viognier semillon muscat moscato chenin gamay barbera touriga nacional " +
  "nero davola montepulciano verdejo albarino godello mencia corvina aglianico dolcetto torrontes tannat pinotage " +
  "marsanne roussanne cinsault carignan carinena mataro trebbiano vermentino gruner veltliner").split(" "));
// Words for a style of the same producer's wine: both names must agree on these
// (Zenato Amarone is not Zenato Valpolicella; a Riserva is not the regular bottling).
const STYLE_WORDS = { amarone: "amarone", ripasso: "ripasso", recioto: "recioto", riserva: "reserve", reserva: "reserve",
  reserve: "reserve", gran: "gran", blanc: "blanc", bianco: "blanc", blanco: "blanc", rose: "rose", rosato: "rose",
  rosado: "rose", brut: "brut", spatlese: "spatlese", auslese: "auslese", kabinett: "kabinett", icewine: "icewine" };
const styleOf = (s) => [...new Set(fold(s).split(/[^a-z0-9]+/).map((t) => STYLE_WORDS[t]).filter(Boolean))].sort().join(" ");
const nameTokens = (s) => fold(s).split(/[^a-z0-9]+/)
  .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !/^\d+(?:ml|cl|l)$/.test(t) && !MATCH_STOP.has(t)); // sizes aren't names

function storeTokens(name) {
  let n = String(name || "");
  const i = n.indexOf(" - "); // BC Liquor names start like "Chilean Red - "
  if (i > 0 && i < 30 && /\b(red|white|ros[eé]|sparkling|wine|fortified|dessert)\b/i.test(n.slice(0, i))) n = n.slice(i + 3);
  return [...new Set(nameTokens(n))];
}

function buildCellarIndex() {
  const idx = new Map();
  for (const w of allMyWines()) {
    if (w.kind !== "cellar") continue;
    const nameT = new Set(nameTokens(`${w.name} ${w.producer || ""}`));
    const generic = new Set(nameTokens(`${w.region_or_grape || ""} ${w.varietal || ""} ${w.country || ""}`));
    const all = new Set([...nameT, ...generic]);
    // Words that name this particular wine (Oculus, Tignanello), beyond producer, grape and place.
    const prodT = new Set(nameTokens(w.producer || ""));
    const specific = [...nameT].filter((t) => !prodT.has(t) && !generic.has(t) && !GRAPE_WORDS.has(t));
    const e = { w, nameT, all, generic, specific, style: styleOf(w.name) };
    for (const t of nameT) { if (!idx.has(t)) idx.set(t, []); idx.get(t).push(e); }
  }
  return idx;
}

// Colours must agree, except that stores file sweet wines differently (the LCBO lists Huet's
// Cuvée Constance as a red), so "Dessert" agrees with anything but Sparkling.
function typesAgree(a, b) {
  if (!a || !b || a === b || a === "Other" || b === "Other") return true;
  if (a === "Dessert" || b === "Dessert") return a !== "Sparkling" && b !== "Sparkling";
  return false;
}

// Store wine -> [{source: "Jon's cellar", vintages: [2016, 2018]}]. A cellar wine gets the
// other cellars that have the same wine (any vintage), never its own cellar.
function cellarMatches(w) {
  if (!w || (w.kind && w.kind !== "typed" && w.kind !== "cellar")) return []; // store, typed and cellar wines
  if (cellarMatchCache.has(w.id)) return cellarMatchCache.get(w.id);
  cellarIndex ??= buildCellarIndex();
  const S = storeTokens(w.name);
  const bySource = new Map(), ids = [];
  if (S.length >= 2 && cellarIndex.size) {
    const seen = new Set();
    for (const t of S) for (const e of cellarIndex.get(t) || []) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (w.kind === "cellar" && e.w.source === w.source) continue;
      if (!S.every((x) => e.all.has(x)) || S.filter((x) => e.nameT.has(x)).length < 2) continue;
      if (!S.some((x) => e.nameT.has(x) && !e.generic.has(x) && !GRAPE_WORDS.has(x))) continue;
      if (e.specific.length && !S.some((x) => e.specific.includes(x))) continue; // same producer, different wine
      if (!typesAgree(w.type, e.w.type)) continue; // their rosé isn't Jon's red
      if (styleOf(w.name) !== e.style) continue; // Amarone vs Valpolicella, Riserva vs regular
      ids.push(e.w.id);
      if (!bySource.has(e.w.source)) bySource.set(e.w.source, new Set());
      if (e.w.vintage) bySource.get(e.w.source).add(e.w.vintage);
    }
  }
  const res = [...bySource].map(([source, v]) => ({ source, vintages: [...v].sort() }));
  res.ids = ids;
  cellarMatchCache.set(w.id, res);
  return res;
}

// The other way round: cellar wine -> the store listings that look like it.
let storeMatchIndex = null, storeMatchKey = "";
const storeListsKey = () => `${WINES.length}|${[...LOADED].join()}`; // changes as store lists load
function storeMatchesOf(cellarId) {
  const key = storeListsKey();
  if (!storeMatchIndex || storeMatchKey !== key) {
    storeMatchIndex = new Map();
    storeMatchKey = key;
    for (const w of WINES) for (const id of cellarMatches(w).ids || []) {
      if (!storeMatchIndex.has(id)) storeMatchIndex.set(id, []);
      storeMatchIndex.get(id).push(w);
    }
  }
  return storeMatchIndex.get(cellarId) || [];
}

// A cellar wine's own price never counts (the keeper's own copy of a cellar may hold what
// the owner paid). Shown with stores ticked, it takes the price of its match at those
// stores: a standard bottle first, then the cheapest; with no store ticked it has none.
function priceOf(w, st = state) {
  if (w.kind !== "cellar") return w.price ?? null;
  const ticked = storesTicked(st);
  let best = null;
  for (const s of ticked.length ? storeMatchesOf(w.id) : []) {
    if (!ticked.includes(s.source) || s.price == null) continue;
    const std = STANDARD_ML.has(s.size_ml);
    if (!best || std > best.std || (std === best.std && s.price < best.p)) best = { std, p: s.price };
  }
  return best ? best.p : null;
}

const cellarOn = (st = state) => [...st.sources].some((s) => !ALL_SOURCES.includes(s));
const storesTicked = (st = state) => [...st.sources].filter((s) => ALL_SOURCES.includes(s));

// "BC Liquor - LDB $89.99 (2019)" for each store selling this cellar wine (the cheapest listing per store).
function soldAtHtml(w) {
  const ticked = storesTicked();
  const best = new Map();
  for (const s of storeMatchesOf(w.id)) {
    if (ticked.length && !ticked.includes(s.source)) continue;
    const cur = best.get(s.source), same = (x) => !w.size_ml || x.size_ml === w.size_ml; // same bottle size first
    if (!cur || same(s) > same(cur) || (same(s) === same(cur) && s.price < cur.price)) best.set(s.source, s);
  }
  if (!best.size) return "";
  // BC's catalogue has no product pages, so its price opens a BC search for that exact listing.
  const linkOf = (s) => s.url || (s.source === "BC Liquor" ? storeUrl(BC_SEARCH, s.name.replace(/ - /g, " ")) : null);
  const sold = [...best.values()].map((s) => {
    const url = linkOf(s);
    return (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">` : "<span>") +
      `${esc(sourceLabel(s.source))} ${esc(priceStr(s))}${s.vintage ? ` (${esc(String(s.vintage))})` : ""}` +
      (w.size_ml && s.size_ml && s.size_ml !== w.size_ml ? ` ${esc(sizeText(s))}` : "") +
      (url ? "</a>" : "</span>");
  });
  // A ticked store that doesn't carry it says so, so it's clear the store was checked.
  const notSold = ALL_SOURCES.filter((src) => ticked.includes(src) && !best.has(src))
    .map((src) => `<span class="not-sold">${esc(sourceLabel(src))}: not sold</span>`);
  return `<p class="wine-detail sold-at"><strong>Sold at:</strong> ${[...sold, ...notSold].join(" · ")}</p>`;
}


// ---- One wine, one record --------------------------------------------------------
// The same wine turns up under several names: a store listing, a family cellar entry,
// and whatever someone typed when researching it. These link them, so a wine already
// in a cellar or already researched is found (and its ratings shown) instead of being
// researched again under a new name.

// Two names for the same wine: every distinctive word of the shorter is in the longer
// (at least two of them), and they agree on style words (Riserva, Amarone, Blanc…).
// The longer name may only add place or grape words ("Coteaux du Languedoc", "Mencía"),
// never words naming another bottling: plain Beaucastel is not the Hommage à Jacques Perrin.
// Wine regions and the words stores put around them, so "Douro - Vila Regia" (BC) and "Sogrape
// Vila Regia" (LCBO) are read as the same wine with a place added, not two different names.
const REGION_WORDS = new Set(("douro dao lisboa alentejo alentejano tejo setubal bairrada minho beira beiras tavora varosa " +
  "verde vinho regional doc docg igp igt aoc vdp tinto branco peninsula palmela algarve madeira porto " +
  "rioja ribera duero priorat toro rueda navarra penedes cava jumilla bierzo montsant somontano la mancha valdepenas " +
  "mendoza uco lujan maipo colchagua casablanca maule curico rapel aconcagua cachapoal leyda itata " +
  "napa sonoma paso robles lodi central coast columbia willamette walla okanagan niagara similkameen " +
  "barossa mclaren clare eden coonawarra margaret yarra hunter marlborough hawkes bay otago " +
  "bordeaux medoc graves bourgogne burgundy rhone cotes languedoc roussillon provence loire alsace champagne beaujolais " +
  "chianti classico toscana tuscany piemonte veneto sicilia puglia abruzzo langhe montalcino bolgheri maremma " +
  "mosel rheingau pfalz nahe wachau kamptal stellenbosch swartland paarl").split(" "));
let placeWords = null;
const isPlaceWord = (t) => {
  placeWords ??= new Set(cellarFindWines().flatMap((w) => nameTokens(`${w.region_or_grape || ""} ${w.varietal || ""} ${w.country || ""}`)));
  return placeWords.has(t) || GRAPE_WORDS.has(t) || REGION_WORDS.has(t);
};
// The producers (and parent companies) the stores name, as word sets: a store may add one
// to a wine's name (the LCBO's "Sogrape Grao Vasco Dao"), but only a whole producer name.
let producerNames = null, producerNamesN = 0;
function isProducerName(words) {
  if (!producerNames || producerNamesN !== WINES.length) {
    producerNamesN = WINES.length;
    producerNames = new Set(WINES.map((w) => nameTokens(w.producer || "")).filter((t) => t.length && t.length <= 3)
      .filter((t) => t.some((x) => !GRAPE_WORDS.has(x) && !REGION_WORDS.has(x))) // "Cabernet Sauvignon" is no producer
      .map((t) => [...new Set(t)].sort().join(" ")));
  }
  return words.some((x) => !GRAPE_WORDS.has(x)) && producerNames.has([...new Set(words)].sort().join(" "));
}
// Two names for the same wine: leaving aside places, every word of the shorter name (grapes
// included) is in the longer one, which may only add a producer's name at its start (the
// LCBO's "Sogrape Grao Vasco Dao"); they agree on style words (Riserva, Amarone, Blanc…) and
// on colour words; and if both name a place, it's the same place. So Montes Alpha Cabernet
// is not Montes Alpha Chardonnay, plain Beaucastel is not the Hommage à Jacques Perrin, and
// Torres Priorat is not Torres Penedès.
const COLOUR_OF = { red: "red", tinto: "red", rosso: "red", rouge: "red", negre: "red", white: "white", branco: "white",
  blanco: "white", bianco: "white", blanc: "white", weiss: "white", blanca: "white" };
const colourWords = (s) => new Set(fold(s).split(/[^a-z]+/).map((t) => COLOUR_OF[t]).filter(Boolean));
function sameWineName(a, b) {
  if (styleOf(a) !== styleOf(b)) return false;
  const ca = colourWords(a), cb = colourWords(b);
  if (ca.size && cb.size && ![...ca].some((c) => cb.has(c))) return false;
  const placeOnly = (t) => isPlaceWord(t) && !GRAPE_WORDS.has(t);
  const A = storeTokens(a), B = storeTokens(b);
  const cA = A.filter((t) => !placeOnly(t)), cB = B.filter((t) => !placeOnly(t));
  const [small, big, smallAll] = cA.length <= cB.length ? [cA, cB, A] : [cB, cA, B];
  if (smallAll.length < 2 || !small.some((t) => !GRAPE_WORDS.has(t))) return false; // a name, not just a grape or a region
  const bigSet = new Set(big);
  if (!small.every((t) => bigSet.has(t))) return false;
  const pA = A.filter((t) => REGION_WORDS.has(t) && !GRAPE_WORDS.has(t)), pB = B.filter((t) => REGION_WORDS.has(t) && !GRAPE_WORDS.has(t));
  if (pA.length && pB.length && !pA.some((t) => pB.includes(t))) return false;
  const extra = big.filter((t) => !small.includes(t));
  if (!extra.length) return true;
  const lead = big.slice(0, extra.length); // the producer comes first in the longer name
  return extra.every((t) => lead.includes(t)) && isProducerName(extra);
}
// A barcode as 14 digits: BC's list drops leading zeros, so every store's is padded alike.
const gtin = (s) => { const t = String(s ?? "").trim(); return /^\d{8,14}$/.test(t) ? t.padStart(14, "0") : null; };
// Another store's rated listing of this very bottle: the same barcode (the surest link: 653
// BC and LCBO wines share one), else the same product number, which BC and the LCBO often
// share (Grao Vasco is 14977 at both) when the names share a word and the colour agrees.
let upcRatings = null, upcRatingsVer = "";
function twinIds(w) {
  const out = new Set();
  if (!w?.id) return out;
  const ver = `${Object.keys(familyRatings).length}:${ratingsVer}`;
  if (upcRatingsVer !== ver) {
    upcRatingsVer = ver;
    upcRatings = new Map();
    for (const [id, r] of Object.entries(familyRatings)) {
      const u = gtin(r.upc);
      if (u) (upcRatings.get(u) || upcRatings.set(u, []).get(u)).push(id);
    }
  }
  const u = gtin(w.upc);
  for (const id of (u && upcRatings.get(u)) || []) if (id !== w.id) out.add(id);
  const m = /^(bcl|lcbo)-(\d+)$/.exec(w.id);
  if (m) {
    const other = `${m[1] === "bcl" ? "lcbo" : "bcl"}-${m[2]}`, r = familyRatings[other];
    const ot = r && (findWine(other)?.type || r.type);
    if (r?.name && (!ot || typesAgree(w.type, ot))) {
      const B = new Set(storeTokens(r.name).filter((t) => !isPlaceWord(t)));
      if (storeTokens(w.name).some((t) => !isPlaceWord(t) && B.has(t))) out.add(other);
    }
  }
  return out;
}

// Ratings the family gave this wine under its other records (cellar entries, names typed).
function relatedRatings(w) {
  const seen = new Set([w.id]), out = [];
  for (const id of cellarMatches(w).ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const f = frOf(id), c = cellarFindWines().find((x) => x.id === id);
    if (f.claude || f.family) out.push({ f, cellar: true, label: c ? `${c.source}${c.vintage ? `, ${c.vintage}` : ""}` : "a family cellar" });
  }
  for (const [id, r] of Object.entries(familyRatings)) {
    if (seen.has(id) || !id.startsWith("typed-") || !r.name || !sameWineName(w.name, r.name)) continue;
    seen.add(id);
    out.push({ f: r, label: `researched as “${r.name}”` });
  }
  // ratings given to a store's listing of the same wine, at any store
  const STORE_OF = { bcl: "BC Liquor - LDB", bsw: "BSW Liquor", zyn: "ZYN", luc: "Lucullus (Switzerland)",
    wsh: "Weinshop365 (Switzerland)", lcbo: "LCBO" };
  const twins = twinIds(w);
  for (const [id, r] of Object.entries(familyRatings)) {
    const store = STORE_OF[id.split("-")[0]];
    if (seen.has(id) || !store || !r.name || (!twins.has(id) && !sameWineName(w.name, r.name))) continue;
    const ot = findWine(id)?.type || r.type; // the published rating knows its colour too
    if (ot && !typesAgree(w.type, ot)) continue;
    seen.add(id);
    out.push({ f: r, id, label: `rated as “${r.name}” at ${store}` });
  }
  return out;
}

// ---- Wine style: continent, body, tannin, sweetness, ready to drink -----------------
// For "Find me a wine". Stores don't give body or tannin, so they're estimated from what
// we do know: the grape and region in the name or the store's fields, alcohol, the
// store's sweetness or sugar figure, and the words in LCBO's tasting notes. Claude's
// quick score (body, tannin, sweetness, drinking window) replaces the estimate, and a
// family cellar's own drinking window does too. Each answer says where it came from.

const CONTINENTS = {
  Europe: ["France", "Italy", "Spain", "Portugal", "Germany", "Austria", "Switzerland", "Greece", "Hungary", "Georgia",
    "Croatia", "Moldova", "Armenia", "Romania", "Slovenia", "Bulgaria", "Ukraine", "Cyprus", "Montenegro", "Serbia",
    "United Kingdom", "England", "Czech Republic", "Slovakia", "Luxembourg", "North Macedonia", "Turkey"],
  "North America": ["Canada", "USA", "United States", "North America", "Mexico"],
  "South America": ["Argentina", "Chile", "Uruguay", "Brazil", "Peru"],
  "Australia & NZ": ["Australia", "New Zealand"],
  Africa: ["South Africa", "Morocco"],
  "Asia & Middle East": ["Israel", "Lebanon", "Japan", "China", "India", "South Korea"],
};
const CONTINENT_OF = Object.fromEntries(Object.entries(CONTINENTS).flatMap(([c, list]) => list.map((n) => [n, c])));
const continentOf = (w) => CONTINENT_OF[w.country] || null;

// Red wines: [words in the name, grape or region (folded, no accents), body, tannin]. Most
// specific first: an appellation decides before a grape does (Amarone before Corvina).
const RED_STYLE = [
  [/\bamarone\b/, "full", "soft"], [/\bripasso\b/, "full", "soft"], [/\bvalpolicella\b/, "light", "soft"],
  [/\bbarolo\b|\bbarbaresco\b|\bnebbiolo\b|\bgattinara\b|\bghemme\b/, "full", "firm"],
  [/\bbrunello\b/, "full", "firm"], [/\brosso di montalcino\b|\bvino nobile\b/, "medium", "firm"],
  [/\bchianti\b|\bsangiovese\b|\bmorellino\b/, "medium", "firm"],
  [/\btaurasi\b|\baglianico\b|\bsagrantino\b|\btannat\b|\bmadiran\b|\bcahors\b/, "full", "firm"],
  [/\bprimitivo\b|\bzinfandel\b|\bnegroamaro\b|\bnero d.?avola\b/, "full", "soft"],
  [/\bmontepulciano d.?abruzzo\b|\bmontepulciano\b/, "medium", "medium"],
  [/\bbarbera\b|\bdolcetto\b|\bfrappato\b|\bschiava\b|\blambrusco\b|\bgrignolino\b/, "light", "soft"],
  [/\bchateauneuf\b|\bgigondas\b|\bvacqueyras\b|\brasteau\b|\blirac\b/, "full", "medium"],
  [/\bcotes? du rhone\b|\bventoux\b|\bcostieres\b|\bgsm\b/, "medium", "soft"],
  [/\bhermitage\b|\bcornas\b|\bcote.rotie\b|\bsaint.joseph\b|\bst.joseph\b|\bcrozes\b/, "full", "firm"],
  [/\bbandol\b|\bmourvedre\b|\bmonastrell\b|\bmataro\b|\bjumilla\b/, "full", "firm"],
  [/\bpauillac\b|\bmargaux\b|\bsaint.julien\b|\bst.julien\b|\bsaint.estephe\b|\bst.estephe\b|\bhaut.medoc\b|\bmedoc\b|\bpessac\b/, "full", "firm"],
  [/\bpomerol\b|\bsaint.emilion\b|\bst.emilion\b|\bfronsac\b|\bcastillon\b/, "full", "medium"],
  [/\bbordeaux\b/, "medium", "medium"],
  [/\bbourgogne\b|\bburgundy\b|\bgevrey\b|\bvosne\b|\bnuits\b|\bbeaune\b|\bpommard\b|\bvolnay\b|\bchambolle\b|\bmorey\b|\bmercurey\b|\bgivry\b/, "light", "soft"],
  [/\bbeaujolais\b|\bmorgon\b|\bfleurie\b|\bmoulin.a.vent\b|\bbrouilly\b|\bjulienas\b|\bchiroubles\b|\bgamay\b/, "light", "soft"],
  [/\bpinot noir\b|\bspatburgunder\b|\bblauburgunder\b|\bpinot nero\b/, "light", "soft"],
  [/\brioja\b|\btempranillo\b|\btinto fino\b|\btinta de toro\b|\bnavarra\b/, "medium", "medium"],
  [/\bribera del duero\b|\btoro\b|\bpriorat\b/, "full", "firm"],
  [/\bgarnacha\b|\bgrenache\b|\bcannonau\b/, "full", "soft"],
  [/\bmencia\b|\bbierzo\b/, "medium", "soft"],
  [/\btouriga\b|\bdouro\b|\bdao\b/, "full", "firm"], [/\balentej(o|ano)\b/, "full", "soft"],
  [/\blisboa\b|\btejo\b|\bsetubal\b|\bpalmela\b|\bcastelao\b|\bperiquita\b/, "medium", "soft"],
  [/\bmalbec\b/, "full", "soft"], [/\bcarmenere\b/, "medium", "soft"], [/\bpinotage\b/, "full", "medium"],
  [/\bpetite? sirah\b|\bdurif\b|\bpetit verdot\b/, "full", "firm"],
  [/\bshiraz\b/, "full", "soft"], [/\bsyrah\b/, "full", "medium"],
  [/\bcabernet sauvignon\b|\bcab sauv\b/, "full", "firm"], [/\bcabernet franc\b|\bchinon\b|\bbourgueil\b/, "medium", "medium"],
  [/\bmerlot\b/, "medium", "soft"], [/\bcabernet\b/, "full", "firm"],
  [/\bxinomavro\b|\bnaoussa\b/, "medium", "firm"], [/\bagiorgitiko\b|\bnemea\b/, "medium", "soft"],
  [/\bsaperavi\b/, "full", "firm"], [/\bblaufrankisch\b|\bkekfrankos\b/, "medium", "medium"],
  [/\bzweigelt\b|\bst.? laurent\b/, "medium", "soft"], [/\bcarignan\b|\bcarinena\b|\bcorbieres\b|\bminervois\b/, "medium", "medium"],
  [/\bcinsault\b|\bpoulsard\b|\btrousseau\b/, "light", "soft"],
  [/\bred blend\b|\bbordeaux.style\b|\bmeritage\b/, "full", "medium"],
];
// White wines: body only.
const WHITE_STYLE = [
  [/\bsauternes\b|\bbarsac\b|\btokaji\b/, "full"],
  [/\bchablis\b|\bmuscadet\b|\bvinho verde\b|\bpicpoul\b|\bgruner\b|\bchasselas\b|\balbarino\b|\balvarinho\b|\bsoave\b|\bfrascati\b|\bpinot grigio\b|\bsauvignon blanc\b|\bsancerre\b|\bpouilly.fume\b|\briesling\b|\bassyrtiko\b|\bvermentino\b|\bverdejo\b|\btxakoli\b/, "light"],
  [/\bchenin\b|\bvouvray\b|\bsemillon\b|\bpinot blanc\b|\bgarganega\b|\bgavi\b|\bcortese\b|\bfiano\b|\bgreco\b|\bgodello\b|\bsylvaner\b|\bsilvaner\b/, "medium"],
  [/\bmeursault\b|\bmontrachet\b|\bcorton.charlemagne\b|\bpouilly.fuisse\b/, "full"],
  [/\bchardonnay\b|\bbourgogne blanc\b|\bmacon\b/, "medium"],
  [/\bviognier\b|\bcondrieu\b|\bmarsanne\b|\broussanne\b|\bgewurz\b|\bpinot gris\b|\bwhite rhone\b/, "full"],
];
const MEDIUM_SWEET_WORDS = /\bspatlese\b|\bdemi.sec\b|\bsemi.sweet\b|\bmedium.sweet\b|\bamabile\b|\bmoelleux\b|\babboccato\b/;
const SWEET_WORDS = /\bauslese\b|\bbeerenauslese\b|\btrockenbeerenauslese\b|\btba\b|\beiswein\b|\bice.?wine\b|\blate harvest\b|\bvendanges tardives\b|\bsauternes\b|\bbarsac\b|\btokaji\b|\bmoscato d.?asti\b|\bdoux\b|\bdolce\b|\bpassito\b|\brecioto\b|\bvin santo\b|\bpedro ximenez\b|\bcream sherry\b/;
const OFFDRY_WORDS = /\bkabinett\b|\boff.dry\b|\bmedium.dry\b|\bsemi.dry\b|\bwhite zinfandel\b|\bmoscato\b|\bfeinherb\b/;
const DRY_FORTIFIED = /\bfino\b|\bmanzanilla\b|\bamontillado\b|\bsercial\b|\bdry sherry\b/;

// "Fruity & ripe": dry reds that taste ripe and fruity. Grapes and styles known for it,
// any warm-country red at 14.5% or more, or LCBO's notes saying so.
const FRUITY_RED = /\bmalbec\b|\bzinfandel\b|\bprimitivo\b|\bgrenache\b|\bgarnacha\b|\bcannonau\b|\bamarone\b|\bripasso\b|\bappassimento\b|\bpinotage\b|\bcarmenere\b|\bjam\b|\bjammy\b/;
const NEW_WORLD = new Set(["Australia", "USA", "United States", "Argentina", "Chile", "South Africa", "New Zealand", "Canada", "Uruguay", "Mexico"]);
const WARM = new Set([...NEW_WORLD, "Spain", "Portugal", "Italy", "Greece", "Israel", "Lebanon"]);
WARM.delete("New Zealand"); WARM.delete("Canada");
function fruityEstimate(w, t, note, tannin) {
  if (w.type !== "Red") return null;
  if (FRUITY_RED.test(t)) return true;
  if (NEW_WORLD.has(w.country) && /\bshiraz\b|\bsyrah\b|\bmerlot\b/.test(t)) return true;
  // strong alcohol: ripe anywhere warm, except firm Old World reds (Barolo, Brunello, Toro…)
  if (WARM.has(w.country) && w.abv >= 14.5 && (NEW_WORLD.has(w.country) || tannin !== "firm")) return true;
  if (/\bjammy\b|\bfruit.forward\b|\bplush\b|\bripe (dark |red |black )?fruits?\b|\bripe and\b/.test(note)) return true;
  return false;
}

function styleText_(w) {
  return fold([w.name, w.grape, w.region, w.region_or_grape, w.varietal].filter(Boolean).join(" "));
}

// The style a store listing implies, before any Claude answer: {body, tannin, sweet} with
// each value or null. LCBO's tasting notes, where they say it outright, win over the rules.
// The measured sugar a store gives for the same wine as this cellar wine: the LCBO's grams a
// litre first (finer than BC's code), then BC's 0-10 code; a standard bottle first.
function storeSugar(w) {
  let best = null;
  for (const s of storeMatchesOf(w.id)) {
    const rank = s.sugar != null ? 2 : s.sweetness != null ? 1 : 0;
    const std = STANDARD_ML.has(s.size_ml) ? 1 : 0;
    if (rank && (!best || rank > best.rank || (rank === best.rank && std > best.std))) best = { s, rank, std };
  }
  return best?.s || null;
}

function estimatedStyle(w) {
  // a cellar wine's answer can change as store lists load (it borrows their sugar figures)
  if (w._est && (w.kind !== "cellar" || w._estKey === storeListsKey())) return w._est;
  const t = styleText_(w), note = fold(w.note || "");
  const type = w.type;
  let body = null, tannin = null, sweet = null;
  if (type === "Red") {
    const hit = RED_STYLE.find(([re]) => re.test(t));
    if (hit) [, body, tannin] = hit;
  } else if (type === "White") {
    const hit = WHITE_STYLE.find(([re]) => re.test(t));
    if (hit) body = hit[1];
  } else if (type === "Rosé" || type === "Sparkling") body = "light";
  else if (type === "Dessert" || type === "Fortified") body = "full";
  // the store's own words beat the grape rule
  if (/\bfull.bodied\b|\bfull bodied\b/.test(note)) body = "full";
  else if (/\blight.bodied\b|\blight bodied\b/.test(note)) body = "light";
  else if (/\bmedium.bodied\b|\bmedium bodied\b/.test(note)) body = "medium";
  if (type === "Red") {
    if (/\b(soft|supple|silky|velvety|smooth|round|gentle) tannins?\b/.test(note)) tannin = "soft";
    else if (/\b(firm|grippy|chewy|robust|bold|structured|muscular|powerful|dense) tannins?\b/.test(note)) tannin = "firm";
  }
  // alcohol nudges an unknown body, and corrects a guess that disagrees with it: a 12% Douro
  // isn't full-bodied, a 14.5% red isn't light (the LCBO's own "full-bodied" words stand)
  if (!body && w.abv) body = w.abv >= 14.5 ? "full" : w.abv <= 12 ? "light" : "medium";
  else if (w.abv && !/\bbodied\b/.test(note)) {
    if (body === "full" && w.abv <= 12.5) body = "medium";
    else if (body === "light" && w.abv >= 14.5) body = "medium";
  }
  // sweetness: the store's own figure first (BC's 0-10 sugar code, the LCBO's grams of sugar
  // a litre), measured; otherwise estimated from the type and the words in the name
  // A cellar wine has no figure of its own: it borrows the one a store gives for the same wine.
  let sweetHow = "estimated", sweetMeasured = false, sweetFine = 0;
  const fig = w.kind === "cellar" ? storeSugar(w) : w;
  const of = fig && fig !== w ? `, ${fig.vintage ? `${fig.vintage} vintage` : "store's listing"}` : "";
  if (fig?.sugar != null) { sweet = sweetFromSugar(fig.sugar); sweetHow = `LCBO: ${+(+fig.sugar).toFixed(1)} g/L sugar${of}`; sweetMeasured = true; sweetFine = +fig.sugar; }
  else if (fig?.sweetness != null) { sweet = sweetFromCode(fig.sweetness); sweetHow = `BC sugar code ${fig.sweetness} of 10${of}`; sweetMeasured = true; sweetFine = fig.sweetness * 10; }
  else if (type === "Fortified") sweet = DRY_FORTIFIED.test(t) ? "dry" : "sweet";
  else if (type === "Dessert" || SWEET_WORDS.test(t)) sweet = "sweet";
  else if (MEDIUM_SWEET_WORDS.test(t)) sweet = "medium-sweet";
  else if (OFFDRY_WORDS.test(t)) sweet = "off-dry";
  else if (type === "Red" || type === "Rosé" || type === "Sparkling" || type === "White") sweet = "dry";
  const fruity = sweet === "sweet" || sweet === "medium-sweet" ? false : fruityEstimate(w, t, note, tannin);
  if (w.kind === "cellar") w._estKey = storeListsKey();
  return (w._est = { body, tannin: type === "Red" ? tannin : null, sweet, sweetHow, sweetMeasured, sweetFine, fruity });
}

// Claude's own answer for this wine (its own listing, the same wine at another store, or
// a family cellar), if it gave style or a drinking window.
function claudeStyle(w) {
  const has = (c) => c && (c.body || c.sweet || c.drinkFrom || c.fruity != null || c.finish || c.pair);
  const own = ratingOf(w.id).claude || frOf(w.id).claude;
  if (has(own)) return own;
  const twin = ratedTwin(w)?.claude;
  return has(twin) ? twin : null;
}

// Ready to drink this year? true / false / null (can't tell), with where the answer came from.
function readiness(w, est, cl) {
  const year = new Date().getFullYear();
  if (cl?.drinkFrom) return { ready: year >= cl.drinkFrom && year <= cl.drinkTo + 2, from: "Claude" };
  if (w.drink_from || w.drink_to) { // a family cellar's own window (CellarTracker)
    return { ready: (!w.drink_from || year >= w.drink_from) && (!w.drink_to || year <= w.drink_to + 2), from: "cellar" };
  }
  const age = w.vintage ? year - w.vintage : null;
  if (w.type !== "Red") return { ready: true, from: "estimate" };
  if (age == null || w.price < 25) return { ready: true, from: "estimate" }; // everyday reds are made to drink now
  if (est.body === "full" && est.tannin === "firm") return { ready: age >= 8, from: "estimate" };
  if (est.body === "full") return { ready: age >= 4, from: "estimate" };
  return { ready: true, from: "estimate" };
}

// Everything "Find me a wine" asks about, for one wine: Claude's answers where it gave them,
// else the estimate. src says which: "Claude" or "estimate".
function wineStyle(w) {
  ratedTwin(w); // brings ratedNamesVer up to date
  const ver = `${ratedNamesVer}|${w.kind === "cellar" ? storeListsKey() : ""}`;
  if (w._look && w._lookVer === ver) return w._look;
  w._lookVer = ver;
  return (w._look = wineStyleNow(w));
}
function wineStyleNow(w) {
  const est = estimatedStyle(w), cl = claudeStyle(w);
  const pick = (k) => (cl?.[k] != null ? { v: cl[k], src: "Claude" } : { v: est[k], src: est[k] != null ? "estimate" : null });
  return { continent: continentOf(w), body: pick("body"), tannin: w.type === "Red" ? pick("tannin") : { v: null, src: null },
    sweet: { ...pick("sweet"), how: cl?.sweet ? "Claude's answer" : est.sweetHow, measured: !!cl?.sweet || est.sweetMeasured },
    fruity: pick("fruity"), finish: { v: cl?.finish || null, src: cl?.finish ? "Claude" : null }, ready: readiness(w, est, cl) };
}

// On a store's wine, each family cellar that has it is one short line, "In Jon's cellar ·
// 7 vintages · Claude 94–98": what matters there is that Jon chose it and how Claude rated
// it, not every vintage. A cellar's own card still lists them all.
function cellarSummaryHtml(w) {
  const ids = new Set(cellarMatches(w).ids || []), cw = cellarFindWines().filter((x) => ids.has(x.id));
  return cellarMatches(w).map((m) => {
    const pts = cw.filter((x) => x.source === m.source).map((x) => frOf(x.id).claude?.points).filter((n) => typeof n === "number");
    const lo = Math.min(...pts), hi = Math.max(...pts), n = m.vintages.length;
    const what = n > 1 ? ` · ${n} vintages` : n === 1 ? ` · the ${m.vintages[0]}` : "";
    const claude = pts.length ? ` · Claude <strong>${lo === hi ? lo : `${lo}–${hi}`}</strong>` : "";
    return `<span class="badge badge-cellar">In ${esc(m.source)}${esc(what)}${claude}</span>`;
  });
}
function familyLinksHtml(w) {
  const summary = w.kind !== "cellar";
  const badges = summary ? cellarSummaryHtml(w) : cellarMatches(w).map((m) => `<span class="badge badge-cellar">Also in ${esc(m.source)}` +
    `${m.vintages.length ? ` (${esc(m.vintages.join(", "))})` : ""}</span>`);
  const rel = relatedRatings(w).filter((r) => !(summary && r.cellar)).map(({ f, id, label }) => {
    const c = f.claude, fam = f.family;
    if (!fam && c?.quick && id) // another store's quick score for this wine: the same badge, its details inside
      return `<button type="button" class="rating rating-fr rating-related rating-quick quick-btn" data-quick="${esc(id)}" data-quick-src="fr">` +
        `Claude <strong>${c.points ?? "found no reviews"}</strong> (Quick Score Only)${c.vintage ? ` · ${esc(String(c.vintage))}` : ""} · ${esc(label)}` +
        `<span class="quick-more">ⓘ Details</span></button>`;
    return `<span class="rating rating-fr rating-related${!fam && c?.quick ? " rating-quick" : ""}">${fam ? "Family" : "Claude"} <strong>${fam ? fam.points : c?.points ?? "found no reviews"}</strong>` +
      `${!fam && c?.quick ? " (Quick Score Only)" : ""}${!fam && c?.vintage ? ` · ${esc(String(c.vintage))}` : ""}` +
      `${!fam && styleText(c) ? ` · ${esc(styleText(c))}` : ""} · ${esc(label)}</span>`;
  });
  return badges.length || rel.length ? `<p class="wine-detail family-links">${[...badges, ...rel].join(" ")}</p>` : "";
}

// Name searches: wines in the family cellars and wines already researched by name.
function familyHits(q) {
  const cellarIds = new Set(cellarMatches({ id: `q:${fold(q)}`, name: q }).ids || []);
  const words = fold(q).split(/\s+/).filter((t) => t.length > 2);
  for (const w of cellarFindWines()) if (words.length && words.every((t) => w._s.includes(t))) cellarIds.add(w.id);
  const cellar = cellarFindWines().filter((w) => cellarIds.has(w.id))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.vintage ?? 0) - (b.vintage ?? 0));
  const typed = new Map();
  for (const [id, r] of [...Object.entries(familyRatings), ...Object.entries(ratings)]) {
    if (id.startsWith("typed-") && r.name && !typed.has(id) && sameWineName(q, r.name)) typed.set(id, r.name);
  }
  return { cellar, typed: [...typed].map(([id, name]) => ({ id, name })) };
}

function familyHitsHtml(q) {
  const { cellar, typed } = familyHits(q);
  if (!cellar.length && !typed.length) return "";
  const addBtn = (attr, on) => `<button type="button" class="btn btn-add" ${attr} aria-pressed="${on}">${on
    ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>`;
  const rows = [
    ...cellar.slice(0, 6).map((w) => `<li class="ew-hit"><div><div class="sl-name">${esc(w.name)}</div>
        <div><span class="badge badge-cellar">In ${esc(w.source)}</span></div>${ratingsHtml(w)}${soldAtHtml(w)}</div>
        <div class="hit-buttons">${researchButton(w)}${addBtn(`data-add="${esc(w.id)}"`, isOnList(w.id))}</div></li>`),
    ...typed.map((t) => `<li class="ew-hit"><div><div class="sl-name">${esc(t.name)}</div>
        <div class="hint">Already researched by the family</div>${ratingsHtml({ id: t.id })}</div>
        <div class="hit-buttons">${researchButton({ id: t.id, name: t.name, kind: "typed" })}
        <button type="button" class="btn btn-typed" data-typed="${esc(t.name)}" aria-pressed="${isOnList(t.id)}">${isOnList(t.id)
          ? "✓ On the Short List" : "＋ Add to Short List for Claude Research"}</button></div></li>`),
  ];
  return `<h3 class="ew-sub">In the family's wines</h3>
    <p class="hint">Found in a family cellar or already researched. Adding one of these keeps its ratings together.</p>
    <ul class="ew-hit-list family-hit-list">${rows.join("")}</ul>${cellar.length > 6 ? `<p class="hint">Showing 6 of ${cellar.length}. Try more words to narrow it down.</p>` : ""}`;
}


function cellarSources() {
  return [...new Set(allMyWines().filter((w) => w.kind === "cellar").map((w) => w.source))].sort();
}

// Every sort choice as [value, label], in menu order.
function sortChoices() {
  const out = [];
  for (const [k, key] of Object.entries(SORT_KEYS)) {
    const pair = [[`${k}-asc`, key.up], [`${k}-desc`, key.down]];
    out.push(...(key.first === "down" ? pair.reverse() : pair));
  }
  for (const src of cellarSources()) out.push([`cellar:${src}`, `In ${src} first`]);
  return out;
}

// Tidy the three choices: no unknown ones, no choice used twice, gaps closed up.
function normaliseSorts() {
  const known = new Set(sortChoices().map(([v]) => v));
  const list = (Array.isArray(state.sorts) ? state.sorts : [state.sort]).map((v) => OLD_SORTS[v] || v || "");
  const out = [], used = new Set();
  for (const v of list) {
    if (!known.has(v) || used.has(sortGroup(v))) continue;
    out.push(v);
    used.add(sortGroup(v));
  }
  if (!out.length) out.push("best-desc");
  state.sorts = [...out, "", ""].slice(0, 3);
  delete state.sort;
}

// Sort by, then by, then by: each box leaves out what's chosen above it. Price (low first)
// settles any tie that's left.
function renderSorts() {
  if (!$("sort")) return;
  normaliseSorts();
  const choices = sortChoices();
  ["sort", "sort2", "sort3"].forEach((id, i) => {
    const used = new Set(state.sorts.slice(0, i).filter(Boolean).map(sortGroup));
    const opts = choices.filter(([v]) => !used.has(sortGroup(v)));
    $(id).innerHTML = (i ? `<option value="">(nothing)</option>` : "") +
      opts.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join("");
    $(id).value = state.sorts[i];
  });
}

function updateCellarSorts() {
  if (!$("sort")) return;
  renderSorts();
  const srcs = new Set(cellarSources());
  for (const s of [...state.sources]) if (!srcs.has(s) && !ALL_SOURCES.includes(s)) state.sources.delete(s); // renamed or removed
  for (const s of srcs) LOADED.add(s);
  if (WINES.length) renderSources();
}

// The three levels, then price (low first) and the name to settle any tie that's left.
function currentSort() {
  normaliseSorts();
  const levels = [...state.sorts.filter(Boolean), "price-asc", "name-asc"].map(sortLevel);
  return (a, b) => {
    for (const f of levels) { const r = f(a, b); if (r) return r; }
    return 0;
  };
}

// ---- At a restaurant: a photo of the wine list, Claude's picks, back in the Wine Finder ----
// Uses each person's own Claude (claude.ai), so there are no API keys or fees. Claude's
// answer ends with a link back here that carries a short summary of its picks (a few
// hundred characters, small enough for a link), shown as "Tonight's picks".
const DINE_CHOICES = {
  food: ["Red meat", "Lamb", "Fish", "Seafood", "Chicken", "Pork", "Pasta", "Pizza", "Cheese", "Vegetarian", "Spicy food"],
  colour: ["Any", "Red", "White", "Rosé", "Sparkling"],
  serve: ["Either", "Bottle", "By the glass"],
};
// Budget: two sliders (lowest, highest); the buttons are presets that move them. The top of
// the scale means "no limit". Glass prices get their own, smaller scale.
const DINE_SCALE = {
  bottle: { max: 300, step: 5, presets: [["Any", 0, 300], ["Under $60", 0, 60], ["$60–100", 60, 100], ["$100–150", 100, 150], ["Over $150", 150, 300]] },
  glass: { max: 40, step: 1, presets: [["Any", 0, 40], ["Under $12", 0, 12], ["$12–18", 12, 18], ["$18–25", 18, 25], ["Over $25", 25, 40]] },
};
const dine = { food: new Set(), colour: "Any", serve: "Either", lo: 0, hi: 300 };
const dineScale = () => DINE_SCALE[dine.serve === "By the glass" ? "glass" : "bottle"];

// "$30 to $100", "up to $60", "$150 or more", or "" for no budget.
function dineBudgetText() {
  const { max } = dineScale();
  if (dine.lo <= 0 && dine.hi >= max) return "";
  if (dine.lo <= 0) return `up to $${dine.hi}`;
  if (dine.hi >= max) return `$${dine.lo} or more`;
  return `$${dine.lo} to $${dine.hi}`;
}

// What the pairing books say for each food on the restaurant page, given to Claude with the
// photo: classic styles, one adventurous idea, and what to avoid (Dornenburg & Page;
// Harrington; Fiona Beckett). Only the foods chosen are sent, to keep the link short.
const DINE_GUIDE = {
  "Red meat": "classic: Cabernet, Syrah, Malbec, Zinfandel with fattier cuts; Pinot Noir with beef bourguignon or lean roast beef; Beaujolais with burgers or well-done steak. Adventurous: rosé Champagne with rare beef; Riesling with steak tartare. Avoid: tannic reds with well-done steak.",
  "Lamb": "classic: Syrah, Rioja, Cabernet, Pinot Noir. Adventurous: rosé Champagne with rare rack; dry rosé with kebabs; Viognier with tagine. Avoid: big tannic reds with lamb curry.",
  "Fish": "classic: crisp whites for delicate fish, fuller whites for salmon or butter sauces; Pinot Noir with salmon or tuna. Adventurous: Merlot, Zinfandel or Syrah with grilled tuna or swordfish. Avoid: tannic or oaky wines with delicate or raw fish.",
  "Seafood": "classic: Champagne, Muscadet, Sancerre, Albariño, Riesling with crab. Adventurous: Pinot Noir with lobster or shellfish in tomato or mushroom sauce; dry sherry with shrimp. Avoid: red with raw oysters, plain shrimp or scallops; oak with raw shellfish.",
  "Chicken": "classic: Chardonnay, Pinot Noir, Beaujolais. Adventurous: Zinfandel with tandoori or barbecued chicken; dry sherry or Champagne with fried chicken. Avoid: tannic Bordeaux with plain white meat.",
  "Pork": "classic: Riesling, Pinot Noir, Beaujolais, Gewürztraminer with fruit sauces. Adventurous: Cahors or Syrah with cassoulet or pork belly; sparkling with glazed pork. Avoid: tannic reds with ham or prosciutto.",
  "Pasta": "classic: Chianti, Barbera, Montepulciano with tomato and meat sauces; Chardonnay with cream sauces. Adventurous: Prosecco with creamy pasta. Avoid: tannic reds with sweet tomato sauce.",
  "Pizza": "classic: Barbera, Chianti, dry Lambrusco, Zinfandel with sausage. Adventurous: Champagne or Prosecco, especially with white pizza. Avoid: Chianti with sweet American-style pizza.",
  "Cheese": "classic: whites are the safer match (Sancerre with goat cheese, Champagne with Brie, Gewürztraminer or Riesling with washed-rind and blue); big reds only with hard, aged cheeses. Adventurous: Beaujolais with a cheese and charcuterie plate. Avoid: tannic reds with goat cheese or Manchego.",
  "Spicy food": "classic: off-dry Riesling or Gewürztraminer, low alcohol. Adventurous: bubbles (Cava rather than delicate Champagne); ripe Zinfandel or Shiraz with spiced meat, not heat. Avoid: tannic, oaky or high-alcohol wines with real heat.",
};
const DINE_PRINCIPLES = "Pairing principles from Harrington's Food and Wine Pairing: the wine should be at least as sweet and as acidic as the food; salt and fried food love bubbles; fat and protein soften tannin; salt, chilli heat and lean meat make tannin harsher; match the weight of wine and dish; heat wants off-dry, lower-alcohol wine.";
const DINE_TEMPLATE = `I'm at a restaurant and I'm attaching a photo of the wine list. Please read every wine and price on it, then help me choose. {CHOICES} {ABOUT_ME}

Please:
- Start by saying how many wines you could read on the list, and how many (if any) you couldn't read.
- Then recommend your top 5 wines from this list only, best first (fewer if fewer suit my food and budget). For each: the wine exactly as written on the list and its price on the list; what it is, in two or three sentences; what critics say about it, in your own words, with a score, its source and the vintage it's for, if you know one; why it suits my food and budget; and whether the price is fair compared with what the bottle usually costs in a store (restaurants often charge two to three times the store price).
- Then, under the heading "Wines to skip", list up to 5 wines on this list I should avoid for this meal and budget (never one of your picks, and fewer if few deserve it). Give each one reason, exactly one of: Overpriced, Wrong for your food, Weak reviews, Past its best, and one sentence why.
- If you can't read part of the photo, say so rather than guessing.
- {GUIDE}- If the list has a good one, make one of your picks an adventurous match (a pairing beyond the usual rules that the guidance above or sommeliers back), say plainly that it's the adventurous pick and why it works, and warn me about any wine on the list that would clash with my food.
- Keep it easy to read on a phone: I'm at the table. A clear heading for each pick, and no tables.

At the very end, below a horizontal line (---), write this link as the largest heading (one #), exactly in this form: first the count, then one entry per pick in the same order, all joined by semicolons:
# [🍷 Back to my Wine Finder with tonight's picks]({BASE}#dine=READ~UNREAD;NAME~PRICE~SCORE~CRITICS~STORE~WHAT~WHY~VALUE;NAME~PRICE~SCORE~CRITICS~STORE~WHAT~WHY~VALUE;SKIP;NAME~PRICE~REASON~WHY;NAME~PRICE~REASON~WHY)
READ is how many wines you could read, and UNREAD how many you couldn't (0 if none). For each pick: NAME is the wine as written on the list (with its vintage if shown); PRICE is the price as on the list, for example 63, or glass 5 oz 12 8 oz 19 bottle 54 (up to ten words); SCORE is the best critic score you know as a number out of 100, or empty; CRITICS is what critics say, with who gave the score and for which vintage, up to twenty-five words, or empty; STORE is the usual store price, up to ten words, or empty; WHAT is what the wine is, up to sixty words; WHY is why it suits my meal and budget, up to thirty-five words; VALUE is your verdict on the price, with the sums, up to twenty-five words. For WHAT, CRITICS, WHY and VALUE, reuse the sentences you wrote above for that pick, shortened only if needed. After the picks, write the word SKIP, then one entry per wine to skip: NAME and PRICE as above, REASON exactly one of Overpriced, Wrong for your food, Weak reviews, Past its best, and WHY up to fifteen words (leave out SKIP and its entries if there are none). Use + instead of spaces, and no semicolons or tildes anywhere inside the entries. Under the link, in bold: "Tap this to see tonight's picks in your Wine Finder."`;

function dinePrompt() {
  const bits = [];
  const food = [...dine.food], typed = $("dine-food-text").value.trim();
  if (typed) food.push(typed);
  if (food.length) bits.push(`I'm eating: ${food.join(", ").toLowerCase()}.`);
  if (dine.colour !== "Any") bits.push(`I'd like ${dine.colour === "Sparkling" ? "a sparkling wine" : `a ${dine.colour.toLowerCase()}`}.`);
  const budget = dineBudgetText();
  if (dine.serve === "By the glass") {
    bits.push("I'd like wine by the glass, not a whole bottle.");
    if (budget) bits.push(`My budget is ${budget} a glass.`);
  } else if (dine.serve === "Bottle") {
    bits.push("I'd like a bottle.");
    if (budget) bits.push(`My budget is ${budget} a bottle.`);
  } else {
    bits.push("I'm happy with wine by the glass or a bottle: consider both, say for each pick whether it's by the glass or a bottle, and if a wine is offered both ways, give both prices.");
    if (budget) bits.push(`My budget is ${budget} for a bottle (glass prices can be anything sensible).`);
  }
  const about = String(storeGet(STORE.aboutMe, "") || "").trim();
  const guide = [...dine.food].filter((f) => DINE_GUIDE[f]).map((f) => `${f}: ${DINE_GUIDE[f]}`);
  const build = (g) => DINE_TEMPLATE
    .replace("{GUIDE}", g.length ? `Use this pairing guidance from two pairing books (Dornenburg & Page, What to Drink with What You Eat; Harrington, Food and Wine Pairing) alongside your own knowledge. ${DINE_PRINCIPLES} ${g.join(" ")}\n` : `${DINE_PRINCIPLES}\n`)
    .replace("{CHOICES}", bits.join(" "))
    .replace("{ABOUT_ME}", about ? `About me: ${about}` : "")
    .replace("{BASE}", location.href.split("#")[0].split("?")[0]);
  // the books' guidance goes only while the whole prompt still fits in the link
  let out = build(guide);
  while (guide.length && claudeLink(out).prefilled === false) { guide.pop(); out = build(guide); }
  return out;
}

function renderDine() {
  const chip = (group, v, on) => `<button type="button" class="btn chip" data-dine-group="${group}" data-value="${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`;
  $("dine-food").innerHTML = DINE_CHOICES.food.map((v) => chip("food", v, dine.food.has(v))).join("");
  for (const g of ["colour", "serve"]) $(`dine-${g}`).innerHTML = DINE_CHOICES[g].map((v) => chip(g, v, dine[g] === v)).join("");
  const sc = dineScale();
  for (const id of ["dine-lo", "dine-hi"]) { $(id).max = sc.max; $(id).step = sc.step; }
  $("dine-lo").value = dine.lo;
  $("dine-hi").value = dine.hi;
  showDineBudget();
  renderDineRecall();
}

function dineChoose(group, value) {
  if (group === "food") { if (dine.food.has(value)) dine.food.delete(value); else dine.food.add(value); }
  else if (group === "budget") { const pr = dineScale().presets.find((x) => x[0] === value); if (pr) [, dine.lo, dine.hi] = pr; }
  else {
    const scaleBefore = dineScale();
    dine[group] = value;
    if (dineScale() !== scaleBefore) { dine.lo = 0; dine.hi = dineScale().max; } // glass and bottle prices differ
  }
  renderDine();
}

// The numbers above the sliders, and which preset (if any) matches them.
function showDineBudget() {
  const sc = dineScale(), unit = dine.serve === "By the glass" ? " a glass" : " a bottle";
  $("dine-lo-v").textContent = `$${dine.lo}`;
  $("dine-hi-v").textContent = dine.hi >= sc.max ? "no limit" : `$${dine.hi}`;
  $("dine-budget-unit").textContent = unit;
  $("dine-budget").innerHTML = sc.presets.map(([label, lo, hi]) => `<button type="button" class="btn chip" data-dine-group="budget" data-value="${esc(label)}" aria-pressed="${dine.lo === lo && dine.hi === hi}">${esc(label)}</button>`).join("");
}

// Dragging a slider: the two can't cross; the other one moves along.
function dineSlide(which) {
  const v = +$(which === "lo" ? "dine-lo" : "dine-hi").value;
  if (which === "lo") { dine.lo = v; if (dine.hi < v) dine.hi = v; } else { dine.hi = v; if (dine.lo > v) dine.lo = v; }
  $("dine-lo").value = dine.lo;
  $("dine-hi").value = dine.hi;
  showDineBudget();
}
document.addEventListener("input", (e) => {
  if (e.target.id === "dine-lo") dineSlide("lo");
  else if (e.target.id === "dine-hi") dineSlide("hi");
});

// "Fish, white, $60–100": what was asked for, shown with the picks.
function dineAskText() {
  const food = [...dine.food], typed = $("dine-food-text").value.trim();
  if (typed) food.push(typed);
  const budget = dineBudgetText();
  return [food.join(", ").toLowerCase(), dine.colour !== "Any" ? dine.colour.toLowerCase() : "",
    budget ? `${budget} ${dine.serve === "By the glass" ? "a glass" : "a bottle"}` : "",
    dine.serve === "By the glass" ? "by the glass" : dine.serve === "Bottle" ? "a bottle" : ""].filter(Boolean).join(", ");
}

async function dineGo() {
  storeSet(STORE.dineAsk, { ask: dineAskText(), at: new Date().toISOString() });
  const prompt = dinePrompt();
  const { url, prefilled } = claudeLink(prompt);
  const steps = $("dine-steps");
  steps.hidden = false;
  steps.textContent = prefilled ? "Opening Claude…" : "Copying your question and opening Claude…";
  const r = await openClaudeHere(url, prompt, true);
  if (r.newTab) steps.innerHTML = newTabMessage(r, url);
}

// The link back: #dine=NAME~PRICE~SCORE~WHY;...  It comes from Claude's answer, so every
// field is checked and kept short.
function parseDineHash(hash) {
  const m = /^#dine=([\s\S]*)$/.exec(hash || "");
  if (!m) return null;
  let raw = m[1].replace(/\+/g, " ");
  try { raw = decodeURIComponent(raw); } catch { /* keep as is */ }
  const parts = raw.split(";");
  const clip = (t, n) => (t || "").replace(/\s+/g, " ").trim().slice(0, n) || null;
  let read = null, unread = null;
  const head = parts[0].split("~").map((t) => t.trim());
  if (head.length <= 2 && head.every((t) => /^\d{0,3}$/.test(t))) { // the count: READ~UNREAD
    read = head[0] ? +head[0] : null;
    unread = head[1] ? +head[1] : null;
    parts.shift();
  }
  // A stray semicolon inside a sentence would split a pick: each pick has a known number
  // of fields (8, or 4 in older links), so pieces are joined back until they're complete.
  const tildes = (t) => (t.match(/~/g) || []).length;
  const skipAt = parts.findIndex((t) => /^\s*skip\s*$/i.test(t));
  const pickParts = skipAt >= 0 ? parts.slice(0, skipAt) : parts;
  const skipParts = skipAt >= 0 ? parts.slice(skipAt + 1) : [];
  const join = (list, need) => {
    const out = [];
    for (const part of list) {
      // still short of its fields, or a piece with no fields at all (the rest of a sentence)
      if (out.length && (tildes(out[out.length - 1]) < need || !tildes(part))) out[out.length - 1] += `;${part}`;
      else out.push(part);
    }
    return out;
  };
  const need = read != null || pickParts.some((t) => tildes(t) > 3) ? 7 : 3; // newer links start with the count
  const entries = join(pickParts, need);
  const skips = [];
  for (const part of join(skipParts, 3).slice(0, 5)) {
    const f = part.split("~");
    const name = clip(f[0], 120);
    if (name) skips.push({ name, price: clip(f[1], 40), reason: clip(f[2], 40), why: clip(f.slice(3).join(" "), 200) });
  }
  const picks = [];
  for (const part of entries.slice(0, 5)) {
    const f = part.split("~");
    const name = clip(f[0], 120);
    if (!name) continue;
    const sc = parseInt(f[2], 10);
    const pick = { name, price: clip(f[1], 40), score: sc >= 50 && sc <= 100 ? sc : null };
    if (f.length <= 4) pick.why = clip(f.slice(3).join(" "), 160); // an older, shorter link
    else Object.assign(pick, { critics: clip(f[3], 250), store: clip(f[4], 100), what: clip(f[5], 600),
      why: clip(f[6], 350), value: clip(f[7], 250) });
    picks.push(pick);
  }
  return { read, unread, picks, skips };
}

function showDinePicks(d) {
  if (!d || !Array.isArray(d.picks)) return;
  const n = d.picks.length;
  const when = d.at ? new Date(d.at) : null;
  $("dine-when").textContent = when && !isNaN(when)
    ? `Picked ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : d.date ? `Picked ${shortDate(d.date)}` : "";
  const read = d.read != null ? `Your photo showed <strong>${d.read} wines</strong>${d.unread ? ` (${d.unread} couldn't be read)` : ""}. ` : "";
  $("dine-intro").innerHTML = n ? `${read}Claude ${d.read != null ? "read them all and " : ""}chose the <strong>${n === 1 ? "best one" : `${n} best`}</strong>` +
    `${d.ask ? ` for ${esc(d.ask)}` : ""}.` : "";
  const fam = (p) => familyLinksHtml({ id: `dine:${fold(p.name)}`, name: p.name });
  // The price as Claude wrote it, with "$" on the amounts but not on sizes:
  // "glass 5 oz 11 8 oz 18 bottle 63" -> "🥂 glass 5 oz $11 · 8 oz $18 · 🍾 bottle $63"
  const price = (p) => {
    if (p.price == null || p.price === "") return "";
    let t = esc(String(p.price).replace(/\$/g, "").replace(/\s+/g, " ").trim());
    t = t.replace(/(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])(?!\s*(?:oz|ml|cl|l\b|%))/gi, '<span class="dine-price">$$$1</span>');
    t = t.replace(/\bglass\b/i, "🥂 glass").replace(/\bbottle\b/i, "🍾 bottle")
      .replace(/(<\/span>)\s+(?=\d+\s*(?:oz|ml|cl)|🍾)/g, "$1 · ");
    return ` · ${t}`;
  };
  $("dine-rank").innerHTML = n ? d.picks.map((p) => `<li><strong>${esc(p.name)}</strong>${price(p)}` +
    `${p.score != null ? ` · Critics ${p.score}` : ""}</li>`).join("") : "<li>The link didn't contain any picks that could be read.</li>";
  const skips = Array.isArray(d.skips) ? d.skips : [];
  const REASON_CLASS = [[/overpriced/i, "over"], [/food/i, "food"], [/review/i, "weak"], [/past|old|tired/i, "past"]];
  const tag = (r) => (r ? `<span class="skip-tag skip-${(REASON_CLASS.find(([re]) => re.test(r)) || [, "weak"])[1]}">${esc(r)}</span>` : "");
  $("dine-skip").hidden = !skips.length;
  $("dine-skip").innerHTML = skips.length ? `<h3 class="dine-sub skip-h">⛔ Wines to skip</h3><ul class="skip-list">${skips.map((k) =>
    `<li><span class="skip-x" aria-hidden="true">✕</span><div><strong>${esc(k.name)}</strong>${price(k)} ${tag(k.reason)}` +
    `${k.why ? `<div class="skip-why">${esc(k.why)}</div>` : ""}</div></li>`).join("")}</ul>` : "";
  const row = (label, text) => (text ? `<p><strong>${label}:</strong> ${esc(text)}</p>` : "");
  $("dine-list").innerHTML = d.picks.map((p, i) => `<section class="dine-detail">
      <h3>${i + 1}. ${esc(p.name)}${price(p)}</h3>
      ${p.what ? `<p>${esc(p.what)}</p>` : ""}
      ${row("Critics", [p.score != null ? `about ${p.score}` : "", p.critics].filter(Boolean).join(", "))}
      ${row("With your meal", p.why)}
      ${row("Value", [p.value, p.store && !/store/i.test(p.value || "") ? `(in stores: ${p.store})` : ""].filter(Boolean).join(" "))}
      ${fam(p)}</section>`).join("");
  $("dine-details-h").hidden = !n;
  $("dine-dialog").showModal?.();
  $("dine-title").focus(); // open at the top (the ranking), not scrolled down to Close
  $("dine-dialog").scrollTop = 0;
}

// The last 5 restaurant results, newest first (on this phone only).
function dineHistory() {
  let h = storeGet(STORE.dineHistory, null);
  if (!Array.isArray(h)) { const last = storeGet(STORE.dine, null); h = last ? [last] : []; } // from before the history
  return h.filter((d) => d && Array.isArray(d.picks)).slice(0, 5);
}
const isToday = (d) => d && (d.at ? new Date(d.at).toDateString() === new Date().toDateString() : d.date === todayIso());

function dineLabel(d) {
  const when = d.at ? new Date(d.at) : null;
  const time = when && !isNaN(when)
    ? `${when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : shortDate(d.date || "");
  const n = d.picks.length, k = (d.skips || []).length;
  return [time, d.ask, `${n} ${n === 1 ? "pick" : "picks"}`, k ? `${k} to skip` : ""].filter(Boolean).join(" · ");
}

// The top-bar button (all day after a run) and the list at the top of the restaurant page.
function renderDineRecall() {
  const h = dineHistory();
  $("btn-tonight").hidden = !isToday(h[0]);
  if (!$("dine-recent")) return;
  $("dine-recent").hidden = !h.length;
  $("dine-recent-list").innerHTML = h.map((d, i) => `<li><button type="button" class="btn dine-recent-btn" data-dine-hist="${i}">
      🍷 ${esc(dineLabel(d))}</button></li>`).join("");
}

function offerDinePicks() {
  const got = parseDineHash(location.hash);
  if (!got) return;
  history.replaceState(history.state, "", location.pathname + location.search);
  const asked = storeGet(STORE.dineAsk, null) || {};
  const d = { ...got, date: todayIso(), at: new Date().toISOString(), ask: asked.ask || "" };
  const before = dineHistory(); // read first: it falls back to STORE.dine, which is about to change
  storeSet(STORE.dine, d);
  storeSet(STORE.dineHistory, [d, ...before].slice(0, 5)); // the last 5 stay on this phone
  renderDineRecall();
  showDinePicks(d);
}

// ---- Claude Research Results: Claude's full write-ups, kept and shared ----------------
// When someone saves Claude's ratings, the page also keeps Claude's write-up (copied with
// Claude's copy button), split into one report per wine. It stays on that computer and goes
// to the website keeper's inbox (a Google Sheet, see scripts/inbox.gs); the keeper publishes
// it to data/notes/<code>.json, and every card for that wine gets a "Claude Research
// Results" button. The keeper's own saves publish straight away.
const INBOX_URL = "https://script.google.com/macros/s/AKfycbxQ340N661mKKfIJ3FEpHnlqEcIANI2kyYx2LO-4FAeoPlkDSAwxxoYE9caOU3vI_bo/exec";
const NOTES_DIR = "data/notes";
let noteIndex = {}; // published write-ups: {code: {name, from, date}}
const localNotes = () => { const n = storeGet(STORE.notes, {}); return n && typeof n === "object" ? n : {}; };
const isKeeper = () => !!storeGet(STORE.ghKey, "");
const myName = () => String(storeGet(STORE.myName, "") || "").trim();

// Every write-up the family has for this wine, under any of its records.
function notesFor(w) {
  if (!w) return [];
  // a private cellar's wines have their own codes; the published write-ups use the shared ones
  const ids = new Set([w.id, sharedIdOf(w.id), ...(cellarMatches(w).ids || []).flatMap((id) => [id, sharedIdOf(id)])].filter(Boolean));
  const local = localNotes(), out = new Map();
  for (const [id, n] of Object.entries(local)) {
    if (ids.has(id) || ids.has(sharedIdOf(id)) || (id.startsWith("typed-") && n.name && sameWineName(w.name, n.name))) out.set(sharedIdOf(id) || id, { id, ...n, local: true });
  }
  for (const [id, n] of Object.entries(noteIndex)) {
    if (out.has(id)) continue;
    if (ids.has(id) || (id.startsWith("typed-") && n.name && sameWineName(w.name, n.name))) out.set(id, { id, ...n });
  }
  return [...out.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const researchButton = (w) => (notesFor(w).length
  ? `<button type="button" class="btn btn-results" data-notes="${esc(w.id)}">📖 Claude Research Results</button>` : "");

// Claude's answer arrives as Markdown (from its copy button). A small, safe renderer:
// headings, bold, italics, lists, rules and http(s) links; everything else is plain text.
function mdInline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
}
function mdToHtml(md) {
  const out = [];
  let list = null, para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${mdInline(para.join(" "))}</p>`); para = []; }
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (const raw of String(md || "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { flush(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); out.push("<hr>"); continue; }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flush(); const h = Math.min(6, m[1].length + 2); out.push(`<h${h}>${mdInline(m[2])}</h${h}>`); continue; }
    if ((m = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line))) {
      if (para.length) { out.push(`<p>${mdInline(para.join(" "))}</p>`); para = []; }
      const want = /^\d/.test(m[1]) ? "ol" : "ul";
      if (list !== want) { if (list) out.push(`</${list}>`); out.push(`<${want}>`); list = want; }
      out.push(`<li>${mdInline(m[2])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list}>`); list = null; }
    para.push(line);
  }
  flush();
  return out.join("");
}

// Claude's whole answer -> {code: that wine's report}. Each wine's section starts with a
// heading ending in its code; the shared Sources go with every wine. Dropped: the save
// link and its notes, "Where to buy", the ranking and "My rating" (the rating is kept apart).
function splitWriteup(text, ids) {
  const lines = String(text || "").replace(/\r/g, "").split("\n")
    .filter((l) => !/save link is at the bottom|your save link|save these ratings to my wine finder|click this to keep these ratings|first press the copy button|create a doc|to save this research|^\W*step [12]:/i.test(l));
  const isHead = (l) => /^#{1,6}\s/.test(l.trim());
  const isSources = (l) => /^(#{1,6}\s*)?\**sources:?\**\s*$/i.test(l.trim());
  const isRule = (l) => /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim());
  const DROP = /where to buy|ranking by what reviewers say|^#{1,6}\s*my rating/i;
  const starts = [];
  lines.forEach((l, i) => { if (isHead(l)) for (const id of ids) if (l.includes(id)) starts.push({ i, id }); });
  starts.sort((a, b) => a.i - b.i);
  // A Sources list after the last wine is shared; one inside a wine's section is its own.
  const lastStart = starts.length ? starts[starts.length - 1].i : 0;
  let srcAt = lines.findIndex((l, i) => i > lastStart && isSources(l));
  // ...unless it belongs to the last wine (it then sits before the ranking): a shared list comes after it
  const rankAt = lines.findIndex((l, i) => i > lastStart && /ranking by what reviewers say/i.test(l));
  if (starts.length > 1 && srcAt >= 0 && rankAt > srcAt) srcAt = -1;
  const srcEnd = srcAt >= 0 ? lines.findIndex((l, i) => i > srcAt && isRule(l)) : -1;
  const shared = srcAt >= 0 ? lines.slice(srcAt + 1, srcEnd > 0 ? srcEnd : undefined).filter((l) => l.trim()) : [];
  const body = srcAt >= 0 ? lines.slice(0, srcAt) : lines;
  // "My rating at the bottom is for the 2022": that section isn't kept, so neither is the pointer to it.
  const noPointer = (l) => l.replace(/[^.!?]*\bmy (?:own )?(?:rating|score)\b[^.!?]*\b(?:bottom|below|at the end|further down)\b[^.!?]*[.!?]\s*/gi, "");
  const clean = (part) => {
    const keep = [];
    let dropping = false;
    for (const l of part) {
      if (isHead(l)) dropping = DROP.test(l);
      else if (/^\**(my rating|where to buy)/i.test(l.trim())) continue; // kept apart, or goes stale
      if (!dropping) keep.push(noPointer(l).replace(/\s*\[(?:bcl|bsw|zyn|cellar|manual|typed)-[\w.-]+\]/g, ""));
    }
    return keep.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  // A shared source goes to the wine its title or link names (or whose section links to it);
  // one that names no wine, such as a general article on the region, goes to every wine.
  const sourcesFor = (id, section) => {
    if (!shared.length) return "";
    const own = (l, sec, heading) => {
      const url = (l.match(/\((https?:\/\/[^\s)]+)\)/) || [])[1];
      if (url && sec.includes(url)) return true;
      const words = new Set(nameTokens(l));
      return storeTokens(heading).some((t) => words.has(t) && !GRAPE_WORDS.has(t));
    };
    const heads = starts.map((s) => ({ id: s.id, heading: lines[s.i].replace(/\[[^\]]*\]/g, ""), sec: s.sec }));
    const mine = heads.find((h) => h.id === id);
    const picked = shared.filter((l) => {
      const owners = heads.filter((h) => own(l, h.sec, h.heading));
      return owners.length ? owners.some((h) => h.id === id) : true;
    });
    return mine && picked.length ? `Sources:\n${picked.join("\n")}` : "";
  };
  const out = {};
  if (starts.length) {
    starts.forEach((st, k) => { st.sec = body.slice(st.i, k + 1 < starts.length ? starts[k + 1].i : body.length).join("\n"); });
    for (const st of starts) {
      const t = clean(st.sec.split("\n"));
      const src = sourcesFor(st.id, st.sec);
      if (t) out[st.id] = (t + (src ? `\n\n${src}` : "")).slice(0, 40000);
    }
  } else if (ids.length === 1) { // one wine and no code in the heading: the whole answer is about it
    const t = clean(body);
    if (t) out[ids[0]] = (t + (shared.length ? `\n\nSources:\n${shared.join("\n")}` : "")).slice(0, 40000);
  }
  return out;
}

// The copied text must be this answer: it contains the very save link that opened the box.
// (An earlier answer about the same wines has a different link, so it isn't accepted.)
// Links are compared decoded, since characters can be written differently on the way.
const normLink = (h) => {
  let s = String(h || "").replace(/^#?save=/, "").replace(/\+/g, " ");
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  return s.replace(/\s+/g, " ").trim();
};
function isThisAnswer(t, ids) {
  if (typeof t !== "string" || t.length < 300 || !pendingHash) return false;
  const want = normLink(pendingHash);
  return (t.match(/#save=[^\s)\]>"']+/g) || []).some((h) => normLink(h) === want);
}

// Save shows only once Claude's write-up for this answer has been found.
function showWriteupState() {
  const found = !!writeupText, done = !!$("save-yes").dataset.done;
  $("save-writeup-state").innerHTML = found
    ? "✅ <strong>Claude's write-up found.</strong> Press Save to keep it with the ratings."
    : "❌ <strong>Claude's write-up hasn't been copied yet.</strong>";
  $("save-howto").hidden = found || done;
  if (!done) $("save-yes").hidden = !found;
}

async function checkWriteup(fromButton = false) {
  if (!$("save-dialog").open || $("save-writeup").hidden || writeupText) return;
  const ids = (pendingSave || []).map((it) => it.id);
  const pasted = $("save-writeup-text").value.trim();
  if (isThisAnswer(pasted, ids)) writeupText = pasted;
  else {
    try {
      const clip = await navigator.clipboard.readText();
      if (isThisAnswer(clip, ids)) writeupText = clip;
      else if (fromButton) $("save-result").textContent = clip.trim()
        ? "What's copied isn't this Claude answer. Go back to Claude and click the copy icon under this answer."
        : "Nothing is copied yet. Go back to Claude and click the copy icon under its answer.";
    } catch {
      if (fromButton) $("save-result").textContent = "The browser didn't allow checking. Paste Claude's answer in the box below instead.";
    }
  }
  if (writeupText) $("save-result").textContent = "";
  showWriteupState();
}
// Coming back from the Claude tab, or pasting: look again.
window.addEventListener("focus", () => checkWriteup());
document.addEventListener("input", (e) => { if (e.target.id === "save-writeup-text") checkWriteup(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkWriteup(); });

async function sendToInbox(items, from) {
  const r = await fetch(INBOX_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "submit", from, items }) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "inbox");
  return d.received;
}

async function inboxCall(body) {
  const key = storeGet(STORE.inboxKey, "");
  const r = await fetch(INBOX_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...body, key }) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error === "not allowed" ? "The inbox key isn't right." : d.error || "inbox");
  return d;
}

// Create or replace one file in the repository.
async function ghPutFile(path, text, message) {
  let sha;
  try { sha = (await ghFetch("GET", null, path)).sha; } catch { sha = undefined; } // a new file
  await ghFetch("PUT", { message, content: toBase64(text), branch: PUBLISH.branch, ...(sha ? { sha } : {}) }, path);
}

// The keeper publishes ratings and write-ups: [{id, name, claude, mine, writeup, from, date}]
async function publishResearch(items) {
  const pub = items.map((it) => ({ ...it, id: sharedIdOf(it.id) })).filter((it) => it.id);
  if (!pub.length) return 0;
  const data = await ghUpdate(PUBLISH.path, (d) => {
    d.updated = todayIso();
    d.ratings = d.ratings && typeof d.ratings === "object" ? d.ratings : {};
    for (const it of pub) {
      const e = d.ratings[it.id] || {};
      if (it.name) e.name = it.name;
      const t = findWine(it.id)?.type, u = gtin(findWine(it.id)?.upc);
      if (t) e.type = t;
      if (u) e.upc = u;
      if (it.claude) e.claude = it.from ? { ...it.claude, from: it.from } : it.claude;
      if (it.mine) e.family = it.mine;
      if (e.claude || e.family) d.ratings[it.id] = e;
    }
  }, `Family ratings (${pub.length} from ${pub[0].from || "the family"})`);
  familyRatings = data.ratings;
  const withNotes = pub.filter((it) => it.writeup);
  for (const it of withNotes) {
    await ghPutFile(`${NOTES_DIR}/${it.id}.json`,
      JSON.stringify({ id: it.id, name: it.name, from: it.from, date: it.date, text: it.writeup }, null, 1) + "\n",
      `Claude research: ${it.name}`);
  }
  if (withNotes.length) {
    const idx = await ghUpdate(`${NOTES_DIR}/index.json`, (d) => {
      d.updated = todayIso();
      d.notes = d.notes && typeof d.notes === "object" ? d.notes : {};
      for (const it of withNotes) d.notes[it.id] = { name: it.name, from: it.from, date: it.date };
    }, `Claude research index (${withNotes.length})`);
    noteIndex = idx.notes;
  }
  return pub.length;
}

// The reader: one or more write-ups in a large dialog.
async function openNotes(id) {
  openNotesId = id;
  const w = findWine(id) || { id, name: ratingOf(id).name || frOf(id).name || noteIndex[id]?.name || id };
  const list = notesFor(w);
  $("notes-title").textContent = `Claude Research Results: ${w.name}`;
  $("notes-body").innerHTML = `<p class="hint">Loading…</p>`;
  $("notes-dialog").classList.remove("quick-reader");
  readerScale();
  readerStop();
  $("notes-dialog").showModal?.();
  const parts = [];
  for (const n of list) {
    let text = noteIndex[sharedIdOf(n.id) || n.id] ? "" : n.text; // published: read the website's copy
    if (!text) {
      try { text = (await fetch(`${NOTES_DIR}/${encodeURIComponent(sharedIdOf(n.id) || n.id)}.json`, FRESH).then((r) => r.json())).text; } catch { text = n.text || ""; }
    }
    parts.push(`<section class="note"><p class="note-meta">Researched by ${esc(n.from || "the family")}${n.date ? ` · ${esc(shortDate(n.date))}` : ""}` +
      `${n.name && n.name !== w.name ? ` · as “${esc(n.name)}”` : ""}${n.local && !noteIndex[sharedIdOf(n.id) || n.id] ? " · on this computer only" : ""}</p>` +
      (text ? mdToHtml(text) : `<p>This write-up couldn't be loaded. Please try again later.</p>`) + `</section>`);
  }
  $("notes-body").innerHTML = parts.join("<hr class='note-sep'>") || "<p>No write-up found.</p>";
}

// Reading comfort for the write-ups: text size (A− / A+, remembered in this browser) and
// reading aloud with the browser's own voice, a paragraph at a time (Chrome stops a single
// long utterance part way through).
const READER_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.7];
function readerScale(step = 0) {
  let i = READER_SCALES.indexOf(storeGet(STORE.readerScale, 1));
  if (i < 0) i = 1;
  i = Math.max(0, Math.min(READER_SCALES.length - 1, i + step));
  if (step) storeSet(STORE.readerScale, READER_SCALES[i]);
  $("notes-body")?.style.setProperty("--reader-scale", READER_SCALES[i]);
  if ($("reader-smaller")) $("reader-smaller").disabled = i === 0;
  if ($("reader-bigger")) $("reader-bigger").disabled = i === READER_SCALES.length - 1;
}
const canSpeak = () => "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
function readerButtons(state) { // "idle", "speaking" or "paused"
  if (!$("reader-speak")) return;
  $("reader-speak").hidden = !canSpeak() || state !== "idle";
  $("reader-pause").hidden = state === "idle";
  $("reader-pause").textContent = state === "paused" ? "▶ Carry on" : "⏸ Pause";
  $("reader-stop").hidden = state === "idle";
}
// The most natural English voice this browser already has, so nobody has to set anything:
// Edge's "Natural" voices, then Chrome's Google voices, then Safari's Enhanced or Premium
// voices and its good standard ones (Samantha, Daniel, Karen…). The old Windows voices
// (David, Zira, Mark) only when there's nothing else.
function voiceScore(v) {
  const n = v.name;
  if (!/^en([-_]|$)/i.test(v.lang)) return -1;
  let sc = /Natural/i.test(n) ? 100 : /^Google UK English Female/i.test(n) ? 95 : /^Google US English/i.test(n) ? 93 : /^Google/i.test(n) ? 90
    : /Premium/i.test(n) ? 88 : /Enhanced/i.test(n) ? 85 : /^(Samantha|Ava|Zoe|Daniel|Karen|Moira|Tessa|Serena|Allison|Susan|Kate|Oliver|Evan|Nathan)\b/i.test(n) ? 70
    : /Microsoft (David|Zira|Mark|Hazel|George|Susan|Linda|Richard|Catherine|James)\b/i.test(n) && !/Online/i.test(n) ? 10 : 40;
  if (/^en[-_](CA|GB)/i.test(v.lang)) sc += 2;
  else if (/^en[-_](US|AU|IE)/i.test(v.lang)) sc += 1;
  return sc;
}
function bestVoice() {
  return speechSynthesis.getVoices().filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
}
// Chrome lists its voices a moment after the page loads.
const voicesReady = () => new Promise((res) => {
  if (speechSynthesis.getVoices().length) return res();
  speechSynthesis.addEventListener("voiceschanged", () => res(), { once: true });
  setTimeout(res, 1500);
});
async function readerSpeak() {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  await voicesReady();
  // a sentence at a time: Chrome's Google voices stop by themselves after about 15 seconds
  const pieces = [...$("notes-body").querySelectorAll("h1, h2, h3, h4, h5, p, li")]
    .map((el) => el.innerText.replace(/\s+/g, " ").trim()).filter(Boolean)
    .flatMap((t) => t.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) || [t]).map((t) => t.trim()).filter(Boolean);
  if (!pieces.length) return;
  const voice = bestVoice();
  pieces.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = 0.95;
    if (i === pieces.length - 1) u.onend = () => readerButtons("idle");
    speechSynthesis.speak(u);
  });
  readerButtons("speaking");
}
function readerStop() {
  if (canSpeak()) speechSynthesis.cancel();
  readerButtons("idle");
}
function readerPause() {
  if (!canSpeak()) return;
  if (speechSynthesis.paused) { speechSynthesis.resume(); readerButtons("speaking"); }
  else { speechSynthesis.pause(); readerButtons("paused"); }
}

// Everything a quick score saved, in its own olive reader, built out from what the site
// already holds: the grape notes, the pairing books (Dornenburg & Page; Harrington), our
// style estimate where Claude gave none, whether it's ready, where it's sold and the family's
// cellars. Nothing is asked of Claude again.
const grapesFromText = (t) => (t ? GRAPES.filter(([, re]) => re.test(fold(t))).map(([g]) => g) : []);
const PLAIN = {
  body: { light: "Feels light in the mouth, like skim milk: refreshing, and best with lighter food.",
    medium: "A middle weight, like 2% milk: goes with most everyday dishes.",
    full: "Rich and weighty in the mouth, like cream: stands up to hearty food." },
  tannin: { soft: "Smooth, with hardly any drying grip on your gums.",
    medium: "A gentle drying grip, like a cup of tea.",
    firm: "A noticeable drying grip on gums and tongue, like strong tea. Food, fatty meat especially, softens it, and so does age." },
  sweet: { dry: "No noticeable sweetness.", "off-dry": "A faint touch of sweetness.",
    "medium-sweet": "Clearly sweet, but still fresh.", sweet: "A dessert wine." },
  fruity: { yes: "Tastes ripe and fruity (jammy berries or plums) even though it's dry.",
    no: "More savoury than fruity: earth, herbs, spice or oak rather than ripe fruit." },
  finish: { short: "The taste fades soon after you swallow.", medium: "The taste lingers for a few seconds.",
    long: "The flavour stays for a while after you swallow, usually a sign of a good wine." },
};
const scoreWords = (n) => (n >= 95 ? "classic, among the very best" : n >= 90 ? "outstanding" : n >= 85 ? "very good" : n >= 80 ? "good" : n >= 75 ? "plain but sound" : "not recommended");
function openQuick(id, src) {
  const c = (src === "own" ? ratingOf(id).claude : frOf(id).claude) || {};
  const w = findWine(id), name = w?.name || ratingOf(id).name || frOf(id).name || id;
  const row = (label, value, plain = "") => `<tr><th scope="row">${esc(label)}</th><td>${value}${plain ? `<div class="quick-plain">${esc(plain)}</div>` : ""}</td></tr>`;
  const none = `<span class="quick-none">not given</span>`;
  const ours = ` <span class="quick-est">(our estimate)</span>`;
  const s = w ? wineStyle(w) : null;
  const pick = (cv, key, fmt = esc) => (cv != null && cv !== "" ? fmt(cv) : s?.[key]?.v != null ? `${fmt(s[key].v)}${ours}` : none);
  // Claude's grapes when it named any we know; otherwise our own reading of the name and region
  const fromClaude = grapesFromText(c.grapes);
  const grapes = fromClaude.length ? fromClaude : w ? grapesOf(w).filter((g) => grapeFits(w, g) || w.type === "Rosé") : [];
  const sec = (title, body) => (body ? `<h4>${esc(title)}</h4>${body}` : "");

  // The score and what Claude gave
  const scoreRows = [
    row("Score", c.points != null ? `<strong>${c.points}</strong> out of 100${c.vintage ? ` for the ${esc(String(c.vintage))} vintage` : ""}` : "Claude found no reviews",
      c.points != null ? `That's ${scoreWords(c.points)}. Reviewers' scale: 95 and up classic, 90–94 outstanding, 85–89 very good, 80–84 good.` : ""),
    row("What it rests on", c.note ? esc(c.note) : none),
    row("Grapes", c.grapes ? esc(c.grapes) : grapes.length ? `${esc(grapes.map(PLAIN_GRAPE).join(", "))}${ours}` : none,
      /field blend/i.test(c.grapes || "") ? "A field blend: many grape varieties grown together in one (often old) vineyard and picked and fermented together." : ""),
  ];
  // How it tastes: Claude's words, else our estimate (labelled)
  const val = (cv, key) => (cv != null && cv !== "" ? cv : s?.[key]?.v ?? null);
  const fr = c.fruity != null ? c.fruity : s?.fruity?.v ?? null;
  const tasteRows = [
    row("Body", pick(c.body, "body"), PLAIN.body[val(c.body, "body")] || "How heavy the wine feels in your mouth."),
    ...(w?.type === "Red" || c.tannin ? [row("Tannin", pick(c.tannin, "tannin"), PLAIN.tannin[val(c.tannin, "tannin")] || "The drying grip a red leaves on your gums, from the grape skins and oak.")] : []),
    row("Sweetness", pick(c.sweet, "sweet"), PLAIN.sweet[val(c.sweet, "sweet")] || ""),
    row("Fruit-forward", c.fruity != null ? (c.fruity ? "Yes" : "No") : s?.fruity?.v != null ? `${s.fruity.v ? "Yes" : "No"}${ours}` : none,
      fr == null ? "" : PLAIN.fruity[fr ? "yes" : "no"]),
    row("Finish", c.finish ? esc(c.finish) : none, PLAIN.finish[c.finish] || "How long the taste lasts after you swallow."),
    row("Drink", c.drinkFrom ? `${c.drinkFrom}–${c.drinkTo}${c.drinkFrom <= THIS_YEAR && THIS_YEAR <= c.drinkTo + 2 ? " (ready now)" : c.drinkFrom > THIS_YEAR ? " (best kept a while yet)" : " (past its best window)"}`
      : s?.ready?.ready != null ? `${s.ready.ready ? "Ready now" : "Better kept a while"}${ours}` : none,
      "The years it's expected to taste its best. “Ready now” means there's no need to keep it in a cellar first."),
  ];
  // Food: Claude's pick, then the classic and adventurous matches with the books' dishes
  let food = c.pair ? `<p><strong>Claude's pick:</strong> ${esc(c.pair)}.</p>` : "";
  if (w) {
    const classic = foodsOf(w).map((f) => ({ f, t: wineTier(w, f) })).sort((a, b) => b.t - a.t).slice(0, 5);
    if (classic.length) food += `<ul class="quick-food">${classic.map(({ f, t }) => {
      const dish = pairDish(w, f), b = bookDishes(w, f, dish);
      const book = b ? ` Dornenburg & Page also list ${esc(b.list.map((x) => x.d).join(", "))}.` : "";
      return `<li><span class="food-star tier-${t}">${STARS(t)}</span> <strong>${esc(f)}:</strong> ${esc(dish)}.${book}</li>`;
    }).join("")}</ul>`;
    const adv = boldFoodsOf(w).slice(0, 3);
    if (adv.length) food += `<p><strong>Adventurous:</strong></p><ul class="quick-food">${adv.map((b) =>
      `<li>🍷 <strong>${esc(b.food)}:</strong> ${esc(b.rule.dish(advContext(w)) || "")}. ${esc(b.rule.why)}${b.rule.warn ? `; ${esc(b.rule.warn)}` : ""}. <span class="quick-src">(${esc(b.rule.src)})</span></li>`).join("")}</ul>`;
    if (food) food += `<p class="quick-src">★★★ the go-to · ★★ a common match · ★ pairs, but less often chosen (Dornenburg & Page's pairing guide).</p>`;
  }
  // The grapes, in plain words
  const grapeInfo = grapes.filter((g) => GRAPE_INFO[g]).map((g) => `<li><strong>${esc(g)}:</strong> ${esc(GRAPE_INFO[g])}</li>`).join("");
  // Where to find it
  const where = w ? [
    w.kind !== "cellar" && w.price != null ? `<li>${esc(sourceLabel(w.source))}: <strong>${priceHtml(w)}</strong></li>` : "",
    ...(w.kind !== "cellar" ? cellarSummaryHtml(w).map((h) => `<li>${h}</li>`) : []),
  ].filter(Boolean).join("") : "";
  const older = olderQuick(c) ? `<p class="hint">This quick score is from before quick scores gathered the style, grapes and food, so much of this card is our own estimate. The next “Get quick Claude scores” run that includes this wine fills them in.</p>` : "";

  $("notes-title").textContent = `Claude quick score: ${name}`;
  $("notes-body").innerHTML = `<section class="note quick-card">` +
    `<p class="note-meta">Scored ${c.date ? esc(shortDate(c.date)) : ""}${c.from ? ` by ${esc(c.from)}` : ""}</p>` +
    `<table class="quick-table">${scoreRows.join("")}</table>${older}` +
    sec("How it tastes", `<table class="quick-table">${tasteRows.join("")}</table>`) +
    sec("Food", food) +
    sec(grapes.length > 1 ? "The grapes" : "The grape", grapeInfo ? `<ul class="quick-food">${grapeInfo}</ul>` : "") +
    sec("Where to find it", where ? `<ul class="quick-food">${where}</ul>` : "") +
    `<p class="hint">A quick score is a short check of the reviews; the rest of this card comes from the Wine Finder's own data and pairing books. For the full story (the estate, the reviews, how it tastes), add the wine to the Short List and ask Claude to research it.</p></section>`;
  readerScale();
  readerStop();
  $("notes-dialog").classList.add("quick-reader");
  $("notes-dialog").showModal?.();
}

function showWriteup(title, meta, text) {
  $("notes-title").textContent = title;
  $("notes-body").innerHTML = `<section class="note"><p class="note-meta">${esc(meta)}</p>${mdToHtml(text)}</section>`;
  $("notes-dialog").classList.remove("quick-reader");
  readerScale();
  readerStop();
  $("notes-dialog").showModal?.();
}

// ---- The keeper's inbox (My wines) -------------------------------------------------
let inboxItems = [];

async function loadInbox() {
  if (!isKeeper()) { $("inbox-box").hidden = true; return; }
  $("inbox-box").hidden = false;
  const hasKey = !!storeGet(STORE.inboxKey, "");
  $("inbox-key-state").textContent = hasKey ? "An inbox key is saved on this computer." : "No inbox key on this computer yet.";
  if (!hasKey) { $("inbox-state").textContent = "Paste your inbox key below (the long code from makeAdminKey) to see what the family has sent."; $("inbox-list").innerHTML = ""; return; }
  $("inbox-state").textContent = "Checking for new research…";
  try {
    inboxItems = (await inboxCall({ action: "list" })).items || [];
    $("inbox-state").textContent = inboxItems.length
      ? `${inboxItems.length} new from the family, waiting for you to publish.` : "Nothing new from the family.";
    $("inbox-all").hidden = inboxItems.length < 2;
    $("inbox-all").textContent = `Publish all ${inboxItems.length}`;
    $("inbox-list").innerHTML = inboxItems.map((it) => {
      const c = it.details?.claude, m = it.details?.mine;
      return `<li class="inbox-item"><div><strong>${esc(it.name || it.id)}</strong><br>
        <span class="hint">From ${esc(it.from || "?")} · ${esc(shortDate(String(it.received).slice(0, 10)))}</span><br>
        ${c ? `Claude ${c.points ?? "no reviews"}${c.vintage ? ` (${esc(String(c.vintage))})` : ""}` : ""}${m ? ` · own rating ${m.points}` : ""}${it.writeup ? " · write-up ✓" : ""}</div>
        <div class="inbox-buttons">${it.writeup ? `<button type="button" class="btn" data-inbox-read="${it.row}">Read</button>` : ""}
        <button type="button" class="btn btn-primary" data-inbox-publish="${it.row}">Publish</button>
        <button type="button" class="btn" data-inbox-ignore="${it.row}">Ignore</button></div></li>`;
    }).join("");
  } catch (e) {
    $("inbox-state").textContent = `Couldn't open the inbox. ${e.message}`;
  }
}

const inboxToResearch = (it) => ({ id: it.id, name: it.name, claude: it.details?.claude || null, mine: it.details?.mine || null,
  writeup: it.writeup || "", from: it.from, date: String(it.received).slice(0, 10) });

// Everything waiting, in one go: one update to the ratings, each write-up, then each row marked.
async function inboxPublishAll() {
  const items = [...inboxItems];
  if (!items.length) return;
  $("inbox-all").disabled = true;
  $("inbox-state").textContent = `Publishing ${items.length}…`;
  try {
    await publishResearch(items.map(inboxToResearch));
    for (const it of items) await inboxCall({ action: "mark", row: it.row, status: "published" });
    await loadInbox();
    $("inbox-state").textContent += ` Published ${items.length}; everyone sees them after reloading.`;
    renderFamilyBox();
  } catch (e) {
    $("inbox-state").textContent = `Not done. ${e.message === "conflict" ? "Please try again in a minute." : e.message}`;
  } finally {
    $("inbox-all").disabled = false;
  }
}

async function inboxAct(row, what) {
  const it = inboxItems.find((x) => String(x.row) === String(row));
  if (!it) return;
  if (what === "read") { showWriteup(`Claude Research Results: ${it.name}`, `From ${it.from || "the family"}`, it.writeup); return; }
  $("inbox-state").textContent = what === "publish" ? `Publishing ${it.name}…` : "Ignoring…";
  try {
    if (what === "publish") {
      await publishResearch([inboxToResearch(it)]);
    }
    await inboxCall({ action: "mark", row: it.row, status: what === "publish" ? "published" : "ignored" });
    await loadInbox();
    if (what === "publish") $("inbox-state").textContent += ` Published ${it.name}; everyone sees it after reloading.`;
    renderFamilyBox();
  } catch (e) {
    $("inbox-state").textContent = `Not done. ${e.message === "conflict" ? "Please try again in a minute." : e.message}`;
  }
}

function saveInboxKey() {
  const key = $("inbox-key").value.trim();
  if (!/^[a-f0-9]{40,80}$/i.test(key)) { $("inbox-state").textContent = "That doesn't look like the inbox key (a long code of letters and numbers)."; return; }
  storeSet(STORE.inboxKey, key);
  $("inbox-key").value = "";
  loadInbox();
}

// ---- One Wine Finder tab -------------------------------------------------------------
// Claude opens its save link in a new tab. That newest tab is the one in use, so older
// Wine Finder tabs step aside: they close if the browser allows it, or say they can be closed.
const tabChannel = "BroadcastChannel" in window ? new BroadcastChannel("wine-finder") : null;
// A save link from Claude opens a new tab. If a Wine Finder tab is already open (with the
// person's place and filters), the new tab hands it the link and closes itself; the older
// tab saves the scores. Only when no other tab answers does the new tab do the saving.
const TAB_ID = Math.random().toString(36).slice(2);
let tabReady = false; // set once this tab can take a save link
if (tabChannel) tabChannel.onmessage = (e) => {
  const d = e.data || {};
  if (d.type === "newer-tab") stepAside();
  else if (d.type === "anyone" && tabReady) tabChannel.postMessage({ type: "here", to: d.from, from: TAB_ID });
  else if (d.type === "take" && d.to === TAB_ID && /^#(save|scores|share)=/.test(d.hash || "")) {
    location.hash = d.hash; // the hashchange listener offers (or, for quick scores, makes) the save
    tabChannel.postMessage({ type: "took", to: d.from, from: TAB_ID });
    const title = document.title;
    document.title = "✓ Scores arrived · " + title;
    setTimeout(() => { document.title = title; }, 15000);
  }
};
function handOffSave(hash) {
  return new Promise((resolve) => {
    if (!tabChannel) return resolve(false);
    let target = null;
    const done = (ok) => { tabChannel.removeEventListener("message", listen); resolve(ok); };
    const listen = (e) => {
      const d = e.data || {};
      if (d.to !== TAB_ID) return;
      if (d.type === "here" && !target) { target = d.from; tabChannel.postMessage({ type: "take", to: target, from: TAB_ID, hash }); }
      else if (d.type === "took" && d.from === target) done(true);
    };
    tabChannel.addEventListener("message", listen);
    tabChannel.postMessage({ type: "anyone", from: TAB_ID });
    setTimeout(() => done(false), 1500);
  });
}
function showHandedOff() {
  const card = document.querySelector("#stale-tab .stale-card");
  if (card) card.innerHTML = `<p class="big">Saved in your other Wine Finder tab.</p>
    <p>Claude's scores went to the Wine Finder tab you already had open, so your place and choices are kept there. This tab can be closed with the ✕ on its tab.</p>`;
  $("stale-tab").hidden = false;
  try { window.close(); } catch { /* the browser may not allow it */ }
}
function announceNewerTab() { tabChannel?.postMessage({ type: "newer-tab" }); }
function stepAside() {
  try { window.close(); } catch { /* not allowed */ }
  setTimeout(() => { $("stale-tab").hidden = false; }, 300);
}

// ---- Email: each person picks the email they actually use -----------------------
// A plain mailto: link opens whatever Windows thinks the email program is, which is
// often an Outlook nobody set up. So every Email button asks, remembers the answer on
// this computer, and also copies the message so it can always be pasted by hand.
const enc = encodeURIComponent;
const MAIL_APPS = [
  { id: "gmail", label: "Gmail", hint: "opens in a new tab",
    url: (s, b) => `https://mail.google.com/mail/?view=cm&fs=1&su=${enc(s)}&body=${enc(b)}` },
  { id: "outlook", label: "Outlook.com or Hotmail", hint: "opens in a new tab",
    url: (s, b) => `https://outlook.live.com/mail/0/deeplink/compose?subject=${enc(s)}&body=${enc(b)}` },
  { id: "office", label: "Outlook for work or school (Microsoft 365)", hint: "opens in a new tab",
    url: (s, b) => `https://outlook.office.com/mail/deeplink/compose?subject=${enc(s)}&body=${enc(b)}` },
  { id: "app", label: "The email program on this computer", hint: "Thunderbird, the Outlook app, Apple Mail…",
    mailto: (s, b) => `mailto:?subject=${enc(s)}&body=${enc(b)}` },
  { id: "copy", label: "Just copy the message", hint: "then paste it into any email yourself" },
];
let pendingMail = null;

function sendEmail(subject, body, report) {
  pendingMail = { subject, body, report };
  const last = storeGet(STORE.mailApp, "");
  const apps = [...MAIL_APPS].sort((a, b) => (b.id === last) - (a.id === last));
  $("mail-choices").innerHTML = apps.map((a) => `<button type="button" class="btn mail-choice${a.id === last ? " btn-primary" : ""}"
      data-mail="${a.id}">${esc(a.label)}<span class="mail-hint">${esc(a.hint)}</span></button>`).join("");
  $("mail-dialog").showModal?.();
}

function chooseMail(id) {
  const app = MAIL_APPS.find((a) => a.id === id);
  if (!app || !pendingMail) return;
  const { subject, body, report } = pendingMail;
  pendingMail = null;
  storeSet(STORE.mailApp, id);
  $("mail-dialog").close();
  let msg;
  if (app.url) {
    const url = app.url(subject, body);
    const win = window.open(url, "_blank"); // straight from the click, so it isn't blocked
    if (win) win.opener = null;
    msg = win ? `A new ${app.label} email opened in a new tab (sign in if it asks). Choose who to send it to and press Send.`
      : "Your browser stopped the new tab from opening. The message is copied: open your email, start a new message, paste it in (Ctrl+V) and send it.";
  } else if (app.mailto && app.mailto(subject, body).length < 1900) {
    location.href = app.mailto(subject, body);
    msg = "Your email program should open with a new message. If the wrong program opened (or none), press Email again and pick another choice. " +
      "For Thunderbird, it must be set as this computer's email app (Windows Settings, Apps, Default apps, Thunderbird).";
  } else {
    msg = "The message is copied. Start a new email, paste it in (Ctrl+V), choose who to send it to and press Send.";
  }
  copyText(`${subject}\n\n${body}`);
  report?.(msg);
}

// ---- Views -------------------------------------------------------------------

// ⓘ beside each section heading: jumps to that section's help.
const HELP_LINKS = [["#finder-h", "help-find"], ["#filters-h", "help-find"], ["#ew-h", "help-where"],
  ["#cellar-filter legend", "help-cellars"], ["#view-shortlist .research-head h2", "help-research"], ["#sl-add-h", "help-research"],
  ["#view-dine .research-head h2", "help-dine"], ["#dine-recent-h", "help-dine"], ["#inbox-h", "help-keeper"],
  ["#fr-h", "help-ratings"], ["#mw-import-h", "help-mywines"], ["#mw-add-h", "help-mywines"], ["#mw-backup-h", "help-mywines"]];
function addHelpButtons() {
  for (const [sel, topic] of HELP_LINKS) {
    const el = document.querySelector(sel);
    if (!el || el.querySelector(".help-i")) continue;
    el.insertAdjacentHTML("beforeend", ` <button type="button" class="help-i" data-help="${topic}" aria-label="Help with this section">ⓘ</button>`);
  }
}
// Each page change is a step in the browser's history, so Back (or the phone's back
// gesture) returns to the previous page at the same scroll position, and Forward works too.
const VIEWS = ["find", "shortlist", "shopping", "mywines", "dine", "help"];
const currentView = () => VIEWS.find((v) => !$(`view-${v}`).hidden) || "find";
let navDepth = 0; // steps taken inside the Wine Finder, so "Back" never leaves the site by surprise

function openHelp(topic) {
  showView("help");
  const el = topic && $(topic);
  if (el) el.scrollIntoView({ block: "start" }); else $("help-top").focus();
}

function goBack() { if (navDepth > 0) history.back(); else showView("find"); }

// Leaving the site (a link in a write-up, a store's page…) and coming back with Back reloads
// the page, which would start over. So the page notes where you were when you leave (this tab
// only) and picks it up again on the way back: page, filters, sort, scroll and an open write-up.
const SET_KEYS = ["sources", "countries", "types", "sweet", "body", "tannin", "sweetStyle", "grapes", "food"];
let openNotesId = null;
function savePlace() {
  try {
    const st = { ...state };
    for (const k of SET_KEYS) st[k] = [...state[k]];
    sessionStorage.setItem("wf.place", JSON.stringify({ view: currentView(), y: window.scrollY, state: st, notes: openNotesId }));
  } catch { /* private window etc.: nothing to restore later */ }
}
window.addEventListener("pagehide", savePlace);
$("notes-dialog")?.addEventListener("close", () => { readerStop(); if (document.visibilityState === "visible") openNotesId = null; });
document.addEventListener("visibilitychange", () => { if (document.hidden) savePlace(); });

async function restorePlace() {
  const nav = performance.getEntriesByType?.("navigation")?.[0]?.type;
  if (nav !== "back_forward" && nav !== "reload") return; // a fresh visit starts clean
  if (/^#(save|scores|share|dine)=/.test(location.hash)) return;  // a link from Claude has its own job
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem("wf.place") || "null"); } catch { saved = null; }
  if (!saved || !saved.state) return;
  const st = { ...defaultState(), ...saved.state };
  if (!Array.isArray(saved.state.sorts) && saved.state.sort) st.sorts = [saved.state.sort, "", ""];
  for (const k of SET_KEYS) st[k] = new Set(Array.isArray(saved.state[k]) ? saved.state[k] : []);
  if (!st.sources.size) st.sources = new Set(["BC Liquor"]);
  state = st;
  const stores = [...state.sources].filter((x) => ALL_SOURCES.includes(x) && !LOADED.has(x));
  if (stores.length) { await Promise.all(stores.map(loadSource)); renderFooter(); }
  renderAll();
  showView(VIEWS.includes(saved.view) ? saved.view : "find", true);
  window.scrollTo(0, saved.y || 0);
  if (saved.notes) openNotes(saved.notes);
}

window.addEventListener("popstate", (e) => {
  const st = e.state;
  if (!st || !st.wfView) return;
  navDepth = Math.max(0, navDepth - 1);
  showView(st.wfView, true);
  window.scrollTo(0, st.y || 0);
});

function showView(name, fromHistory = false) {
  const prev = currentView();
  if (!fromHistory && prev !== name) {
    history.replaceState({ ...(history.state || {}), wfView: prev, y: window.scrollY }, ""); // where we were
    history.pushState({ wfView: name, y: 0 }, "", location.pathname + location.search);
    navDepth++;
  }
  $("view-find").hidden = name !== "find";
  $("view-shortlist").hidden = name !== "shortlist";
  $("view-shopping").hidden = name !== "shopping";
  $("view-mywines").hidden = name !== "mywines";
  $("view-dine").hidden = name !== "dine";
  $("view-help").hidden = name !== "help";
  for (const el of document.querySelectorAll(".help-keeper")) el.hidden = !isKeeper(); // the keeper's topic: keeper's computer only
  for (const b of document.querySelectorAll(".view-btn")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
  if (name === "shortlist") renderShortlist();
  else if (name === "shopping") renderShopping();
  else if (name === "mywines") { renderMyWines(); renderFamilyBox(); loadInbox(); }
  else if (name === "dine") renderDine();
  else renderResults();
  window.scrollTo(0, 0);
}

function startOver() {
  state = defaultState();
  closeClaudeSteps();
  renderAll();
  showView("find");
  if (shortlist.length) askToEmptyShortlist();
}

// Yes/No box after Start over. "No" is the default, so Enter or Esc keeps the list.
function askToEmptyShortlist() {
  const n = shortlist.length;
  $("reset-q").textContent = `Your Short List for Claude has ${n} ${n === 1 ? "wine" : "wines"} (${shortlistCountries()}).`;
  const dlg = $("reset-dialog");
  if (typeof dlg.showModal !== "function") return; // very old browser: just keep the list
  dlg.showModal();
}

function emptyShortlist() {
  shortlist = [];
  closeClaudeSteps();
  saveShortlist();
  renderResults(); // card buttons back to "Add to Short List for Claude Research"
}

// ---- "Find me a wine" ----------------------------------------------------------
// Rows of tap-buttons that set the same filters as the side panel, plus the style ones
// (body, tannin, sweetness, ready now) that only exist here.
// Each row: [title, key, [[value, label, examples]], a line saying what the row means].
// Body, tannin and sweetness take more than one choice ("medium or full").
const MULTI_ROWS = new Set(["body", "tannin", "sweetStyle"]);
// Tannin and "Fruity & ripe" only mean something for reds: with only other colours chosen,
// those rows are hidden (and their choices undone), and Body's examples follow the colour.
const redRowsApply = (st = state) => !st.types.size || st.types.has("Red");
const BODY_EXAMPLES = {
  red: ["Pinot Noir, Beaujolais", "Merlot, Chianti", "Cabernet, Malbec, Shiraz"],
  white: ["Pinot Grigio, Sauvignon Blanc, Riesling", "Chenin Blanc, unoaked Chardonnay", "oaked Chardonnay, Viognier"],
  other: ["Provence rosé, Prosecco", "Champagne, Spanish rosado", "vintage Champagne, Tavel"],
};
const finderRows = () => {
  const ex = BODY_EXAMPLES[redRowsApply() ? "red" : state.types.has("White") ? "white" : "other"];
  return [
  ["Colour", "colour", FINDER_COLOURS.map((t) => [t, t])],
  ["Price", "price", FINDER_PRICES.map((p) => [p, `Under $${p}`])],
  ["Body", "body", [["light", "Light", ex[0]], ["medium", "Medium", ex[1]], ["full", "Full-bodied", ex[2]]],
    "How heavy the wine feels in your mouth, like skim milk compared with cream. Choose one or more."],
  ["Tannin (reds)", "tannin", [["soft", "Soft & smooth", "Merlot, Malbec, Pinot Noir"], ["medium", "Medium grip", "Chianti, Rioja, Côtes du Rhône"],
    ["firm", "Firm & grippy", "Cabernet, Barolo, Douro · best with food"]],
    "The dry, grippy feel on your gums and tongue, like strong tea. Choose one or more."],
  ["Taste (reds)", "fruity", [[1, "Fruity & ripe", "Malbec, Zinfandel, Australian Shiraz"]],
    "Tastes ripe and fruity, even though it's dry."],
  ["Sweetness", "sweetStyle", [["dry", "Dry", "most table wines · BC 0–1 · LCBO ≤4 g/L"],
    ["off-dry", "Off-dry", "Kabinett Riesling · BC 2–4 · LCBO 4–12 g/L"],
    ["medium-sweet", "Medium-sweet", "Spätlese, demi-sec · BC 5–7 · LCBO 12–45 g/L"],
    ["sweet", "Sweet", "Sauternes, icewine, Port · BC 8–10 · LCBO over 45 g/L"]],
    "Sugar actually left in the wine: BC Liquor's sugar code and the LCBO's grams per litre where they give them, otherwise estimated. Choose one or more."],
  ["From", "continent", Object.keys(CONTINENTS).map((c) => [c, c])],
  ].filter(([, key]) => redRowsApply() || (key !== "tannin" && key !== "fruity"));
};

function finderOn(key, v) {
  if (key === "price") return state.priceFrom == null && state.priceTo === v;
  if (key === "colour") return state.types.size === 1 && state.types.has(v);
  if (key === "fruity") return state.fruity;
  if (MULTI_ROWS.has(key)) return state[key].has(v);
  return state[key] === v;
}

function setFinder(key, v) {
  const on = finderOn(key, v);
  if (key === "price") { state.priceFrom = null; state.priceTo = on ? null : v; }
  else if (key === "colour") state.types = on ? new Set() : new Set([v]);
  else if (key === "wellRated" || key === "readyNow" || key === "ratedOnly" || key === "fruity" || key === "longFinish") state[key] = !state[key];
  else if (MULTI_ROWS.has(key)) { const set = new Set(state[key]); on ? set.delete(v) : set.add(v); state[key] = set; }
  else {
    state[key] = on ? "" : v;
    if (key === "continent") state.countries = new Set(); // a country from another continent would hide everything
  }
  state.pickLabel = "";
  state.shown = PAGE_SIZE;
  syncInputs();
  refresh();
}

// Each button shows how many wines there would be with it chosen, given the other choices;
// one that would give none is greyed (still tappable).
const tap = (key, v, label, on, n, ex = "") =>
  `<button type="button" class="tap${n === 0 ? " tap-zero" : ""}${ex ? " tap-ex" : ""}" data-finder="${esc(key)}" data-v="${esc(String(v))}" aria-pressed="${on}">` +
  `<span>${esc(label)}${n == null ? "" : ` <span class="tap-n">${n.toLocaleString()}</span>`}</span>` +
  (ex ? `<small>${esc(ex)}</small>` : "") + `</button>`;

const cloneState = (st) => ({ ...st, ...Object.fromEntries(SET_KEYS.map((k) => [k, new Set(st[k])])) });

// How to undo each row's choice (as tapping it again would), and what a wine counts as in that row.
const FINDER_CLEAR = {
  price: (st) => { st.priceFrom = null; st.priceTo = null; },
  colour: (st) => { st.types = new Set(); },
  body: (st) => { st.body = new Set(); },
  tannin: (st) => { st.tannin = new Set(); },
  sweetStyle: (st) => { st.sweetStyle = new Set(); },
  continent: (st) => { st.continent = ""; st.countries = new Set(); },
  wellRated: (st) => { st.wellRated = false; },
  readyNow: (st) => { st.readyNow = false; },
  fruity: (st) => { st.fruity = false; },
  longFinish: (st) => { st.longFinish = false; },
  ratedOnly: (st) => { st.ratedOnly = false; },
};
function finderValues(key, w) {
  if (key === "price") { const p = priceOf(w); return p == null ? [] : FINDER_PRICES.filter((x) => p <= x); }
  if (key === "colour") return [w.type];
  if (key === "body" || key === "tannin") return [wineStyle(w)[key].v];
  if (key === "sweetStyle") return [wineStyle(w).sweet.v];
  if (key === "continent") return [continentOf(w)];
  if (key === "wellRated") return wellRated(w) ? [1] : [];
  if (key === "readyNow") return wineStyle(w).ready.ready ? [1] : [];
  if (key === "fruity") return wineStyle(w).fruity.v ? [1] : [];
  if (key === "longFinish") return wineStyle(w).finish.v === "long" ? [1] : [];
  return familyScore(w) != null ? [1] : []; // ratedOnly
}
// One pass over the wines per row: the other rows' choices stay, this row's is undone.
function finderCounts() {
  const pool = findPool(), out = {};
  for (const [key, clear] of Object.entries(FINDER_CLEAR)) {
    const st = cloneState(state);
    clear(st);
    const c = new Map();
    for (const w of pool) {
      if (!matches(w, null, st)) continue;
      for (const v of finderValues(key, w)) c.set(String(v), (c.get(String(v)) || 0) + 1);
    }
    out[key] = c;
  }
  return out;
}

let lastFinderCounts = null; // the side panel's sweetness boxes reuse them
function renderFinder() {
  if (!$("finder-rows")) return;
  if (!redRowsApply() && (state.tannin.size || state.fruity)) { // a hidden row mustn't keep filtering
    state.tannin = new Set();
    state.fruity = false;
    renderResults();
  }
  const counts = WINES.length ? finderCounts() : null;
  lastFinderCounts = counts;
  const one = (key, v) => (counts ? counts[key].get(String(v)) || 0 : null);
  // In a row that takes several choices, a lit button shows its own wines, and an unlit
  // one the total you'd have by adding it.
  const n = (key, v) => {
    if (!counts || !MULTI_ROWS.has(key) || state[key].has(v)) return one(key, v);
    return [...state[key]].reduce((k, x) => k + one(key, x), one(key, v));
  };
  const rows = finderRows().map(([title, key, opts, hint]) =>
    `<div class="finder-row"><span class="finder-label">${esc(title)}</span>` +
    opts.map(([v, label, ex]) => tap(key, v, label, finderOn(key, v), n(key, v), ex)).join("") +
    (key === "continent" ? countrySelectHtml() : "") +
    (key === "price" ? priceSliderHtml() : "") +
    (hint ? `<span class="finder-hint">${esc(hint)}</span>` : "") + `</div>`);
  rows.push(`<div class="finder-row"><span class="finder-label">Also</span>` +
    tap("wellRated", 1, `Only well rated (${WELL_RATED}+)`, state.wellRated, n("wellRated", 1)) +
    tap("readyNow", 1, "Ready to drink now", state.readyNow, n("readyNow", 1)) +
    tap("longFinish", 1, "Long finish (Claude-scored)", state.longFinish, n("longFinish", 1)) + `</div>`);
  const stores = [...[...state.sources].filter((x) => !ALL_SOURCES.includes(x)), ...storesTicked().map(sourceLabel)].join(", ") || "nothing ticked yet";
  rows.push(`<p class="finder-stores">Looking in: <strong>${esc(stores)}</strong>
    <button type="button" class="btn btn-mini" data-action="finder-stores">Change stores</button></p>`);
  $("finder-rows").innerHTML = rows.join("");
  renderMyPicks();
}

// Price slider: lowest and highest, like the restaurant page; the top of the scale is "no
// limit". While a handle moves, only the count beside it changes; the rest of the page
// catches up when it's let go.
const SLIDE = { max: 300, step: 5 };
// The same slider appears in "Find me a wine" (ids ps-…) and in the side panel (ids sp-…).
function priceSliderHtml(id = "ps", cls = "price-slider") {
  if (cellarOn() && !storesTicked().length)
    return `<span class="finder-hint no-price-note">A cellar keeps no prices: tick a store under Sold by to filter by that store's price.</span>`;
  const lo = state.priceFrom ?? 0, hi = state.priceTo ?? SLIDE.max;
  return `<div class="${cls}">
    <label for="${id}-lo">Lowest: <strong id="${id}-lo-v">$${lo}</strong></label>
    <input type="range" id="${id}-lo" min="0" max="${SLIDE.max}" step="${SLIDE.step}" value="${Math.min(lo, SLIDE.max)}">
    <label for="${id}-hi">Highest: <strong id="${id}-hi-v">${hi >= SLIDE.max ? "no limit" : `$${hi}`}</strong></label>
    <input type="range" id="${id}-hi" min="0" max="${SLIDE.max}" step="${SLIDE.step}" value="${Math.min(hi, SLIDE.max)}">
    <p class="ps-count" id="${id}-count" aria-live="polite">${priceCountText()}</p>
  </div>`;
}
function renderSidePrice() {
  if ($("side-price")) $("side-price").innerHTML = priceSliderHtml("sp", "price-slider side-slider");
}
function priceCountText(st = state) {
  const n = findPool().reduce((k, w) => k + matches(w, null, st), 0);
  const lo = st.priceFrom ?? 0, hi = st.priceTo;
  const range = hi == null ? (lo ? `from $${lo} up` : "at any price") : `from $${lo} to $${hi}`;
  return `<strong>${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}</strong> ${range}`;
}
let slideFrame = 0;
function priceSlide(which, done, id = "ps") {
  let lo = +$(`${id}-lo`).value, hi = +$(`${id}-hi`).value;
  if (lo > hi) { if (which === "lo") hi = lo; else lo = hi; $(`${id}-lo`).value = lo; $(`${id}-hi`).value = hi; }
  state.priceFrom = lo > 0 ? lo : null;
  state.priceTo = hi < SLIDE.max ? hi : null;
  $(`${id}-lo-v`).textContent = `$${lo}`;
  $(`${id}-hi-v`).textContent = hi >= SLIDE.max ? "no limit" : `$${hi}`;
  state.pickLabel = "";
  state.shown = PAGE_SIZE;
  if (done) { syncInputs(); refresh(); return; }
  cancelAnimationFrame(slideFrame);
  slideFrame = requestAnimationFrame(() => { $(`${id}-count`).innerHTML = priceCountText(); });
}

// "Any country", or one country, from the continent chosen (or all), with how many wines each has.
// Every country these stores sell from that continent is listed, so none seems to vanish:
// those with wines for the other choices first, then the ones ruled out, as "(0)".
function countrySelectHtml() {
  const counts = countBy("country", "country");
  const all = new Set(findPool().filter((w) => storesTicked().length === 0 || state.sources.has(w.source)).map((w) => w.country));
  const n = (c) => counts.get(c) || 0;
  const list = [...all].filter((c) => c && c !== "Country not stated" && (!state.continent || CONTINENT_OF[c] === state.continent))
    .sort((a, b) => (n(b) > 0) - (n(a) > 0) || a.localeCompare(b));
  const one = state.countries.size === 1 && !state.countryOut ? [...state.countries][0] : "";
  if (one && !list.includes(one)) list.unshift(one);
  return `<label class="finder-country"><span class="visually-hidden">Country</span><select id="finder-country">
    <option value="">${state.countryOut && state.countries.size ? `All but ${state.countries.size} ${state.countries.size === 1 ? "country" : "countries"}` : state.countries.size > 1 ? `${state.countries.size} countries` : "Any country"}</option>` +
    list.map((c) => `<option value="${esc(c)}"${c === one ? " selected" : ""}>${esc(c)} (${(counts.get(c) || 0).toLocaleString()})</option>`).join("") +
    `</select></label>`;
}

// ---- Quick picks: "Scored by Claude or the family" and each person's own -----------------
// Saved picks live on this computer only (localStorage), so Dad's are his and Jon's are his.
const PICK_KEYS = ["countries", "countryOut", "grapes", "grapeOut", "food", "foodBold", "longFinish", "vintFrom", "vintTo", "oldOnly", "abvFrom", "abvTo", "types", "sweet", "priceFrom", "priceTo", "notRated", "bottleOnly", "q",
  "body", "tannin", "sweetStyle", "continent", "wellRated", "ratedOnly", "readyNow", "fruity", "sorts", "sources"];
const myPicks = () => { const p = storeGet(STORE.myPicks, []); return Array.isArray(p) ? p : []; };

function snapshotState() {
  const out = {};
  for (const k of PICK_KEYS) out[k] = state[k] instanceof Set ? [...state[k]] : state[k];
  return out;
}

function pickToState(p) {
  const st = defaultState();
  for (const k of PICK_KEYS) {
    if (p.st?.[k] === undefined) continue;
    const v = p.st[k]; // body, tannin and sweetness were single words in the first saved picks
    st[k] = SET_KEYS.includes(k) ? new Set(Array.isArray(v) ? v : v ? [v] : []) : v;
  }
  for (const old of Array.isArray(p.st?.sweet) ? p.st.sweet : []) if (OLD_SWEET[old]) st.sweetStyle.add(OLD_SWEET[old]);
  // stores this browser can open (LCBO only once unlocked), and cellars it still has
  const ok = new Set([...knownSources(), ...cellarSources()]);
  st.sources = new Set([...st.sources].filter((x) => ok.has(x)));
  if (!st.sources.size) st.sources = new Set(["BC Liquor"]);
  st.pickLabel = p.label;
  return st;
}

function pickButtonHtml(attr, label, n, extra = "") {
  const count = n == null ? "…" : `${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}`;
  return `<span class="my-pick"><button type="button" class="btn pick-btn" ${attr}>${esc(label)} <span class="pick-count">· ${count}</span></button>${extra}</span>`;
}

function pickCount(st) {
  if (![...st.sources].every((s) => LOADED.has(s) || !ALL_SOURCES.includes(s))) return null;
  const pool = cellarOn(st) ? cellarFindWines() : WINES;
  return pool.reduce((k, w) => k + matches(w, null, st), 0);
}

// "Smooth & bold": the most-asked-for taste, full body without bitter tannins, in one tap.
const smoothBoldOn = () => state.body.size === 1 && state.body.has("full") && state.tannin.size === 1 && state.tannin.has("soft");
function toggleSmoothBold() {
  const on = smoothBoldOn();
  state.body = on ? new Set() : new Set(["full"]);
  state.tannin = on ? new Set() : new Set(["soft"]);
  if (!on && state.types.size && !state.types.has("Red")) state.types = new Set(["Red"]); // soft tannins means a red
  state.pickLabel = "";
  state.shown = PAGE_SIZE;
  refresh();
}

function renderMyPicks() {
  const box = $("my-picks");
  if (!box) return;
  const picks = myPicks();
  // "Scored by Claude or the family" filters on top of the other choices, like every other
  // button here: tap to switch it on, tap again to switch it off.
  const fav = pickCount({ ...cloneState(state), ratedOnly: true });
  const sb = smoothBoldOn();
  box.innerHTML = `<span class="my-pick"><button type="button" class="btn pick-btn" data-action="smooth-bold" aria-pressed="${sb}">` +
    `${sb ? "✓" : "🍷"} Smooth & bold <span class="pick-count">· full-bodied, soft tannins · ${pickCount({ ...cloneState(state), body: new Set(["full"]), tannin: new Set(["soft"]) })?.toLocaleString() ?? "…"}</span></button></span>` +
    `<span class="my-pick"><button type="button" class="btn pick-btn" data-finder="ratedOnly" data-v="1" aria-pressed="${state.ratedOnly}">` +
    `${state.ratedOnly ? "✓" : "⭐"} Scored by Claude or the family <span class="pick-count">· ${fav == null ? "…" : fav.toLocaleString()}</span></button></span>` +
    picks.map((p, i) => pickButtonHtml(`data-mypick="${i}"`, p.label, pickCount(pickToState(p)),
      `<button type="button" class="btn btn-mini pick-x" data-unpick="${i}" aria-label="Remove the quick pick ${esc(p.label)}">✕</button>`)).join("");
  $("finder-save").hidden = picks.length >= MAX_MY_PICKS;
}
const updatePickCounts = () => renderMyPicks();

async function applyPickState(st) {
  state = st;
  const need = [...st.sources].filter((s) => ALL_SOURCES.includes(s) && !LOADED.has(s));
  if (need.length) {
    $("result-count").textContent = "Loading the store lists…";
    await Promise.all(need.map(loadSource));
    renderFooter();
  }
  renderAll();
  $("results-h").scrollIntoView({ block: "start" });
}

function openSavePick(open) {
  $("finder-save-form").hidden = !open;
  $("finder-save").hidden = open || myPicks().length >= MAX_MY_PICKS;
  if (open) { $("finder-save-name").value = ""; $("finder-save-name").focus(); }
}

function saveMyPick() {
  const label = $("finder-save-name").value.trim().slice(0, 40);
  if (!label) { $("finder-save-name").focus(); return; }
  const picks = myPicks().filter((p) => p.label !== label); // the same name again replaces it
  picks.push({ label, st: snapshotState() });
  storeSet(STORE.myPicks, picks.slice(-MAX_MY_PICKS));
  state.pickLabel = label;
  openSavePick(false);
  renderMyPicks();
  renderResults();
}

function removeMyPick(i) {
  const p = myPicks()[i];
  if (!p || !confirm(`Remove your quick pick “${p.label}”?`)) return;
  storeSet(STORE.myPicks, myPicks().filter((_, k) => k !== i));
  renderMyPicks();
}

// "Find me a wine" folds away to save room, and the page always opens with it folded. Folded, the finder still shows the quick picks and a one-line summary.
const FOLDS = { finder: "finder-body" };
function setFold(name, open) {
  const btn = document.querySelector(`[data-fold="${name}"]`), body = $(FOLDS[name]);
  if (!btn || !body) return;
  body.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
  btn.textContent = open ? "▴ Hide choices" : "▾ Show choices";
  btn.closest(".fold").classList.toggle("folded", !open);
  renderFinderSummary();
}

function renderFinderSummary() {
  const box = $("finder-summary");
  if (!box) return;
  box.hidden = !$("finder-body").hidden;
  if (box.hidden) return;
  const made = choicesMade().map(([label]) => esc(label));
  const n = lastResults.length;
  const count = `${n.toLocaleString()} ${n === 1 ? "wine" : "wines"} ${esc(storesPhrase())}`;
  box.innerHTML = made.length
    ? `<strong>Your choices: ${made.join(" · ")}</strong> <span class="fold-count">— ${count}</span>`
    : `<strong>No choices made yet:</strong> tap <strong>▾ Show choices</strong> to pick colour, price, style and more. <span class="fold-count">(${count})</span>`;
}

// "at BC Liquor - LDB", "at BC Liquor - LDB and ZYN", "at 4 stores", "in Cellar 1"
function storesPhrase(st = state) {
  if (!st.sources.size) return "(no store ticked)";
  if (cellarOn(st)) return `in ${[...st.sources].filter((x) => !ALL_SOURCES.includes(x)).join(" and ")}`;
  const list = storesTicked(st).map(sourceLabel);
  return list.length <= 2 ? `at ${list.join(" and ")}` : `at ${list.length} stores`;
}

function openStoreChoices() {
  if (!$("filter-body").classList.contains("open") && getComputedStyle($("filter-toggle")).display !== "none") $("filter-toggle").click();
  $("fs-source").scrollIntoView({ block: "start" });
}

// ---- Events ------------------------------------------------------------------

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function wireEvents() {
  renderFinder();
  if ($("grape-guide")) $("grape-guide").innerHTML = Object.entries(GRAPE_INFO).map(([g, d]) => `<dt>${esc(g)}</dt><dd>${esc(d)}</dd>`).join("");
  for (const name of Object.keys(FOLDS)) setFold(name, false);
  wireMyWines();

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.dataset.fold) setFold(t.dataset.fold, $(FOLDS[t.dataset.fold]).hidden);
    else if (t.dataset.finder) setFinder(t.dataset.finder, t.dataset.finder === "price" ? +t.dataset.v : t.dataset.v);
    else if (t.dataset.mypick) applyPickState(pickToState(myPicks()[+t.dataset.mypick] || {}));
    else if (t.dataset.unpick) removeMyPick(+t.dataset.unpick);
    else if (t.dataset.action === "finder-save") openSavePick(true);
    else if (t.dataset.action === "finder-save-ok") saveMyPick();
    else if (t.dataset.action === "finder-save-cancel") openSavePick(false);
    else if (t.dataset.action === "finder-clear") startOver();
    else if (t.dataset.action === "finder-show") $("results-h").scrollIntoView({ block: "start" });
    else if (t.dataset.action === "finder-stores") openStoreChoices();
    else if (t.dataset.action === "empty-fix") applyEmptyFix();
    else if (t.dataset.action === "smooth-bold") toggleSmoothBold();
    else if (t.dataset.action === "untick-grapes") {
      state.grapes = new Set();
      state.grapeOut = false;
      state.shown = PAGE_SIZE;
      refresh();
    }
    else if (t.dataset.action === "tick-tier" || t.dataset.action === "tick-adv") {
      if (state.grapeOut) { state.grapeOut = false; state.grapes = new Set(); }
      const want = +t.dataset.tier;
      const pick = t.dataset.action === "tick-adv" ? [...foodAdv] : [...foodTier].filter(([, n]) => n === want).map(([g]) => g);
      for (const g of pick) state.grapes.add(g);
      state.shown = PAGE_SIZE;
      refresh();
    }
    else if (t.dataset.action === "show-hidden-types") {
      for (const x of hiddenTypes) state.types.add(x);
      state.shown = PAGE_SIZE;
      refresh();
    }
    else if (t.dataset.chip) removeChip(+t.dataset.chip);
    else if (t.dataset.view) { showView(t.dataset.view); if (t.dataset.focus) $(t.dataset.focus)?.focus(); }
    else if (t.dataset.add) {
      const id = t.dataset.add;
      toggleShortlist(id);
      const on = shortlist.some((s) => s.id === id);
      for (const b of document.querySelectorAll(".btn-add")) { // the same wine can show in two places
        if (b.dataset.add !== id) continue;
        b.setAttribute("aria-pressed", String(on));
        b.textContent = on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research";
        b.closest(".wine")?.classList.toggle("on-list", on);
      }
      if (!$("view-shortlist").hidden) renderShortlist(); // added from the Short List page's own box
    } else if (t.dataset.remove) { toggleShortlist(t.dataset.remove); renderShortlist(); }
    else if (t.dataset.shop) toggleShopping(t.dataset.shop);
    else if (t.dataset.shopRemove) toggleShopping(t.dataset.shopRemove);
    else if (t.dataset.action === "shop-clear") {
      if (shopping.length && confirm(`Remove all ${shopping.length} wines from your Shopping List?`)) { shopping = []; saveShopping(); renderShopping(); refresh(); }
    }
    else if (t.dataset.ew) toggleElsewhere(t);
    else if (t.dataset.action === "start-over") startOver();
    else if (t.dataset.action === "goto-ew") { // "Where can I buy…?" is on the Research a wine page
      showView("shortlist");
      $("ew-h").scrollIntoView({ block: "start" });
      document.querySelector("#ew-top .ew-q").focus({ preventScroll: true });
    }
    else if (t.dataset.action === "hide-notice") closeClaudeSteps();
    else if (t.dataset.action === "hits-in-list") showHitsInList();
    else if (t.dataset.action === "lcbo-unlock") unlockLcbo($("lcbo-code").value);
    else if (t.dataset.action === "score-claude") openScoreDialog();
    else if (t.dataset.action === "score-marked") openScoreDialog(true);
    else if (t.dataset.qmark) toggleQuickMark(t.dataset.qmark);
    else if (t.dataset.action === "score-go") goScoreClaude();
    else if (t.dataset.action === "score-close") $("score-dialog").close();
    else if (t.dataset.typed != null) {
      if (!addTypedWine(t.dataset.typed)) toggleShortlist(typedId(t.dataset.typed)); // pressed again: take it off
      const box = t.closest(".elsewhere");
      if (box) renderListHits(box); else renderSlAddHits(); // the Short List page has its own name box
      if (!$("view-shortlist").hidden) renderShortlist();
    }
    else if (t.id === "sl-add-btn") addFromShortlistBox();
    else if (t.dataset.rate) toggleRatePanel(t);
    else if (t.dataset.rateSave) saveMyRating(t.dataset.rateSave, t);
    else if (t.dataset.rateClear) clearMyRating(t.dataset.rateClear);
    else if (t.id === "save-yes") confirmSavedRatings();
    else if (t.id === "save-check") checkWriteup(true);
    else if (t.id === "save-email-fallback") { $("save-dialog").close(); showView("mywines"); scrollToFamilyBox(); emailRatings(); }
    else if (t.dataset.notes) openNotes(t.dataset.notes);
    else if (t.dataset.dineGroup) dineChoose(t.dataset.dineGroup, t.dataset.value);
    else if (t.id === "dine-go") dineGo();
    else if (t.id === "btn-tonight") showDinePicks(dineHistory()[0]);
    else if (t.dataset.help) { e.preventDefault(); openHelp(t.dataset.help); }
    else if (t.id === "help-back") goBack();
    else if (t.dataset.dineHist != null) showDinePicks(dineHistory()[+t.dataset.dineHist]);
    else if (t.id === "dine-close") $("dine-dialog").close();
    else if (t.id === "notes-close" || t.id === "notes-close-top") { $("notes-dialog").close(); openNotesId = null; }
    else if (t.id === "reader-smaller" || t.id === "reader-bigger") readerScale(t.id === "reader-bigger" ? 1 : -1);
    else if (t.dataset.quick) openQuick(t.dataset.quick, t.dataset.quickSrc);
    else if (t.id === "reader-speak") readerSpeak();
    else if (t.id === "reader-pause") readerPause();
    else if (t.id === "reader-stop") readerStop();
    else if (t.dataset.inboxRead) inboxAct(t.dataset.inboxRead, "read");
    else if (t.dataset.inboxPublish) inboxAct(t.dataset.inboxPublish, "publish");
    else if (t.dataset.inboxIgnore) inboxAct(t.dataset.inboxIgnore, "ignore");
    else if (t.id === "inbox-refresh") loadInbox();
    else if (t.id === "inbox-all") inboxPublishAll();
    else if (t.id === "inbox-key-save") saveInboxKey();
    else if (t.id === "stale-reload") location.reload();
    else if (t.dataset.action === "mw-hide") { mwView.open = false; renderMyWines(); }
    else if (t.id === "fr-email") emailRatings();
    else if (t.id === "sl-email") sendEmail("Wine short list", shortlistText(), setStatus);
    else if (t.dataset.mail) chooseMail(t.dataset.mail);
    else if (t.id === "mail-cancel") { pendingMail = null; $("mail-dialog").close(); }
    else if (t.id === "save-no") { pendingSave = null; $("save-dialog").close(); }
    else if (t.id === "fr-publish") publishFamilyRatings();
    else if (t.id === "fr-download") downloadFamilyFile();
    else if (t.id === "fr-key-save") saveGhKey();
    else if (t.id === "fr-key-forget") forgetGhKey();
    else if (t.dataset.action === "mw-confirm") confirmImport();
    else if (t.dataset.action === "mw-cancel-import") { mwPending = null; $("mw-preview").hidden = true; $("mw-file").value = ""; }
    else if (t.dataset.action === "mw-owner") { mwView.owner = t.dataset.owner; mwView.shown = MW_PAGE; mwView.open = true; renderMyWines(); }
    else if (t.dataset.action === "mw-remove") removeCellar(t.dataset.owner);
    else if (t.dataset.action === "mw-share") shareCellar(t.dataset.owner);
    else if (t.dataset.action === "mw-unshare") unshareCellar(t.dataset.slot);
    else if (t.dataset.action === "mw-name-cellar") nameCellar(t.dataset.slot);
    else if (t.dataset.action === "mw-owner-go") {
      const name = $("mw-owner2").value.trim();
      if (name && mwFile) { $("mw-owner").value = name; importCellarFile(mwFile); } else $("mw-owner2").focus();
    }
    else if (t.dataset.action === "mw-edit") editManual(t.dataset.id);
    else if (t.dataset.action === "mw-delete") deleteManual(t.dataset.id);
    else if (t.dataset.action === "mw-where") mwWhereCanIBuy(t.dataset.id);
    else if (t.id === "go-claude") goClaude();
  });

  $("start-over").addEventListener("click", startOver);
  $("reset-yes").addEventListener("click", () => { emptyShortlist(); $("reset-dialog").close(); });
  $("reset-no").addEventListener("click", () => $("reset-dialog").close());
  $("ask-claude").addEventListener("click", () => askClaude("about"));
  $("ask-claude-rank").addEventListener("click", () => askClaude("rank"));
  $("sl-copy").addEventListener("click", async () => {
    setStatus((await copyText(shortlistText())) ? "Copied. You can paste the list into an email or document."
      : "Sorry, copying didn't work in this browser.");
  });
  $("sl-print").addEventListener("click", () => { renderPrintArea(); window.print(); });
  $("sl-clear").addEventListener("click", () => {
    if (!window.confirm(`Remove all ${shortlist.length} wines from the Short List for Claude?`)) return;
    shortlist = [];
    closeClaudeSteps();
    renderShortlist();
  });
  window.addEventListener("beforeprint", renderPrintArea);

  $("country-all").addEventListener("click", () => {
    const all = findPool().filter((w) => state.sources.has(w.source)).map((w) => w.country);
    for (const n of visibleCountries(all)) state.countries.add(n);
    state.shown = PAGE_SIZE;
    refresh();
  });
  $("country-none").addEventListener("click", () => { state.countries.clear(); state.shown = PAGE_SIZE; refresh(); });
  $("grape-all").addEventListener("click", () => {
    for (const g of tickCounts("grape", grapesOf).keys()) if (!state.grapeQ || fold(g).includes(fold(state.grapeQ))) state.grapes.add(g);
    state.shown = PAGE_SIZE;
    refresh();
  });
  $("grape-none").addEventListener("click", () => { state.grapes.clear(); state.shown = PAGE_SIZE; refresh(); });
  $("grape-out").addEventListener("click", () => { // switching what a tick means starts the list afresh
    state.grapeOut = !state.grapeOut;
    state.grapes.clear();
    state.shown = PAGE_SIZE;
    refresh();
  });
  $("country-out").addEventListener("click", () => { // switching what a tick means starts the list afresh
    state.countryOut = !state.countryOut;
    state.countries.clear();
    state.shown = PAGE_SIZE;
    refresh();
  });

  $("show-more").addEventListener("click", () => { state.shown += PAGE_SIZE; renderResults(); });
  $("filter-toggle").addEventListener("click", () => {
    const open = $("filter-body").classList.toggle("open");
    $("filter-toggle").setAttribute("aria-expanded", String(open));
    renderResults();
  });
  $("filter-done").addEventListener("click", () => {
    $("filter-body").classList.remove("open");
    $("filter-toggle").setAttribute("aria-expanded", "false");
    renderResults();
    $("results-h").scrollIntoView({ block: "start" });
  });

  // Checkbox groups (rendered dynamically).
  document.querySelector(".filters").addEventListener("change", (e) => {
    const t = e.target;
    const group = t.dataset.group;
    if (group === "cellar") { // cellars replace the store list; unticking the last goes back to the stores
      if (t.checked && cellarOn()) state.sources.add(t.value); // another cellar alongside
      else if (t.checked) {
        state.sources = new Set([t.value]);
        state.bottleOnly = false;
        if (state.sorts[0].startsWith("price")) state.sorts = ["ct-desc", "vintage-desc", ""];
      } else if ((state.sources.delete(t.value), cellarOn())) { /* other cellars still ticked */ }
      else {
        state.sources = new Set(["BC Liquor"]);
        state.bottleOnly = true;
        if (state.sorts[0] === "ct-desc") state.sorts = ["price-asc", "", ""];
      }
      state.shown = PAGE_SIZE;
      renderAll();
      return;
    }
    if (group) {
      const set = { source: state.sources, country: state.countries, type: state.types, sweetStyle: state.sweetStyle, grape: state.grapes, food: state.food }[group];
      if (group === "source" && cellarOn()) { // narrowing the cellar to wines this store sells
        if (t.checked) set.add(t.value); else set.delete(t.value);
        state.shown = PAGE_SIZE;
        $("result-count").textContent = `Loading ${sourceLabel(t.value)}…`;
        loadSource(t.value).then(() => { renderFooter(); renderAll(); });
        return;
      }
      if (t.checked) set.add(t.value); else set.delete(t.value);
      if (group === "source" && t.checked && !LOADED.has(t.value)) { // load that store's list first
        $("result-count").textContent = `Loading ${sourceLabel(t.value)}…`;
        loadSource(t.value).then(() => { renderFooter(); refresh(); });
        return;
      }
    } else if (t.id === "lcbo-lock") { // LCBO isn't unlocked on this browser yet: ask for the code
      lcboPanel.open = t.checked;
      renderSources();
      if (t.checked) $("lcbo-code").focus();
      return;
    } else if (t.id === "not-rated") state.notRated = t.checked;
    else if (t.id === "food-bold") state.foodBold = t.checked;
    else if (t.id === "old-only") state.oldOnly = t.checked;
    else if (t.id === "bottle-only") state.bottleOnly = t.checked;
    else return;
    state.shown = PAGE_SIZE;
    refresh();
  });

  $("ew-top").innerHTML = elsewhereHtml("", "Wine name", true);
  $("sl-add-q").addEventListener("input", renderSlAddHits);
  $("sl-add-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addFromShortlistBox(); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "lcbo-code") { e.preventDefault(); unlockLcbo(e.target.value); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("ew-q")) updateElsewhere(e.target.closest(".elsewhere"));
  });

  $("q").addEventListener("input", debounce(() => { state.q = $("q").value.trim(); state.shown = PAGE_SIZE; refresh(); }, 200));
  $("country-q").addEventListener("input", () => { state.countryQ = $("country-q").value; renderCountries(); });
  const slider = (el) => /^(ps|sp)-(lo|hi)$/.exec(el.id); // [id, which slider, lo/hi]
  const range = (el) => /^(vs|as)-(lo|hi)$/.exec(el.id);  // vintage and alcohol
  document.addEventListener("input", (e) => {
    const m = slider(e.target), r = range(e.target);
    if (m) priceSlide(m[2], false, m[1]);
    else if (r) rangeSlide(r[1], r[2], false);
    else if (e.target.id === "grape-q") { state.grapeQ = e.target.value; renderGrapes(); }
  });
  document.addEventListener("change", (e) => {
    const m = slider(e.target), r = range(e.target);
    if (m) { priceSlide(m[2], true, m[1]); return; }
    if (r) { rangeSlide(r[1], r[2], true); return; }
    if (e.target.id !== "finder-country") return;
    state.countries = e.target.value ? new Set([e.target.value]) : new Set();
    state.countryOut = false;
    state.pickLabel = "";
    state.shown = PAGE_SIZE;
    refresh();
  });
  $("finder-save-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveMyPick(); }
    else if (e.key === "Escape") openSavePick(false);
  });
  ["sort", "sort2", "sort3"].forEach((id, i) => $(id).addEventListener("change", () => {
    state.sorts[i] = $(id).value;
    state.shown = PAGE_SIZE;
    renderSorts(); // the boxes below leave out what's now used above
    renderResults();
  }));
}

function renderFooter() {
  const parts = Object.entries(META.sources || {}).map(([name, m]) => {
    const label = name === "BC Liquor" ? "BC list" : name;
    if (m.status !== "ok") return `${label}: could not be updated last time (showing earlier data)`;
    return `${label}: ${m.edition ? m.edition + " edition · " : ""}updated ${m.refreshed}`;
  });
  const lcbo = lcboInfo();
  if (lcbo) parts.push(`LCBO: private ${lcbo.asOf} list, on this browser only`);
  const fx = META.sources?.Lucullus?.fx || META.sources?.Weinshop365?.fx;
  if (fx) parts.push(`Swiss prices in Canadian dollars are approximate (Bank of Canada rate ${fx.CAD_per_CHF} CAD per franc, ${fx.date})`);
  $("foot-editions").textContent = parts.join(" — ") || "Data date unknown.";
  $("foot-calgary").hidden = !knownSources().some((s) => CALGARY.has(s));
}

// ---- Loading the store lists -------------------------------------------------------
// BC's list (data/wines.json) loads at start. Other stores have their own files
// (meta.json → data_file) and load only when needed: when ticked under "Sold by"
// or when "Where can I buy…?" is used. This keeps the first page load fast.
// Data files change weekly: ask the server before reusing a saved copy (an unchanged
// file costs only a short "not modified" reply).
const FRESH = { cache: "no-cache" };
const LOADED = new Set();
const loading = {};
let loadingAll = null;

function addWines(list) {
  for (const w of list) {
    if (w.price == null) continue;
    w.country ||= "Country not stated"; // some Calgary wines don't say
    w._s = fold([w.name, w.producer, w.region_or_grape].filter(Boolean).join(" "));
    w._w = words(w.name);
    WINES.push(w);
  }
}

const sourceFile = (name) => META.sources?.[name]?.data_file;
const knownSources = () => ALL_SOURCES.filter((s) => s === "BC Liquor" || sourceFile(s) || (s === "LCBO" && lcboInfo()));
const allLoaded = () => knownSources().every((s) => LOADED.has(s));
const loadedSourceLabels = () => knownSources().filter((s) => LOADED.has(s)).map(sourceLabel).join(", ");

function loadSource(name) {
  if (LOADED.has(name)) return Promise.resolve();
  if (name === "LCBO") return (loading[name] ||= loadLcbo());
  const file = sourceFile(name);
  if (!file) return Promise.resolve();
  loading[name] ||= fetch("data/" + file, FRESH)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((list) => { addWines(list); LOADED.add(name); })
    .catch(() => { delete loading[name]; });
  return loading[name];
}

function loadAllSources() {
  loadingAll ||= Promise.all(knownSources().map(loadSource)).then(() => { loadingAll = null; renderFooter(); });
  return loadingAll;
}

// ---- The private LCBO list ----------------------------------------------------------
// A family-only snapshot of the LCBO's wine list. LCBO's terms don't allow publishing
// it, so it isn't part of the site: the keeper's Google script (INBOX_URL) hands it to
// a browser that sends the unlock code, once. The browser keeps it in its own storage
// (IndexedDB, too big for localStorage) and never asks again. The unlock code lives
// only in the Google script's settings, never here.
const lcboInfo = () => storeGet(STORE.lcbo, null); // {asOf, count, on}
let lcboPanel = { open: false, msg: "", done: false };

function idb(mode, op) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("wine-finder", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("lists");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction("lists", mode), req = op(tx.objectStore("lists"));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

// Plain CSV with quoted fields (tasting notes hold commas, quotes and line breaks).
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const numOrNull = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

// The trimmed LCBO file (ON-LB-26-trimmed-notes.csv) -> the site's wine records.
function lcboWines(csv) {
  return fillLcboCountries(parseCsv(csv.replace(/^﻿/, "")).filter((r) => r.sku && numOrNull(r.price) != null).map((r) => {
    const region = r.subregion || (r.region !== "Other" ? r.region : "");
    return {
      id: "lcbo-" + r.sku, source: "LCBO", sku: r.sku, name: r.name, name_raw: r.name,
      // LCBO's "brand" is patchy: sometimes ALL CAPS, sometimes a release name rather than a producer.
      producer: r.producer && r.producer !== r.producer.toUpperCase() && !/release|vintages/i.test(r.producer) ? r.producer : null,
      region_or_grape: [region, r.grape].filter(Boolean).join(" ") || null,
      region: region || null, grape: r.grape || null,
      vintage: numOrNull(r.vintage), country: r.country || null, type: r.type || "Other",
      size_ml: numOrNull(r.volume_ml), pack: 1, abv: numOrNull(r.alcohol_percent), price: numOrNull(r.price),
      sweetness: null, sugar: numOrNull(r.sugar_g_per_l), upc: gtin(r.upc), url: r.url || null,
      note: r.tasting_note || null, available: true, retailer_scores: null, new_since_last: false,
    };
  }));
}

// About 2,000 LCBO wines have no country but do have a region. Where the other LCBO wines
// from that region all (nine in ten or more) say the same country, use it.
function fillLcboCountries(wines) {
  const seen = {};
  for (const w of wines) if (w.country && w.region) {
    const c = (seen[fold(w.region)] ??= {});
    c[w.country] = (c[w.country] || 0) + 1;
  }
  const countryOf = {};
  for (const [region, c] of Object.entries(seen)) {
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const [country, n] = Object.entries(c).sort((x, y) => y[1] - x[1])[0];
    if (n / total >= 0.9) countryOf[region] = country;
  }
  for (const w of wines) if (!w.country && w.region) w.country = countryOf[fold(w.region)] || null;
  return wines;
}

function addLcbo(wines) {
  if (LOADED.has("LCBO")) return;
  addWines(wines);
  LOADED.add("LCBO");
}

function loadLcbo() {
  return idb("readonly", (s) => s.get("LCBO")).then((wines) => {
    if (Array.isArray(wines) && wines.length) return addLcbo(fillLcboCountries(wines)); // lists saved before the fill
    storeSet(STORE.lcbo, null); // the browser's storage was cleared: ask for the code again
    renderSources();
  }).catch(() => { delete loading.LCBO; });
}

// Weinshop365 shows francs with Swiss VAT, sells single bottles and delivers across Switzerland.
// "2026-10-26" -> "October 2026"
const monthYear = (iso) => { const d = new Date(iso || ""); return isNaN(d) ? "a past date" : d.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }); };

function weinshop365DetailHtml(w) {
  const facts = [w.region, w.grape, w.producer].filter(Boolean).map(esc).join(" · ");
  const fx = META.sources?.Weinshop365?.fx;
  return (facts ? `<p class="wine-detail">${facts}</p>` : "") +
    (w.price_was ? `<p class="wine-detail">On sale: was CHF ${Number(w.price_was).toFixed(2)}</p>` : "") +
    `<p class="wine-detail">Price from the Weinshop365 list of ${esc(monthYear(META.sources?.Weinshop365?.edition))}: check the Weinshop365 page for today's price.</p>` +
    `<p class="wine-detail">Weinshop365, Ramsei: delivers across Switzerland, free from CHF 200` +
    (w.order_item ? "; ordered in for you, in cases of 6" : "") + `. Price includes Swiss VAT` +
    (fx ? `; ≈ Canadian dollars at the Bank of Canada rate of ${esc(fx.date)}` : "") + `.</p>`;
}

// Lucullus sells by the case and quotes francs without Swiss VAT; say so on every card.
function lucullusDetailHtml(w) {
  const facts = [w.region_or_grape, w.producer, w.stock != null ? `${w.stock} in stock` : null].filter(Boolean).map(esc).join(" · ");
  const fx = META.sources?.Lucullus?.fx;
  return (facts ? `<p class="wine-detail">${facts}</p>` : "") +
    `<p class="wine-detail">Lucullus, Stans: delivers in Switzerland, in cases of 6. Price excludes Swiss VAT` +
    (fx ? `; ≈ Canadian dollars at the Bank of Canada rate of ${esc(fx.date)}` : "") + `.</p>`;
}

function lcboDetailHtml(w) {
  const facts = [w.region, w.grape, w.sugar != null ? `sugar ${w.sugar} g/L` : null].filter(Boolean).map(esc).join(" · ");
  return (facts ? `<p class="wine-detail">${facts}</p>` : "") +
    `<p class="wine-detail">Ontario price from the ${esc(lcboInfo()?.asOf || "LCBO")} list: check the LCBO page for today's price.</p>` +
    (w.note ? `<details class="lcbo-note"><summary>LCBO tasting note<span class="pair-more" aria-hidden="true"></span></summary><p>${esc(w.note)}</p></details>` : "");
}

function lcboMsg(msg, busy = false) {
  lcboPanel.msg = msg;
  if ($("lcbo-msg")) $("lcbo-msg").textContent = msg;
  const b = document.querySelector('[data-action="lcbo-unlock"]');
  if (b) { b.disabled = busy; b.textContent = busy ? "Unlocking…" : "Unlock"; }
}

async function unlockLcbo(code, who) {
  code = String(code || "").trim();
  if (!code) return lcboMsg("Please type the unlock code.");
  lcboMsg("Checking the code and fetching the LCBO list (about 2 MB)…", true);
  try {
    let d;
    try {
      const r = await fetch(INBOX_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "lcbo", code, who: who || storeGet(STORE.myName, "") || "Someone" }) });
      d = await r.json();
    } catch {
      throw new Error("Couldn't reach the server. Please check the internet connection and try again.");
    }
    if (!d.ok) throw new Error(d.error === "wrong code" ? "That code isn't right. Please check it and try again."
      : "The LCBO list isn't available right now. Please try again later.");
    const wines = lcboWines(d.csv || "");
    if (!wines.length) throw new Error("The LCBO list came back empty. Please try again later.");
    await idb("readwrite", (s) => s.put(wines, "LCBO"));
    storeSet(STORE.lcbo, { asOf: d.asOf, count: wines.length, on: new Date().toISOString().slice(0, 10) });
    addLcbo(wines);
    lcboPanel = { open: false, msg: "", done: true };
    state.sources.add("LCBO");
    renderSources();
    renderFooter();
    state.shown = PAGE_SIZE;
    refresh();
  } catch (e) {
    lcboMsg(e.message || "Something went wrong. Please try again.");
  }
}

// An emailed link "…/#lcbo=CODE~Name" unlocks with one click.
function unlockFromLink() {
  const m = location.hash.match(/^#lcbo=([^~]*)(?:~(.*))?$/);
  if (!m) return;
  history.replaceState(history.state, "", location.pathname + location.search); // don't leave the code on screen
  const code = decodeURIComponent(m[1]), who = decodeURIComponent(m[2] || "");
  if (lcboInfo()) {
    state.sources.add("LCBO");
    loadSource("LCBO").then(() => { renderSources(); refresh(); });
  } else {
    lcboPanel.open = true;
    renderSources();
    $("lcbo-code").value = code;
    unlockLcbo(code, who);
  }
  $("source-list").scrollIntoView({ block: "center" });
}

async function init() {
  if (/^#(save|scores|share)=/.test(location.hash) && await handOffSave(location.hash)) { showHandedOff(); return; }
  loadMyWines();
  loadRatings();
  wireEvents();
  saveShortlist();
  try {
    const [wines, meta, fr, cel, notesIdx] = await Promise.all([
      fetch("data/wines.json", FRESH).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("data/meta.json", FRESH).then((r) => (r.ok ? r.json() : { sources: {} })).catch(() => ({ sources: {} })),
      fetch("data/ratings.json", FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch(CELLARS_PATH, FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      fetch(`${NOTES_DIR}/index.json`, FRESH).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    noteIndex = notesIdx && typeof notesIdx.notes === "object" && notesIdx.notes ? notesIdx.notes : {};
    sharedCellars = cel && typeof cel.cellars === "object" && cel.cellars ? cel.cellars : {};
    cellarsChanged();
    META = meta;
    familyRatings = fr && typeof fr.ratings === "object" && fr.ratings ? fr.ratings : {};
    addWines(wines);
    LOADED.add("BC Liquor");
  } catch (err) {
    $("result-count").textContent = "The wine list could not be loaded.";
    $("result-list").innerHTML = `<div class="empty"><p>Please check the internet connection and reload the page.</p>
      <button type="button" class="btn btn-primary" onclick="location.reload()">Reload the page</button></div>`;
    $("foot-editions").textContent = "";
    return;
  }
  renderFooter();
  renderAll();
  updatePickCounts();
  if (!history.state?.wfView) history.replaceState({ wfView: currentView(), y: 0 }, "");
  if (/^#(save|scores|share|dine)=/.test(location.hash)) announceNewerTab(); // older Wine Finder tabs step aside
  offerSavedRatings();
  unlockFromLink();
  offerDinePicks();
  renderDineRecall();
  addHelpButtons();
  await restorePlace();
  window.addEventListener("hashchange", offerSavedRatings);
  window.addEventListener("hashchange", unlockFromLink);
  tabReady = true;
  saveQuickMarks();
  saveShopping();
  setTimeout(() => loadAllSources().then(() => { updatePickCounts(); renderSources(); }), 800);
}

init();
