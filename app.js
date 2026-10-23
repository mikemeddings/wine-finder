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
- Give me a practical note: drink now or cellar, whether to decant, and a food pairing.

Along the way:
- Whenever you mention a particular place (a vineyard, estate, village, river valley or wine region), add a Google Maps satellite link so I can look at it from above. Build it from the place name like this: https://www.google.com/maps?q=Quinta+das+Carvalhas,+Pinhao,+Portugal&t=k (place, nearest town, country, with + for spaces; keep &t=k on the end, which opens the satellite view). Use names, not coordinates.
- For each wine, end with a short "From the history books" section: two or three facts with dates about the people, places and events behind it (founders, dynasties, wars, treaties, trade routes, phylloxera and the like). Give each a Wikipedia link. Link an article directly only if you actually opened it; otherwise use a search link like https://en.wikipedia.org/wiki/Special:Search?search=Real+Companhia+Velha&go=Go so it never leads to a missing page.
- I enjoy the occasional curious aside: the geology and soils, the climate or the science behind the winemaking. Hold these to the same standard as everything else, with sources.

Finally, after all the wines, finish with a short ranking of them by what reviewers say, as a numbered list: one line per wine with its price and where it's sold (as in my list), then its best-supported score, naming the source and the vintage it applies to. If the same wine appears twice, say how the two listings differ (store, size or price). Put any wine without reviews at the end and say so.

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
- Finish with a short note on value for money at the prices above.

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
const PAGE_SIZE = 50;
const STORE = { shortlist: "wf.shortlist", aboutMe: "wf.aboutMe", myWines: "wf.myWines" };

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

// ---- Other stores ("Find it elsewhere") ------------------------------------------
// Search links only — nothing is fetched from these sites. {q} is replaced by the
// search words. Each link was tested on 2026-10-23 (see Design/CLAUDE.md §11).
const STORE_GROUPS = [
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
      <div><strong>${money(w.price)}</strong> at ${sourceBadge(w.source)}</div></div>
    <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "Add to Short List"}</button>
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
  const head = `<h3 class="ew-sub">On our store lists <span class="ew-note">(${esc(loadedSourceLabels())})</span></h3>`;
  if (!hits.length) {
    out.innerHTML = head + wait + `<p><strong>Not found on our lists.</strong> Try fewer words, or the store buttons below.</p>`;
    return;
  }
  const more = hits.length > HIT_LIMIT;
  out.innerHTML = head + wait +
    `<p>${hits.length === 1 ? "1 wine found" : `${hits.length} wines found`}${more ? `; here are the ${HIT_LIMIT} cheapest` : ""}.</p>
    <ul class="ew-hit-list">${hits.slice(0, HIT_LIMIT).map(hitRow).join("")}</ul>` +
    (more ? `<button type="button" class="btn btn-ew" data-action="hits-in-list">Show all ${hits.length} in the main list</button>` : "");
}, 250);

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
    sort: "price-asc",
    shown: PAGE_SIZE,
  };
}
let state = defaultState();

// ---- Filtering ---------------------------------------------------------------

