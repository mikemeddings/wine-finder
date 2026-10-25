"use strict";

// ---- Easy-to-edit settings ------------------------------------------------

// One-tap presets. Each sets the filters from scratch, and its button shows how many
// wines it finds (a pick that finds none is hidden). Keys:
//   stores: "all" or a list such as ["ZYN"] (default: BC Liquor only)
//   countries, types, sweet, priceFrom, priceTo, q (every word must appear)
//   minAge: vintage at least this many years old; topOnly: on a store's 90+ list
//   allSizes: every bottle size (default: 750 ml only)
//   colour: wine, gold, teal, green, plum, blue (see .pick-* in app.css)
const QUICK_PICKS = [
  { label: "Portugal reds $20–50", colour: "wine", countries: ["Portugal"], types: ["Red"], priceFrom: 20, priceTo: 50 },
  { label: "Under $25 whites", colour: "gold", types: ["White"], priceTo: 25 },
  { label: "Something unusual", colour: "teal", stores: "all",
    detail: "Georgia, Greece, Hungary, Lebanon, Moldova… at any store",
    countries: ["Georgia", "Greece", "Hungary", "Lebanon", "Moldova", "South Africa", "Croatia",
                "Slovenia", "Montenegro", "Romania", "Bulgaria", "Uruguay", "Israel", "Morocco", "Ukraine"] },
  { label: "Moldovan wines", colour: "teal", stores: "all", detail: "at any store", countries: ["Moldova"] },
  { label: "Fortified classics", colour: "plum", stores: "all", detail: "Port, Madeira, Sherry", types: ["Fortified"] },
  { label: "Wines with some age", colour: "blue", stores: "all", detail: "10 years or older", minAge: 10 },
  { label: "ZYN's 90+ points under $35", colour: "green", stores: ["ZYN"], topOnly: true, detail: "ZYN's own list" },
];

// "Famous wines" buttons: the best-known names from each country, searched at every
// store. A wine matches if its name contains one of these phrases as whole words
// (accents, capitals and punctuation are ignored). Edit freely.
const ICONS = {
  Chile: ["don melchor", "almaviva", "sena", "vinedo chadwick", "clos apalta", "montes alpha m",
          "purple angel", "casa real", "carmin de peumo", "altair"],
  France: ["lafite rothschild", "chateau latour", "chateau margaux", "chateau haut brion", "la mission haut brion", "mouton rothschild",
           "petrus", "cheval blanc", "ausone", "yquem", "romanee conti", "la tache", "krug", "dom perignon"],
  Australia: ["penfolds grange", "hill of grace", "bin 707", "yattarna", "st henri", "runrig", "astralis",
              "mount edelstone", "diana madeline"],
  Portugal: ["barca velha", "vale meao", "pera manca", "noval nacional", "batuta", "charme",
             "vinha maria teresa", "vintage port"],
  Italy: ["sassicaia", "ornellaia", "masseto", "tignanello", "solaia", "monfortino", "biondi santi",
          "quintarelli", "dal forno", "pergole torte", "flaccianello", "gaja", "bruno giacosa"],
};
const ICON_PICKS = Object.entries(ICONS).map(([country, names]) => ({
  label: `${country} icons`, colour: "gold", stores: "all", countries: [country], names, allSizes: true,
}));
const THIS_YEAR = new Date().getFullYear();

// The question copied for Claude. {ABOUT_ME} comes from Settings (stays on this computer).
const PROMPT_TEMPLATE = `I'm choosing wines and would like your help. {ABOUT_ME}

Here are the wines I'm considering, with where they're sold and the current price:
{WINES}

For each wine, please:
- Tell me about the region, the producer and the grapes — the history and the story behind it.
- Look up current reviews on the web (critics and CellarTracker community notes). For every score, name the source and the vintage it applies to. If you can't find reviews for this wine, say so plainly rather than estimating.
- Describe what the critics say in your own words. Give their scores with the source, but don't copy their tasting notes.
- Give me a practical note: drink now or cellar, whether to decant, and a food pairing.
- Start each wine's section with a heading that ends with its code in square brackets, exactly as in my list, for example: ## Château Example 2019 [bcl-123456]
- End each wine's section with its own short "Sources:" list, so each wine's sources stay with it.

Along the way:
- Whenever you mention a particular place (a vineyard, estate, village, river valley or wine region), add a Google Maps satellite link so I can look at it from above. Build it from the place name like this: https://www.google.com/maps?q=Quinta+das+Carvalhas,+Pinhao,+Portugal&t=k (place, nearest town, country, with + for spaces; keep &t=k on the end, which opens the satellite view). Use names, not coordinates.
- For each wine, end with a short "From the history books" section: two or three facts with dates about the people, places and events behind it (founders, dynasties, wars, treaties, trade routes, phylloxera and the like). Give each a Wikipedia link. Link an article directly only if you actually opened it; otherwise use a search link like https://en.wikipedia.org/wiki/Special:Search?search=Real+Companhia+Velha&go=Go so it never leads to a missing page.
- I enjoy the occasional curious aside: the geology and soils, the climate or the science behind the winemaking. Hold these to the same standard as everything else, with sources.

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
const PRICE_STEPS = [15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 500];
const TYPES = ["Red", "White", "Rosé", "Sparkling", "Fortified", "Dessert", "Sake", "Other"];
const SWEET_BANDS = [
  { label: "Dry", lo: 0, hi: 1 },
  { label: "Off-dry", lo: 2, hi: 4 },
  { label: "Medium-sweet", lo: 5, hi: 7 },
  { label: "Sweet", lo: 8, hi: 10 },
];
const ALL_SOURCES = ["BC Liquor", "BSW Liquor", "ZYN"];
// How each source is named on screen, in the shortlist and in the Claude question.
const SOURCE_LABELS = { "BC Liquor": "BC Liquor - LDB" };
const SOURCE_CLASS = { "BC Liquor": "bcl", "BSW Liquor": "bsw", ZYN: "zyn" };
const CALGARY = new Set(["BSW Liquor", "ZYN"]);
const PAGE_SIZE = 100;
const STORE = { shortlist: "wf.shortlist", aboutMe: "wf.aboutMe", myWines: "wf.myWines", ratings: "wf.ratings", ghKey: "wf.ghKey", mailApp: "wf.mailApp", cellarNames: "wf.cellarNames", notes: "wf.notes", myName: "wf.myName", inboxKey: "wf.inboxKey", dine: "wf.dine", dineAsk: "wf.dineAsk", dineHistory: "wf.dineHistory" };

// ---- Helpers -----------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const money = (n) => "$" + Number(n).toFixed(2);
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
function sweetText(w) {
  if (w.sweetness == null) return "Sweetness not rated";
  const b = SWEET_BANDS.find((b) => w.sweetness >= b.lo && w.sweetness <= b.hi);
  return `${b ? b.label : "Sweetness"} (${w.sweetness} of 10)`;
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
      <div><strong>${money(w.price)}</strong> at ${sourceBadge(w.source)}</div>${ratingsHtml(w)}${familyLinksHtml(w)}</div>
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
  state = defaultState();
  state.q = q;
  state.sources = new Set(LOADED);
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
    countryQ: "",
    types: new Set(),
    priceFrom: null,
    priceTo: null,
    sweet: new Set(),
    notRated: true,
    bottleOnly: true,
    q: "",
    newOnly: false,
    topOnly: false, // only wines on a store's own "90+ points" list (ZYN)
    names: null,    // famous-wine phrases (an Icons pick)
    minAge: null,   // vintage at least this many years old
    pickLabel: "",  // the quick pick that set these filters, for the "Showing:" line
    sorts: ["price-asc", "", ""], // Sort by, then by, then by ("" = nothing)
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
  if (skip !== "country" && st.countries.size && !st.countries.has(w.country)) return false;
  if (skip !== "type" && st.types.size && !st.types.has(w.type)) return false;
  if (st.priceFrom != null && w.price != null && w.price < st.priceFrom) return false;
  if (st.priceTo != null && w.price != null && w.price > st.priceTo) return false;
  if (st.bottleOnly && w.size_ml !== 750) return false;
  if (st.newOnly && !w.new_since_last) return false;
  if (st.topOnly && !w.retailer_scores) return false;
  if (st.minAge && !(w.vintage && w.vintage <= THIS_YEAR - st.minAge)) return false;
  if (st.names && !st.names.some((n) => w._w.includes(n))) return false;
  if (w.sweetness == null) {
    if (!st.notRated) return false;
  } else if (st.sweet.size) {
    const ok = SWEET_BANDS.some((b) => st.sweet.has(b.label) && w.sweetness >= b.lo && w.sweetness <= b.hi);
    if (!ok) return false;
  }
  if (st.q) {
    for (const t of fold(st.q).split(/\s+/)) if (t && !w._s.includes(t)) return false;
  }
  return true;
}

// Sorting: up to three levels. Each choice is a key and a direction; the second level only
// orders wines that tie on the first, and so on. A wine without the value (no vintage, no
// score…) goes to the bottom of its group either way, and the next level orders those too.
const SORT_KEYS = {
  price: { get: (w) => w.price, up: "Price: low to high", down: "Price: high to low" },
  name: { get: (w) => w.name, text: true, up: "Name: A to Z", down: "Name: Z to A" },
  country: { get: (w) => (w.country === "Country not stated" ? null : w.country), text: true, up: "Country: A to Z", down: "Country: Z to A" },
  vintage: { get: (w) => w.vintage, up: "Vintage: oldest first", down: "Vintage: newest first", first: "down" },
  abv: { get: (w) => w.abv, up: "Alcohol %: lowest first", down: "Alcohol %: highest first" },
  sweet: { get: (w) => w.sweetness, up: "Sweetness: driest first", down: "Sweetness: sweetest first", first: "down" },
  claude: { get: (w) => claudeScore(w), up: "Claude's rating (all family research): lowest first", down: "Claude's rating (all family research): highest first", first: "down" },
  mine: { get: (w) => ratingOf(w.id).mine?.points, up: "Your rating: lowest first", down: "Your rating: highest first", first: "down" },
  family: { get: (w) => frScore(w.id), up: "Family rating (FR): lowest first", down: "Family rating (FR): highest first", first: "down" },
  // the cellar owner's own CellarTracker score, else the CellarTracker community score
  ct: { get: (w) => w.my_score ?? w.ct_score, up: "CellarTracker score: lowest first", down: "CellarTracker score: highest first", first: "down" },
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
      <button type="button" class="btn btn-ew" data-action="goto-ew">Where can I buy…? ↑</button>`;
    renderCellarFilter();
    return;
  }
  const cel = [...state.sources].filter((s) => !ALL_SOURCES.includes(s));
  $("source-legend").textContent = cel.length ? `Sold by (of ${cel.join(", ")}'s wines)`.replace("'s cellar's", "'s") : "Sold by";
  $("source-list").innerHTML = have.map((s) => checkbox("source", s, state.sources.has(s), sourceBadge(s), null)).join("") +
    (have.includes("ZYN") ? `<label class="check check-strong"><input type="checkbox" id="top-only"${state.topOnly ? " checked" : ""}>
       Only ZYN's “90+ point wines under $35”</label>
       <p class="hint">ZYN's own list of wines rated 90 or more, priced under $35.</p>` : "");
  renderCellarFilter();
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
}