const words = (s) => " " + fold(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";

function matches(w, skip, st = state) {
  if (!st.sources.has(w.source)) return false;
  if (skip !== "country" && st.countries.size && !st.countries.has(w.country)) return false;
  if (skip !== "type" && st.types.size && !st.types.has(w.type)) return false;
  if (st.priceFrom != null && w.price < st.priceFrom) return false;
  if (st.priceTo != null && w.price > st.priceTo) return false;
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

const SORTS = {
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
  country: (a, b) => a.country.localeCompare(b.country) || a.price - b.price,
  vintage: (a, b) => (b.vintage ?? -1) - (a.vintage ?? -1) || a.price - b.price,
  abv: (a, b) => (a.abv ?? 99) - (b.abv ?? 99) || a.price - b.price,
  sweet: (a, b) => (b.sweetness ?? -1) - (a.sweetness ?? -1) || a.price - b.price, // not rated last
};

function countBy(skip, key) {
  const counts = new Map();
  for (const w of WINES) if (matches(w, skip)) counts.set(w[key], (counts.get(w[key]) || 0) + 1);
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
    return;
  }
  $("source-legend").textContent = "Sold by";
  $("source-list").innerHTML = have.map((s) => checkbox("source", s, state.sources.has(s), sourceBadge(s), null)).join("") +
    (have.includes("ZYN") ? `<label class="check check-strong"><input type="checkbox" id="top-only"${state.topOnly ? " checked" : ""}>
       Only ZYN's “90+ point wines under $35”</label>
       <p class="hint">ZYN's own list of wines rated 90 or more, priced under $35.</p>` : "");
}

function renderCountries() {
  const counts = countBy("country", "country");
  const q = fold(state.countryQ);
  const all = WINES.filter((w) => state.sources.has(w.source)).map((w) => w.country);
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
  $("sort").value = state.sort;
}

function filtersOnCount() {
  return state.countries.size + state.types.size + state.sweet.size + (state.priceFrom != null) +
    (state.priceTo != null) + !!state.q + state.newOnly + state.topOnly + !state.bottleOnly + !state.notRated;
}

// ---- Rendering: results --------------------------------------------------------

function wineCard(w) {
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
    <p class="wine-detail">${detail} ${badges}</p>${scores}${calgary}
    <div class="wine-actions">
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "Add to Short List"}</button>
      <a class="btn ext btn-ct" href="${cellarTrackerUrl(w)}" target="_blank" rel="noopener">CellarTracker</a>
      <a class="btn ext btn-we" href="${wineEnthusiastUrl(w)}" target="_blank" rel="noopener">Wine Enthusiast</a>
      ${retailer}
      <button type="button" class="btn btn-ew" data-ew="${esc(w.id)}" aria-expanded="false">Find it elsewhere</button>
    </div>
  </article>`;
}

let lastResults = [];

function renderResults() {
  lastResults = WINES.filter((w) => matches(w)).sort(SORTS[state.sort]);
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
  if (state.sources.size > 1) parts.push([...state.sources].map(sourceLabel).map(esc).join(", "));
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
  for (const w of shortlist) n.set(w.country, (n.get(w.country) || 0) + 1);
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
  if (w.kind === "cellar" || w.price == null) return `from ${sourceLabel(w.source)}`;
  return `${money(w.price)} at ${sourceLabel(w.source)}`;
}

function wineLine(w, i) {
  const bits = [w.country !== "Country not stated" ? w.country : null, w.type !== "Other" ? w.type : null,
    sizeText(w), priceText(w)];
  let line = `${i + 1}. ${w.name} — ${bits.filter(Boolean).join(", ")}`;
  if (w.vintage) line += `, vintage ${w.vintage}`;
  if (w.retailer_scores) line += `; ${w.retailer_scores}`;
  if (w.my_score != null) line += `; ${w.owner} scored it ${w.my_score}`;
  if (w.ct_score != null) line += `; CellarTracker community score ${w.ct_score}`;
  return line;
}

function shortlistText() {
  return `Wine short list (${shortlist.length} ${shortlist.length === 1 ? "wine" : "wines"})\n\n` +
    shortlist.map(wineLine).join("\n") +
    "\n\nPrices exclude tax; availability not guaranteed.";
}

let claudeMode = "about"; // "about" (tell me about these) or "rank" (rank by reviews)

function claudePrompt(mode = claudeMode) {
  const about = String(storeGet(STORE.aboutMe, "") || "").trim();
  return (mode === "rank" ? RANK_TEMPLATE : PROMPT_TEMPLATE)
    .replace("{ABOUT_ME}", about)
    .replace("{WINES}", shortlist.map(wineLine).join("\n"))
    .replace(/[ \t]+\n/g, "\n");
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
      <div>${esc([w.country, w.type !== "Other" ? w.type : null, w.vintage, sizeText(w)].filter(Boolean).join(" · "))}</div>
      <div>${w.kind === "cellar" || w.price == null ? esc(priceText(w)) : `<strong>${money(w.price)}</strong> at ${esc(sourceLabel(w.source))}`}</div></div>
      <div class="sl-buttons">
        <button type="button" class="btn btn-ew" data-ew="${esc(w.id)}" aria-expanded="false">Find it elsewhere</button>
        <button type="button" class="btn" data-remove="${esc(w.id)}">Remove</button>
      </div>
    </div></li>`).join("");
  $("sl-email").href = "mailto:?subject=" + encodeURIComponent("Wine short list") +
    "&body=" + encodeURIComponent(shortlistText());
  renderPrintArea();
}

function renderPrintArea() {
  $("print-area").innerHTML = shortlist.length
    ? `<h1>Wine short list</h1><ol>${shortlist.map((w) => `<li><span class="pa-name">${esc(w.name)}</span><br>
        ${esc([w.country, w.type !== "Other" ? w.type : null, w.vintage, sizeText(w)].filter(Boolean).join(" · "))} — ${esc(priceText(w))}</li>`).join("")}</ol>
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
       <li>Check the question, then ${SEND}.</li>`
    : `<li>Claude opens in a new tab, and your question is copied.</li>
       <li>Your list is too long to type in automatically, so ${PASTE}.</li>`;
  const notice = $("ask-notice");
  notice.hidden = false;
  $("ask-claude").hidden = $("ask-claude-rank").hidden = true;
  const n = `${shortlist.length} ${shortlist.length === 1 ? "wine" : "wines"}`;
  notice.innerHTML = `<p class="big">${mode === "rank" ? `Asking Claude to rank your ${n} by reviews` : `Asking Claude about your ${n}`}</p>
    <p>Here's what happens when you press the button below:</p>
    <ol class="steps">${what}</ol>
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
const mwView = { q: "", owner: "all", sort: "name", shown: MW_PAGE };

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
  return [...Object.values(myWines.cellars).flatMap((c) => c.wines), ...myWines.manual];
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

async function importCellarFile(file) {
  const owner = $("mw-owner").value.trim();
  const box = $("mw-preview");
  box.hidden = false;
  if (!owner) {
    box.innerHTML = `<p><strong>Please type whose cellar this is first</strong> (for example Alex), then choose the file again.</p>`;
    $("mw-owner").focus();
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
  if (saveMyWines()) mwStatus(`Saved ${owner}'s cellar: ${wines.length} wines.`);
  mwView.owner = owner;
  renderMyWines();
}