// Every country the chosen sources carry (plus any ticked), even when other
// filters leave it with no wines, so the list never looks like it is missing some.
function visibleCountries(all, q = fold(state.countryQ)) {
  return [...new Set([...all, ...state.countries])]
    .filter((n) => !q || fold(n).includes(q))
    .sort((a, b) => a.localeCompare(b));
}

function renderTypes() {
  const counts = countBy("type", "type");
  $("type-list").innerHTML = TYPES
    .filter((t) => counts.has(t) || state.types.has(t))
    .map((t) => checkbox("type", t, state.types.has(t), typePill(t), counts.get(t) || 0))
    .join("");
}

function renderSweet() {
  $("sweet-list").innerHTML = SWEET_BANDS
    .map((b) => checkbox("sweet", b.label, state.sweet.has(b.label), `${b.label} <span class="hint" style="display:inline">(${b.lo}–${b.hi})</span>`, null))
    .join("");
}

function syncInputs() {
  $("q").value = state.q;
  $("country-q").value = state.countryQ;
  $("price-from").value = state.priceFrom ?? "";
  $("price-to").value = state.priceTo ?? "";
  $("not-rated").checked = state.notRated;
  $("bottle-only").checked = state.bottleOnly;
  renderSorts();
}

function filtersOnCount() {
  return state.countries.size + state.types.size + state.sweet.size + (state.priceFrom != null) +
    (state.priceTo != null) + !!state.q + state.newOnly + state.topOnly + !state.bottleOnly + !state.notRated;
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
    <p class="wine-detail"><span class="badge badge-cellar">${esc(w.source)}</span>${w.size_ml && w.size_ml !== 750 ? ` ${esc(sizeText(w))}` : ""}</p>
    ${scores ? `<p class="wine-detail mw-scores">${scores}</p>` : ""}${soldAtHtml(w)}${ratingsHtml(w)}${familyLinksHtml(w)}
    <div class="wine-actions">
      ${researchButton(w)}
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>
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
  const scores = w.retailer_scores ? `<p class="wine-detail"><span class="badge badge-score">★ ${esc(w.retailer_scores)}</span></p>` : "";
  const retailer = w.url ? `<a class="btn ext" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(sourceLabel(w.source))} page</a>` : "";
  return `<article class="wine wine-${esc(w.type)}${on ? " on-list" : ""}">
    <h3 class="wine-name">${esc(w.name)}</h3>
    <div class="wine-price">${money(w.price)}</div>
    <p class="wine-facts">${typePill(w.type)} ${facts}</p>
    <p class="wine-detail">${detail} ${badges}</p>${scores}${calgary}${ratingsHtml(w)}${familyLinksHtml(w)}
    <div class="wine-actions">
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "＋ Add to Short List for Claude Research"}</button>
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

function renderResults() {
  lastResults = findPool().filter((w) => matches(w)).sort(currentSort());
  const n = lastResults.length;
  $("result-count").textContent = n === 1 ? "1 wine" : `${n.toLocaleString()} wines`;

  const parts = [];
  if (state.q) parts.push(`words “${esc(state.q)}”`);
  if (state.countries.size)
    parts.push(state.countries.size > 6 ? `${state.countries.size} countries` : [...state.countries].map(esc).join(", "));
  if (state.types.size) parts.push([...state.types].map(esc).join(", "));
  if (state.priceFrom != null && state.priceTo != null) parts.push(`${money(state.priceFrom)} to ${money(state.priceTo)}`);
  else if (state.priceTo != null) parts.push(`up to ${money(state.priceTo)}`);
  else if (state.priceFrom != null) parts.push(`${money(state.priceFrom)} and up`);
  if (state.sweet.size) parts.push([...state.sweet].join(", ") + (state.notRated ? " (and not rated)" : ""));
  else if (!state.notRated) parts.push("sweetness rated only");
  parts.push(state.bottleOnly ? "750 ml bottles" : "all sizes");
  if (state.newOnly) parts.push("new on the latest BC list");
  if (state.topOnly) parts.push("ZYN's 90+ under $35 list");
  if (state.minAge) parts.push(`${state.minAge} years or older`);
  if (state.names) parts.push(`famous wines (${esc(state.pickLabel)})`);
  if (cellarOn()) {
    const stores = storesTicked(), cellarsTicked = state.sources.size - stores.length;
    parts.unshift([...state.sources].filter((s) => !ALL_SOURCES.includes(s)).map(esc).join(", ") +
      (stores.length ? `, sold by ${stores.map(sourceLabel).map(esc).join(" or ")}` : cellarsTicked > 1 ? " (the whole cellars)" : " (the whole cellar)"));
  } else if (state.sources.size > 1) parts.unshift([...state.sources].map(sourceLabel).map(esc).join(", "));
  $("active-filters").innerHTML = `<strong>Showing:</strong> ${parts.join(" · ")}`;

  if (!n) {
    const newHint = state.newOnly && !WINES.some((w) => w.new_since_last)
      ? "<p>“New” wines appear once a second BC price list has come out, so they can be compared.</p>" : "";
    $("result-list").innerHTML = `<div class="empty">${newHint}<p>No wines match these choices. Try removing a filter, or start again.</p>
      <button type="button" class="btn btn-primary" data-action="start-over">Start over</button></div>`;
  } else {
    $("result-list").innerHTML = lastResults.slice(0, state.shown).map(wineCard).join("");
  }
  const more = n - state.shown;
  $("show-more").hidden = more <= 0;
  $("show-more").textContent = `Show ${Math.min(more, PAGE_SIZE)} more wines (${more.toLocaleString()} not shown yet)`;

  const on = filtersOnCount();
  $("filter-toggle").textContent = ($("filter-body").classList.contains("open") ? "Hide filters" : "Show filters") +
    (on ? ` (${on} chosen)` : "");
}

function renderAll() {
  renderSources();
  renderCountries();
  renderTypes();
  renderSweet();
  syncInputs();
  renderResults();
}

// Re-render everything except the input being typed in.
function refresh() {
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

// "$25.99 at BC Liquor - LDB", or "from Alex's cellar" for a wine with no shop price.
function priceText(w) {
  if (w.kind === "typed") return "added by name, not on my store lists";
  if (w.kind === "cellar" || w.price == null) return `from ${sourceLabel(w.source)}`;
  return `${money(w.price)} at ${sourceLabel(w.source)}`;
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
      <div>${w.kind === "cellar" || w.price == null ? esc(priceText(w)) : `<strong>${money(w.price)}</strong> at ${esc(sourceLabel(w.source))}`}</div>
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

function claudeLink(prompt) {
  const prefillUrl = `${CLAUDE_URL}?q=${encodeURIComponent(prompt)}`;
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
  // Browsers let a click open a tab only for a few seconds, and copying can be slow.
  // When the link carries the question, open first and copy as a backup afterwards;
  // otherwise the copy is essential, so do it first.
  let copied = false, win;
  const open = () => { win = window.open(url, "_blank"); if (win) win.opener = null; }; // "noopener" would make this return null
  if (prefilled) { open(); copied = await copyText(prompt); }
  else { copied = await copyText(prompt); open(); }

  let msg;
  if (!win) msg = `Your browser stopped the new tab from opening. Please press the button again, or <a href="${esc(url)}" target="_blank" rel="noopener">open Claude here</a>.`;
  else if (prefilled) msg = `Claude is open in a new tab. Go to it, check the question, and ${SEND}.` +
    (copied ? ` If its message box is empty, click in it and press <strong>Ctrl+V</strong>: the question is copied.` : "");
  else if (copied) msg = `Claude is open in a new tab. In it, ${PASTE}.`;
  else msg = `Claude is open in a new tab. Please copy the question from the box below (it's selected: press <strong>Ctrl+C</strong>), then ${PASTE}.`;

  const result = $("claude-result");
  result.hidden = false;
  result.innerHTML = msg;
  $("go-claude").textContent = "Open Claude again";
  if (!copied && !prefilled) {
    $("ask-notice").querySelector("details").open = true;
    $("prompt-text").focus(); $("prompt-text").select(); $("prompt-text").scrollTop = 0;
  }
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
  showView("find");
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
  const same = (a, b) => b && JSON.stringify(a) === JSON.stringify(b);
  if (r.claude && !same(r.claude, f.claude)) {
    const c = r.claude;
    parts.push(`<span class="rating rating-claude">Claude's rating <strong>${c.points ?? "no reviews found"}</strong>` +
      `${c.vintage ? ` (${esc(String(c.vintage))})` : ""}${c.note ? ` · ${esc(c.note)}` : ""}` +
      ` <span class="rating-date">${esc(shortDate(c.date))}</span></span>`);
  }
  if (r.mine && !same(r.mine, f.family)) {
    parts.push(`<span class="rating rating-mine">Your rating <strong>${r.mine.points}</strong>` +
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

// The link Claude makes: <page>#save=CODE~POINTS~VINTAGE~NOTE;CODE~...
// It comes from Claude's answer, so every field is checked and nothing is saved
// until the person presses "Save these ratings".
function parseSaveHash(hash) {
  const m = /^#save=([\s\S]*)$/.exec(hash || "");
  if (!m) return parseShareHash(hash);
  let raw = m[1].replace(/\+/g, " ");
  try { raw = decodeURIComponent(raw); } catch { /* keep as is */ }
  const items = [];
  for (const part of raw.split(";")) {
    const [code = "", pts = "", vin = "", ...rest] = part.split("~").map((s) => s.trim());
    if (!/^(bcl|bsw|zyn|cellar|manual|typed)-[\w.-]{1,80}$/.test(code)) continue;
    const n = parseInt(pts, 10);
    const points = /^\d{2,3}$/.test(pts) && n >= 50 && n <= 100 ? n : null;
    if (pts && points === null) continue; // a score we can't trust: skip rather than guess
    items.push({
      id: code,
      points,
      vintage: /^(19|20)\d\d$/.test(vin) ? +vin : /^nv$/i.test(vin) ? "NV" : null,
      note: rest.join(" ").replace(/\s+/g, " ").slice(0, 80) || null,
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
    if (!/^(bcl|bsw|zyn|cellar|manual|typed)-[\w.-]{1,80}$/.test(code)) continue;
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
  const shared = items.some((it) => it.shared);
  const nameOf = (it) => findWine(it.id)?.name || (sharedIdOf(it.id) && findWine(sharedIdOf(it.id))?.name) || ratingOf(it.id).name || it.name;
  const n = `${items.length} ${items.length === 1 ? "wine" : "wines"}`;
  $("save-q").textContent = !items.length ? "This link didn't contain any ratings that could be read."
    : shared ? `Ratings emailed from family for ${n}. Save them?` : `Save Claude's ratings for ${n}?`;
  $("save-list").innerHTML = items.map((it) => `<li><strong>${esc(nameOf(it) || `Wine ${it.id} (not found on this computer)`)}</strong>` +
    (it.claude === false ? "" : `<br>Claude's rating: <strong>${it.points ?? "no reviews found"}</strong>${it.vintage ? ` (${esc(String(it.vintage))})` : ""}${it.note ? ` · ${esc(it.note)}` : ""}`) +
    (it.mine ? `<br>Family member's own rating: <strong>${it.mine.points}</strong>${it.mine.note ? ` · ${esc(it.mine.note)}` : ""}` : "") +
    `</li>`).join("");
  $("save-help").hidden = items.length > 0;
  $("save-yes").hidden = items.length === 0;
  $("save-yes").textContent = "Save";
  $("save-yes").dataset.done = "";
  $("save-no").hidden = false;
  $("save-result").innerHTML = "";
  $("save-writeup").hidden = items.length === 0 || shared;
  $("save-writeup-text").value = "";
  writeupText = "";
  $("save-name-row").hidden = !!myName();
  $("save-dialog").showModal?.();
  if (!$("save-writeup").hidden) { showWriteupState(); checkWriteup(); }
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
    const claude = it.claude !== false ? { points: it.points, vintage: it.vintage, note: it.note, date: today } : null;
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
  pendingSave = null;
  const nNotes = Object.keys(parts).length;
  const gotText = nNotes ? `Claude's write-up kept for ${nNotes} ${nNotes === 1 ? "wine" : "wines"}.` : "No write-up was found, so only the ratings were saved.";
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
const frScore = (id) => frOf(id).family?.points ?? frOf(id).claude?.points ?? null;
const claudeScore = (w) => ratingOf(w.id).claude?.points ?? frOf(w.id).claude?.points ?? null;

function frHtml(w) {
  const f = frOf(w.id), parts = [];
  if (f.claude) parts.push(`<span class="rating rating-fr">FR <strong>${f.claude.points ?? "no reviews"}</strong> (Claude)` +
    `${f.claude.vintage ? ` · ${esc(String(f.claude.vintage))}` : ""}${f.claude.note ? ` · ${esc(f.claude.note)}` : ""}</span>`);
  if (f.family) parts.push(`<span class="rating rating-fr">FR <strong>${f.family.points}</strong> (family)` +
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
  "chateau domaine bodega bodegas estate estates winery vineyard vineyards cellars reserve reserva sparkling dry brut").split(" "));
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
      if (w.type && e.w.type && w.type !== "Other" && e.w.type !== "Other" && w.type !== e.w.type) continue; // their rosé isn't Jon's red
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
function storeMatchesOf(cellarId) {
  const key = `${WINES.length}|${[...LOADED].join()}`;
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
      `${esc(sourceLabel(s.source))} ${money(s.price)}${s.vintage ? ` (${esc(String(s.vintage))})` : ""}` +
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
let placeWords = null;
const isPlaceWord = (t) => {
  placeWords ??= new Set(cellarFindWines().flatMap((w) => nameTokens(`${w.region_or_grape || ""} ${w.varietal || ""} ${w.country || ""}`)));
  return placeWords.has(t) || GRAPE_WORDS.has(t);
};
function sameWineName(a, b) {
  const A = storeTokens(a), B = storeTokens(b);
  const [small, big] = A.length <= B.length ? [A, B] : [B, A];
  const smallSet = new Set(small), bigSet = new Set(big);
  return small.length >= 2 && small.every((t) => bigSet.has(t)) && styleOf(a) === styleOf(b) &&
    big.filter((t) => !smallSet.has(t)).every(isPlaceWord) &&
    small.some((t) => !isPlaceWord(t)); // a name, not just "Cabernet Sauvignon" or a region
}

// Ratings the family gave this wine under its other records (cellar entries, names typed).
function relatedRatings(w) {
  const seen = new Set([w.id]), out = [];
  for (const id of cellarMatches(w).ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const f = frOf(id), c = cellarFindWines().find((x) => x.id === id);
    if (f.claude || f.family) out.push({ f, label: c ? `${c.source}${c.vintage ? `, ${c.vintage}` : ""}` : "a family cellar" });
  }
  for (const [id, r] of Object.entries(familyRatings)) {
    if (seen.has(id) || !id.startsWith("typed-") || !r.name || !sameWineName(w.name, r.name)) continue;
    seen.add(id);
    out.push({ f: r, label: `researched as “${r.name}”` });
  }
  // ratings given to a store's listing of the same wine (BC Liquor, BSW, ZYN)
  const STORE_OF = { bcl: "BC Liquor - LDB", bsw: "BSW Liquor", zyn: "ZYN" };
  for (const [id, r] of Object.entries(familyRatings)) {
    const store = STORE_OF[id.split("-")[0]];
    if (seen.has(id) || !store || !r.name || !sameWineName(w.name, r.name)) continue;
    seen.add(id);
    out.push({ f: r, label: `rated as “${r.name}” (${store})` });
  }
  return out;
}

function familyLinksHtml(w) {
  const badges = cellarMatches(w).map((m) => `<span class="badge badge-cellar">${w.kind === "cellar" ? "Also in" : "In"} ${esc(m.source)}` +
    `${m.vintages.length ? ` (${esc(m.vintages.join(", "))})` : ""}</span>`);
  const rel = relatedRatings(w).map(({ f, label }) => {
    const c = f.claude, fam = f.family;
    return `<span class="rating rating-fr rating-related">FR <strong>${fam ? fam.points : c?.points ?? "no reviews"}</strong> ` +
      `(${fam ? "family" : "Claude"})${!fam && c?.vintage ? ` · ${esc(String(c.vintage))}` : ""} · ${esc(label)}</span>`;
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
  if (!out.length) out.push("price-asc");
  state.sorts = [...out, "", ""].slice(0, 3);
  delete state.sort;
}

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

const DINE_TEMPLATE = `I'm at a restaurant and I'm attaching a photo of the wine list. Please read every wine and price on it, then help me choose. {CHOICES} {ABOUT_ME}

Please:
- Start by saying how many wines you could read on the list, and how many (if any) you couldn't read.
- Then recommend your top 5 wines from this list only, best first (fewer if fewer suit my food and budget). For each: the wine exactly as written on the list and its price on the list; what it is, in two or three sentences; what critics say about it, in your own words, with a score, its source and the vintage it's for, if you know one; why it suits my food and budget; and whether the price is fair compared with what the bottle usually costs in a store (restaurants often charge two to three times the store price).
- Then, under the heading "Wines to skip", list up to 5 wines on this list I should avoid for this meal and budget (never one of your picks, and fewer if few deserve it). Give each one reason, exactly one of: Overpriced, Wrong for your food, Weak reviews, Past its best, and one sentence why.
- If you can't read part of the photo, say so rather than guessing.
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
  return DINE_TEMPLATE
    .replace("{CHOICES}", bits.join(" "))
    .replace("{ABOUT_ME}", about ? `About me: ${about}` : "")
    .replace("{BASE}", location.href.split("#")[0].split("?")[0]);
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
  let copied = false, win;
  const open = () => { win = window.open(url, "_blank"); if (win) win.opener = null; };
  if (prefilled) { open(); copied = await copyText(prompt); } else { copied = await copyText(prompt); open(); }
  const steps = $("dine-steps");
  steps.hidden = false;
  steps.innerHTML = win ? `<ol class="steps dine-steps-list">
      <li><strong>Claude is open in a new tab</strong> with your question already written.${copied ? " If its message box is empty, tap in it and paste: the question is copied." : ""}</li>
      <li>In Claude, tap <strong>＋</strong> or <strong>📷</strong> (at the left of the message box), <strong>take a photo of the wine list</strong> (straight on, the part you're interested in), then send.</li>
      <li>When Claude finishes, tap <strong>🍷 Back to my Wine Finder with tonight's picks</strong> at the very bottom of its answer.</li>
    </ol>`
    : `Your browser stopped the new tab from opening. <a href="${esc(url)}" target="_blank" rel="noopener">Open Claude here</a>.`;
  $("dine-go").textContent = "Open Claude again";
  steps.scrollIntoView({ block: "nearest" });
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
  const ids = new Set([w.id, sharedIdOf(w.id), ...(cellarMatches(w).ids || [])].filter(Boolean));
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`)
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
      if (it.claude) e.claude = it.claude;
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

function showWriteup(title, meta, text) {
  $("notes-title").textContent = title;
  $("notes-body").innerHTML = `<section class="note"><p class="note-meta">${esc(meta)}</p>${mdToHtml(text)}</section>`;
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
if (tabChannel) tabChannel.onmessage = (e) => { if (e.data?.type === "newer-tab") stepAside(); };
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
const HELP_LINKS = [["#quick-h", "help-find"], ["#filters-h", "help-find"], ["#ew-h", "help-where"],
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
const VIEWS = ["find", "shortlist", "mywines", "dine", "help"];
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
const SET_KEYS = ["sources", "countries", "types", "sweet"];
let openNotesId = null;
function savePlace() {
  try {
    const st = { ...state };
    for (const k of SET_KEYS) st[k] = [...state[k]];
    sessionStorage.setItem("wf.place", JSON.stringify({ view: currentView(), y: window.scrollY, state: st, notes: openNotesId }));
  } catch { /* private window etc.: nothing to restore later */ }
}
window.addEventListener("pagehide", savePlace);
$("notes-dialog")?.addEventListener("close", () => { if (document.visibilityState === "visible") openNotesId = null; });
document.addEventListener("visibilitychange", () => { if (document.hidden) savePlace(); });

async function restorePlace() {
  const nav = performance.getEntriesByType?.("navigation")?.[0]?.type;
  if (nav !== "back_forward" && nav !== "reload") return; // a fresh visit starts clean
  if (/^#(save|share|dine)=/.test(location.hash)) return;  // a link from Claude has its own job
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
  $("view-mywines").hidden = name !== "mywines";
  $("view-dine").hidden = name !== "dine";
  $("view-help").hidden = name !== "help";
  for (const el of document.querySelectorAll(".help-keeper")) el.hidden = !isKeeper(); // the keeper's topic: keeper's computer only
  for (const b of document.querySelectorAll(".view-btn")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
  if (name === "shortlist") renderShortlist();
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

const ALL_PICKS = [...QUICK_PICKS, ...ICON_PICKS];
const pickStores = (p) => (p.stores === "all" ? knownSources() : p.stores || ["BC Liquor"]);

function pickState(p) {
  const st = defaultState();
  st.sources = new Set(pickStores(p));
  if (p.countries) st.countries = new Set(p.countries);
  if (p.types) st.types = new Set(p.types);
  if (p.sweet) st.sweet = new Set(p.sweet);
  st.priceFrom = p.priceFrom ?? null;
  st.priceTo = p.priceTo ?? null;
  st.q = p.q ?? "";
  st.topOnly = !!p.topOnly;
  st.minAge = p.minAge ?? null;
  st.names = p.names ? p.names.map(words) : null;
  st.bottleOnly = !p.allSizes;
  st.pickLabel = p.label;
  return st;
}

function pickButton(p, i) {
  return `<button type="button" class="btn pick pick-${esc(p.colour || "wine")}" data-pick="${i}">
    <span>${esc(p.label)} <span class="pick-count" data-count="${i}"></span></span>${p.detail ? `<small>${esc(p.detail)}</small>` : ""}</button>`;
}

function renderPicks() {
  $("quick-list").innerHTML = QUICK_PICKS.map((p, i) => pickButton(p, i)).join("");
  $("icon-list").innerHTML = ICON_PICKS.map((p, i) => pickButton(p, QUICK_PICKS.length + i)).join("");
  updatePickCounts();
}

// "· 8 wines" on each button once its stores are loaded; a pick with none is hidden.
function updatePickCounts() {
  ALL_PICKS.forEach((p, i) => {
    const el = document.querySelector(`[data-count="${i}"]`);
    if (!el) return;
    if (!pickStores(p).every((s) => LOADED.has(s))) { el.textContent = "· …"; return; }
    const st = pickState(p);
    const n = WINES.reduce((k, w) => k + matches(w, null, st), 0);
    el.textContent = `· ${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}`;
    el.closest(".pick").hidden = n === 0;
  });
}

async function applyQuickPick(p) {
  state = pickState(p);
  const need = pickStores(p).filter((s) => !LOADED.has(s));
  if (need.length) {
    $("result-count").textContent = "Loading the store lists…";
    await Promise.all(need.map(loadSource));
    renderFooter();
  }
  renderAll();
  $("results-h").scrollIntoView({ block: "start" });
}

function stepPrice(id, dir) {
  const key = id === "price-from" ? "priceFrom" : "priceTo";
  const cur = state[key];
  let next;
  if (dir > 0) next = cur == null ? PRICE_STEPS[0] : PRICE_STEPS.find((s) => s > cur) ?? null;
  else next = cur == null ? PRICE_STEPS[PRICE_STEPS.length - 1] : [...PRICE_STEPS].reverse().find((s) => s < cur) ?? null;
  state[key] = next;
  $(id).value = next ?? "";
  state.shown = PAGE_SIZE;
  refresh();
}

// ---- Events ------------------------------------------------------------------

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function wireEvents() {
  renderPicks();
  wireMyWines();

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.dataset.pick != null) applyQuickPick(ALL_PICKS[+t.dataset.pick]);
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
    else if (t.dataset.ew) toggleElsewhere(t);
    else if (t.dataset.target) stepPrice(t.dataset.target, +t.dataset.dir);
    else if (t.dataset.action === "start-over") startOver();
    else if (t.dataset.action === "goto-ew") {
      $("ew-h").scrollIntoView({ block: "start" });
      document.querySelector("#ew-top .ew-q").focus({ preventScroll: true });
    }
    else if (t.dataset.action === "hide-notice") closeClaudeSteps();
    else if (t.dataset.action === "hits-in-list") showHitsInList();
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
    else if (t.id === "notes-close") { $("notes-dialog").close(); openNotesId = null; }
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
  $("price-any").addEventListener("click", () => {
    state.priceFrom = state.priceTo = null;
    $("price-from").value = $("price-to").value = "";
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
      const set = { source: state.sources, country: state.countries, type: state.types, sweet: state.sweet }[group];
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
    } else if (t.id === "top-only") {
      state.topOnly = t.checked;
      if (t.checked && !state.sources.has("ZYN")) { // the list is ZYN's, so show ZYN's wines
        state.sources.add("ZYN");
        renderSources();
        $("result-count").textContent = "Loading ZYN…";
        loadSource("ZYN").then(() => { renderFooter(); state.shown = PAGE_SIZE; refresh(); });
        return;
      }
    } else if (t.id === "not-rated") state.notRated = t.checked;
    else if (t.id === "bottle-only") state.bottleOnly = t.checked;
    else return;
    state.shown = PAGE_SIZE;
    refresh();
  });

  $("ew-top").innerHTML = elsewhereHtml("", "Wine name", true);
  $("sl-add-q").addEventListener("input", renderSlAddHits);
  $("sl-add-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addFromShortlistBox(); } });
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("ew-q")) updateElsewhere(e.target.closest(".elsewhere"));
  });

  $("q").addEventListener("input", debounce(() => { state.q = $("q").value.trim(); state.shown = PAGE_SIZE; refresh(); }, 200));
  $("country-q").addEventListener("input", () => { state.countryQ = $("country-q").value; renderCountries(); });
  for (const id of ["price-from", "price-to"]) {
    $(id).addEventListener("input", debounce(() => {
      const v = parseFloat($(id).value);
      state[id === "price-from" ? "priceFrom" : "priceTo"] = Number.isFinite(v) && v >= 0 ? v : null;
      state.shown = PAGE_SIZE;
      refresh();
    }, 300));
  }
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
const knownSources = () => ALL_SOURCES.filter((s) => s === "BC Liquor" || sourceFile(s));
const allLoaded = () => knownSources().every((s) => LOADED.has(s));
const loadedSourceLabels = () => knownSources().filter((s) => LOADED.has(s)).map(sourceLabel).join(", ");

function loadSource(name) {
  if (LOADED.has(name)) return Promise.resolve();
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

async function init() {
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
  if (/^#(save|share|dine)=/.test(location.hash)) announceNewerTab(); // older Wine Finder tabs step aside
  offerSavedRatings();
  offerDinePicks();
  renderDineRecall();
  addHelpButtons();
  await restorePlace();
  window.addEventListener("hashchange", offerSavedRatings);
  setTimeout(() => loadAllSources().then(() => { updatePickCounts(); renderSources(); }), 800);
}

init();