function removeCellar(owner) {
  if (!window.confirm(`Remove ${owner}'s cellar (${myWines.cellars[owner].wines.length} wines) from this computer?`)) return;
  delete myWines.cellars[owner];
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
    w.ct_score != null ? `CellarTracker community <strong>${w.ct_score}</strong>` : null].filter(Boolean).join(" · ");
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
      <button type="button" class="btn btn-add" data-add="${esc(w.id)}" aria-pressed="${on}">${on ? "✓ On Short List (tap to remove)" : "Add to Short List"}</button>
      <button type="button" class="btn btn-ew" data-action="mw-where" data-id="${esc(w.id)}">Where can I buy it?</button>
      <a class="btn ext btn-ct" href="${cellarTrackerUrl(w)}" target="_blank" rel="noopener">CellarTracker</a>
      ${manualButtons}
    </div>
  </li>`;
}

function renderMyWines() {
  const all = allMyWines();
  const owners = Object.entries(myWines.cellars);
  const chip = (value, label, n) => `<button type="button" class="btn btn-mini" data-action="mw-owner" data-owner="${esc(value)}"
      aria-pressed="${mwView.owner === value}">${esc(label)} (${n})</button>`;
  $("mw-owners").innerHTML = all.length ? chip("all", "All", all.length) +
    owners.map(([o, c]) => chip(o, `${o}'s cellar`, c.wines.length)).join("") +
    (myWines.manual.length ? chip("manual", "Added by hand", myWines.manual.length) : "") +
    owners.map(([o, c]) => `<button type="button" class="btn btn-mini btn-danger" data-action="mw-remove" data-owner="${esc(o)}">Remove ${esc(o)}'s cellar</button>`).join("")
    : "";
  const words = fold(mwView.q).split(/\s+/).filter(Boolean);
  const list = all.filter((w) => {
    if (mwView.owner === "manual" && w.kind !== "manual") return false;
    if (mwView.owner !== "all" && mwView.owner !== "manual" && w.owner !== mwView.owner) return false;
    const s = fold([w.name, w.producer, w.region_or_grape, w.varietal, w.country, w.source].filter(Boolean).join(" "));
    return words.every((t) => s.includes(t));
  }).sort(MW_SORTS[mwView.sort]);
  $("mw-list-h").textContent = all.length ? `${list.length.toLocaleString()} ${list.length === 1 ? "wine" : "wines"}` : "No wines yet";
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
  const blob = new Blob([JSON.stringify({ app: "wine-finder", saved: new Date().toISOString(), myWines }, null, 1)],
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
    if (!window.confirm(`Replace My wines with the ${n} wines in this backup?`)) return;
    myWines = { cellars: mw.cellars, manual: mw.manual };
    saveMyWines();
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

// ---- Views -------------------------------------------------------------------

function showView(name) {
  $("view-find").hidden = name !== "find";
  $("view-shortlist").hidden = name !== "shortlist";
  $("view-mywines").hidden = name !== "mywines";
  for (const b of document.querySelectorAll(".view-btn")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
  if (name === "shortlist") renderShortlist();
  else if (name === "mywines") renderMyWines();
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
  renderResults(); // card buttons back to "Add to Short List"
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
    else if (t.dataset.view) showView(t.dataset.view);
    else if (t.dataset.add) {
      const id = t.dataset.add;
      toggleShortlist(id);
      const on = shortlist.some((s) => s.id === id);
      for (const b of document.querySelectorAll(".btn-add")) { // the same wine can show in two places
        if (b.dataset.add !== id) continue;
        b.setAttribute("aria-pressed", String(on));
        b.textContent = on ? "✓ On Short List (tap to remove)" : "Add to Short List";
        b.closest(".wine")?.classList.toggle("on-list", on);
      }
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
    else if (t.dataset.action === "mw-confirm") confirmImport();
    else if (t.dataset.action === "mw-cancel-import") { mwPending = null; $("mw-preview").hidden = true; $("mw-file").value = ""; }
    else if (t.dataset.action === "mw-owner") { mwView.owner = t.dataset.owner; mwView.shown = MW_PAGE; renderMyWines(); }
    else if (t.dataset.action === "mw-remove") removeCellar(t.dataset.owner);
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
    const all = WINES.filter((w) => state.sources.has(w.source)).map((w) => w.country);
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
    if (group) {
      const set = { source: state.sources, country: state.countries, type: state.types, sweet: state.sweet }[group];
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
  $("sort").addEventListener("change", () => { state.sort = $("sort").value; state.shown = PAGE_SIZE; renderResults(); });
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
  wireEvents();
  saveShortlist();
  try {
    const [wines, meta] = await Promise.all([
      fetch("data/wines.json", FRESH).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("data/meta.json", FRESH).then((r) => (r.ok ? r.json() : { sources: {} })).catch(() => ({ sources: {} })),
    ]);
    META = meta;
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
  setTimeout(() => loadAllSources().then(() => { updatePickCounts(); renderSources(); }), 800);
}

init();
