// Gems: wines in the stores, at a modest price, that fit what a cellar's owner already loves at a
// modest price. Loaded after cellar.js, in the same global scope (names here start gem/GEM/we).
//
// 1. The owner's value wines: scored 90.5 or more (their own score, else CellarTracker's), and, when
//    in their modest price bands (the shared cellars carry a band per wine, never the price paid).
// 2. From those: their producers, their grapes, and each grape's areas (Nahe, Southern Rhône…).
// 3. Store wines up to the price chosen, not already owned, in three kinds: more from a producer
//    they love; their grape from an area they love; their grape from somewhere new.
// 4. Ranked by quality: a family, CellarTracker or Claude score first, then the producer's Wine
//    Enthusiast reputation (data/producers-we.json, from scripts/build_winemag.py). That file has
//    no vintages, so it says what a producer's wines usually score, never what this bottle scores.
// Nothing here is saved or published: the pattern is worked out on the page, from the cellars on
// this computer.

const GEM_STOP = new Set(`wine wines vineyard vineyards estate estates winery wineries cellars cellar family famille domaine domaines
chateau chateaux bodega bodegas cantina cantine tenuta tenute weingut weinguter the and vins vin vino vini vinhos weine wein
casa quinta azienda agricola fattoria poderi podere mas clos company cie fils sons brothers freres group wineworks
de du la le les di del della des von van der den das`.split(/\s+/));
const gemTokens = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
const gemWords = (s) => gemTokens(s).filter((t) => t.length > 2 && !GEM_STOP.has(t));
// The telling words of a name, in order, in a label: only small or common words may sit between
// them ("Concha y Toro"), so "Haut-Médoc de Lagrange" is not "Château Haut Lagrange".
function gemInOrder(need, seq) {
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] !== need[0]) continue;
    let k = 1, j = i + 1;
    while (k < need.length && j < seq.length) {
      if (seq[j] === need[k]) { k++; j++; } else if (seq[j].length <= 2 || GEM_STOP.has(seq[j])) j++; else break;
    }
    if (k === need.length) return true;
  }
  return false;
}
const GEM_COUNTRY = { US: "USA", "United States": "USA" };
const gemCountry = (c) => (c && c !== "Country not stated" ? GEM_COUNTRY[c] || c : "");

// Wider areas, so a Swartland Chenin and a Stellenbosch one count as the same kind of find.
// Matched against the wine's name and region; the first that fits wins.
const GEM_AREAS = [
  ["Southern Rhône", /\b(chateauneuf|gigondas|vacqueyras|lirac|rasteau|cairanne|beaumes de venise|vinsobres|ventoux|vaucluse|cotes du rhone|tavel)\b/, "France"],
  ["Northern Rhône", /\b(cornas|crozes|hermitage|saint joseph|st joseph|cote rotie|condrieu|saint peray)\b/, "France"],
  ["Bordeaux", /\b(bordeaux|margaux|pauillac|saint julien|st julien|saint estephe|st estephe|pessac|graves|medoc|pomerol|saint emilion|st emilion|sauternes|barsac|cotes de bourg|fronsac|entre deux mers)\b/, "France"],
  ["Burgundy", /\b(bourgogne|burgundy|chablis|beaune|meursault|puligny|chassagne|volnay|pommard|nuits|gevrey|morey|chambolle|vosne|fixin|corton|santenay|saint aubin|macon|pouilly fuisse|pouilly vinzelles|marsannay|givry|mercurey|rully)\b/, "France"],
  ["Beaujolais", /\b(beaujolais|moulin a vent|morgon|fleurie|brouilly|julienas|chiroubles|regnie|saint amour)\b/, "France"],
  ["Loire", /\b(loire|vouvray|savennieres|saumur|chinon|bourgueil|sancerre|pouilly fume|muscadet|anjou|montlouis|touraine|quarts de chaume|coteaux du layon)\b/, "France"],
  ["Alsace", /\balsace\b/, "France"],
  ["Champagne", /\bchampagne\b/, "France"],
  ["Languedoc and Roussillon", /\b(languedoc|roussillon|corbieres|minervois|la clape|terrasses du larzac|pic saint loup|faugeres|saint chinian|herault|fitou|collioure|banyuls)\b/, "France"],
  ["Provence", /\b(provence|bandol|baux)\b/, "France"],
  ["Jura and Savoie", /\b(jura|arbois|savoie)\b/, "France"],
  // the regions, and the villages their labels often name instead
  ["German Riesling country", /\b(nahe|mosel|saar|ruwer|rheingau|rheinhessen|pfalz|franken|wurttemberg|baden|niederhauser|oberhauser|monzinger|schlossbockelheimer|norheimer|kreuznacher|wehlener|graacher|urziger|erdener|bernkasteler|piesporter|brauneberger|trittenheimer|zeltinger|scharzhofberger|ockfener|kaseler|rudesheimer|johannisberger|hattenheimer|erbacher|kiedricher|hochheimer|niersteiner|nackenheimer|westhofener|forster|deidesheimer|wachenheimer|ungsteiner)\b/, "Germany"],
  ["Austria", /\b(wachau|kamptal|kremstal|burgenland|wagram|steiermark)\b/, "Austria"],
  ["Piedmont", /\b(barolo|barbaresco|langhe|piemonte|piedmont|ghemme|gattinara|roero|asti|alba|gavi)\b/, "Italy"],
  ["Tuscany", /\b(toscana|tuscany|chianti|brunello|montalcino|montepulciano|bolgheri|maremma|sassicaia|carmignano)\b/, "Italy"],
  ["Veneto", /\b(valpolicella|amarone|soave|veneto|ripasso)\b/, "Italy"],
  ["Southern Italy and the islands", /\b(sicilia|sicily|etna|campania|puglia|aglianico|taurasi|basilicata|sardegna|sardinia|calabria)\b/, "Italy"],
  ["Spain's north", /\b(rioja|ribera|toro|navarra|bierzo|rias baixas|priorat|montsant|rueda)\b/, "Spain"],
  ["Portugal", /\b(douro|dao|alentejo|vinho verde|bairrada|porto|lisboa)\b/, "Portugal"],
  ["Valais and Swiss vineyards", /\b(valais|wallis|fully|vetroz|salgesch|sierre|leytron|martigny|visp|flanthey|geneve|satigny|dardagny|vaud|fechy|lavaux|malans|graubunden)\b/, "Switzerland"],
  ["South Africa's Cape", /\b(swartland|stellenbosch|franschhoek|paarl|citrusdal|hemel en aarde|walker bay|robertson|elgin|western cape|constantia|cederberg)\b/, "South Africa"],
  ["South Australia", /\b(barossa|mclaren vale|clare|eden valley|coonawarra|adelaide hills|langhorne)\b/, "Australia"],
  ["Western Australia", /\b(margaret river|frankland|great southern)\b/, "Australia"],
  ["New Zealand", /\b(marlborough|central otago|martinborough|hawke s bay|hawkes bay|kumeu|gisborne|nelson)\b/, "New Zealand"],
  ["California", /\b(napa|sonoma|paso robles|santa barbara|santa lucia|sta rita|stags leap|russian river|lodi|mendocino|santa cruz)\b/, "USA"],
  ["Washington and Oregon", /\b(columbia valley|walla walla|willamette|yakima|red mountain)\b/, "USA"],
  ["Okanagan", /\b(okanagan|similkameen|naramata|golden mile)\b/, "Canada"],
];
// A country whose wine nearly all comes from one area counts as that area when the label doesn't say.
const GEM_HOME = { "South Africa": "South Africa's Cape", "New Zealand": "New Zealand", Austria: "Austria", Portugal: "Portugal" };
const gemArea = (w) => { const t = " " + gemTokens([w.name, w.region_or_grape, w.region].filter(Boolean).join(" ")).join(" ") + " ", c = gemCountry(w.country);
  return GEM_AREAS.find(([, re, country]) => (!c || !country || c === country) && re.test(t))?.[0] || GEM_HOME[c] || (c ? `${c} (elsewhere)` : ""); };
const gemGrapes = (w) => grapesOf(w).filter((g) => !["Late-harvest white"].includes(g));
const gemScoreOf = (w) => w.my_score ?? w.ct_score ?? familyScore(w);
// "Tried it?" verdicts: this computer's own, and the family's (published without names).
const gemMine = (w) => ratingOf(w.id).mine || null;
const gemFam = (w) => { const f = frOf(w.id).family || ratedTwin(w)?.family; return f?.verdict ? f : null; };
// This computer's own marks count for a cellar when the name given here is the owner's
// ("Dave" or "David" for David's cellar).
const gemIsMe = (owner) => { const me = fold(myName()).slice(0, 3); return me.length === 3 && fold(owner).startsWith(me); };

// ---- Wine Enthusiast, by producer ----------------------------------------------------------
let weData = null, weIndex = null;
async function loadWe() {
  if (weData) return weData;
  try { weData = await fetch("data/producers-we.json", FRESH).then((r) => (r.ok ? r.json() : null)); } catch { weData = null; }
  weIndex = new Map();
  for (const p of weData?.producers || []) {
    const need = gemWords(p[0]);
    if (!need.length) continue;
    const key = need.reduce((a, b) => (b.length > a.length ? b : a));
    (weIndex.get(key) || weIndex.set(key, []).get(key)).push({ p, need });
  }
  return weData;
}
// The producer a wine is from, if the reviews know it: every telling word of the producer's name in
// the wine's name, and the same country. One short word alone isn't enough without a country.
function weOf(w) {
  if (!weIndex) return null;
  if ("_we" in w) return w._we;
  const seq = gemTokens(`${w.producer || ""} ${w.name || ""} ${w.region_or_grape || ""}`), toks = new Set(seq), c = gemCountry(w.country);
  let best = null;
  for (const t of toks) for (const x of weIndex.get(t) || []) {
    if (!x.need.every((n) => toks.has(n)) || !gemInOrder(x.need, seq)) continue;
    if (x.p[1] && c && x.p[1] !== c) continue;
    if ((!x.p[1] || !c) && x.need.length < 2) continue;
    if (!best || x.need.length > best.need.length) best = x;
  }
  try { Object.defineProperty(w, "_we", { value: best?.p || null, enumerable: false, configurable: true }); } catch { /* frozen */ }
  return best?.p || null;
}
// What wines at this price usually score in the reviews (prices there are US dollars).
function weExpected(cad) {
  const b = weData?.baseline || [], usd = cad * 0.73;
  if (!b.length) return 87;
  if (usd <= b[0][0]) return b[0][1];
  for (let i = 1; i < b.length; i++) if (usd <= b[i][0]) {
    const [p0, s0] = b[i - 1], [p1, s1] = b[i];
    return s0 + ((s1 - s0) * (Math.log(usd) - Math.log(p0))) / (Math.log(p1) - Math.log(p0));
  }
  return b.at(-1)[1];
}

// ---- A cellar's pattern ---------------------------------------------------------------------
function gemPattern(owner, leaveOut = null) {
  const wines = mcWinesOf(owner).filter((w) => w !== leaveOut && w.id !== leaveOut?.id);
  // Price bands, the same on every computer: the shared cellar's (a private copy looks its wines up
  // there by name). The modest bands are the cheapest ones holding no more than 60% of the cellar.
  const slot = slotFor(owner), shared = new Map((sharedCellars[slot]?.wines || []).filter((w) => w.pb).map((w) => [fold(w.name), w.pb]));
  const bandOfWine = (w) => w.pb ?? shared.get(fold(w.name)) ?? priceBand(w, shared);
  const banded = wines.map(bandOfWine).filter(Boolean);
  let k = 0;
  if (banded.length >= 20) for (let b = 1; b <= 5; b++) if (banded.filter((x) => x <= b).length <= 0.6 * banded.length) k = b;
  if (banded.length >= 20 && !k) k = 1;
  const cut = k ? (PRICE_BAND_TOPS[k - 1] ?? 150) : null; // Canadian dollars, the top of the modest bands
  let value = wines.filter((w) => (gemScoreOf(w) ?? 0) >= 90.5 && (!k || (bandOfWine(w) && bandOfWine(w) <= k)));
  if (value.length < 8) value = wines.filter((w) => (gemScoreOf(w) ?? 0) >= 90 && (!k || bandOfWine(w)));
  const priced = banded;
  // wines the owner marked 💎 on this computer count as value wines too, wherever they were bought
  if (gemIsMe(owner) && !leaveOut) for (const [id, r] of Object.entries(ratings)) {
    if (r.mine?.verdict !== "gem") continue;
    const w = findWine(id);
    if (w && !value.includes(w)) value.push(w);
  }
  // a label that names no area takes its producer's, from any cellar: "Dönnhoff Riesling" is from the Nahe
  const home = new Map();
  for (const w of cellarFindWines()) { const a = gemArea(w); if (w.producer && a && !/\(elsewhere\)$/.test(a)) home.set(fold(w.producer), a); }
  const areaOf = (w) => { const a = gemArea(w); return /\(elsewhere\)$/.test(a) && w.producer && home.has(fold(w.producer)) ? home.get(fold(w.producer)) : a; };
  const producers = new Map(), grapes = new Map(), pairs = new Map();
  for (const w of value) {
    if (w.producer && gemWords(w.producer).length) {
      const k = fold(w.producer); const x = producers.get(k) || { name: w.producer, country: gemCountry(w.country), need: gemWords(w.producer), n: 0, areas: new Set() };
      x.n++; x.areas.add(areaOf(w)); producers.set(k, x);
    }
    const area = areaOf(w);
    for (const g of gemGrapes(w)) {
      grapes.set(g, (grapes.get(g) || 0) + 1);
      if (area) { const k = `${g}|${area}`; pairs.set(k, (pairs.get(k) || 0) + 1); }
    }
  }
  const top = [...grapes].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { owner, value, cut, priced: priced.length, producers, grapes: new Map(top), pairs, types: new Set(value.map((w) => w.type)), areaOf };
}
// Producers two or more cellars both love at a modest price.
function gemFamilyProducers() {
  const seen = new Map();
  for (const [owner] of mcCellars()) for (const k of gemPattern(owner).producers.keys()) seen.set(k, (seen.get(k) || new Set()).add(owner));
  return new Map([...seen].filter(([, s]) => s.size > 1));
}
// The producer of a store wine, if it's one this pattern loves.
// A one-word name ("Chevalier") must also come from the same area, unless the label names no area.
function gemProducerHit(w, pattern) {
  const seq = gemTokens(`${w.producer || ""} ${w.name || ""}`), toks = new Set(seq), c = gemCountry(w.country), area = gemArea(w);
  for (const [k, p] of pattern.producers) {
    if (!p.need.every((n) => toks.has(n)) || !p.need.some((n) => n.length >= 5) || !gemInOrder(p.need, seq)) continue;
    if (p.country && c && p.country !== c) continue;
    if (p.need.length === 1 && p.areas.size && !p.areas.has(area) && !/\(elsewhere\)$/.test(area)) continue;
    return [k, p];
  }
  return null;
}

// ---- The picks --------------------------------------------------------------------------------
const GEM_PRICES = [25, 35, 50, 75, 100];
function gemDefaultPrice(pattern) {
  if (pattern.cut == null) return 35;
  return pattern.cut <= 40 ? 35 : pattern.cut <= 70 ? 50 : 75;
}
// The label the reviews name on this wine ("Secateurs"), if any.
function weLabel(w, we) {
  const toks = new Set(gemTokens(w.name)), gs = gemGrapes(w).map((g) => fold(g.split(/ \/| \(/)[0]));
  // the same label and the same grape: Secateurs Red Blend says nothing about Secateurs Chenin
  const sameGrape = (l) => !gs.length || gs.some((g) => fold(l[1]).includes(g));
  return we?.[6].find((l) => l[0] && gemWords(l[0]).length && gemWords(l[0]).every((t) => toks.has(t)) && sameGrape(l)) || null;
}
// How good for its price: the wine's own score, else its label's review, else the producer's average.
function gemQuality(w) {
  const s = familyScore(w), we = weOf(w), exp = weExpected(w.price), lab = weLabel(w, we);
  if (s != null) return { q: s - exp, how: "score", s, we, lab };
  if (lab) return { q: lab[4] - 0.5, how: "we", we, lab };
  if (we && we[5] != null) return { q: (we[5] * we[2]) / (we[2] + 2) - 0.5, how: "we", we, lab }; // one or two reviews count for less
  return { q: -2, how: "", we, lab };
}
function gemPicks(owner, maxPrice, extra = []) {
  const pattern = gemPattern(owner), fam = gemFamilyProducers();
  const owned = new Set(mcWinesOf(owner).map((w) => fold(w.name).replace(/\b(19|20)\d\d\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()));
  const pool = [...WINES, ...extra].filter((w) => w.available !== false && w.price >= 12 && w.price <= maxPrice &&
    (!w.size_ml || (w.size_ml >= 700 && w.size_ml <= 1000)) && pattern.types.has(w.type) && // a rosé only for someone who loves one
    !owned.has(fold(w.name).replace(/\b(19|20)\d\d\b/g, "").replace(/[^a-z0-9]+/g, " ").trim()) &&
    !(gemMine(w)?.verdict && gemIsMe(owner)) && !(gemFam(w)?.verdict === "gem")); // tried here, or already a family gem (shown above)
  const myAreas = new Map(); for (const k of pattern.pairs.keys()) { const [g, a] = k.split("|"); (myAreas.get(g) || myAreas.set(g, new Set()).get(g)).add(a); }
  const kinds = { producer: [], area: [], new: [], unscored: [] };
  for (const w of pool) {
    const hit = gemProducerHit(w, pattern), area = gemArea(w);
    const g = gemGrapes(w).find((x) => pattern.grapes.has(x));
    const qual = gemQuality(w);
    if (gemFam(w)?.verdict === "no") qual.q -= 1.5; // a family member found it wasn't for them
    const famHit = hit && fam.has(hit[0]);
    const base = { w, area, g, ...qual, fam: famHit };
    if (hit) kinds.producer.push({ ...base, prod: hit[1], rank: qual.q + 2 + Math.min(3, hit[1].n) * 0.5 + (famHit ? 2 : 0) });
    else if (g && area && myAreas.get(g)?.has(area)) kinds.area.push({ ...base, pair: pattern.pairs.get(`${g}|${area}`), rank: qual.q + 0.5 * Math.log2(1 + pattern.pairs.get(`${g}|${area}`)) });
    else if (g && qual.how) kinds.new.push({ ...base, rank: qual.q + Math.log2(1 + pattern.grapes.get(g)) * 0.5 });
    else if (g) kinds.unscored.push({ ...base, rank: -5 }); // their grape, but nothing known about it yet
  }
  // Best first, and variety: one wine per producer, and no more than one per grape and area in a kind.
  const usedProd = new Set(), pick = (list, key, n) => {
    const out = [], usedKey = new Set();
    for (const x of list.sort((a, b) => b.rank - a.rank)) {
      const p = x.we?.[0] || x.prod?.name || x.w.producer || x.w.name.split(/\s+-\s+|\s/)[0];
      const k = key(x);
      if (usedProd.has(fold(p)) || (k && usedKey.has(k))) continue;
      usedProd.add(fold(p)); if (k) usedKey.add(k);
      out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };
  // the family's 💎 wines in the stores, within the price, best scored first
  const famGems = WINES.filter((w) => w.available !== false && w.price <= maxPrice && (gemFam(w)?.verdict === "gem" || (gemMine(w)?.verdict === "gem")))
    .map((w) => ({ w, area: gemArea(w), ...gemQuality(w), famV: gemFam(w), mineV: gemMine(w) }))
    .sort((a, b) => b.q - a.q).slice(0, 8);
  const shortlist = { producer: pick(kinds.producer, (x) => fold(x.prod.name), 5),
    area: pick(kinds.area, (x) => `${x.g}|${x.area}`, 5), new: pick(kinds.new, (x) => `${x.g}|${x.area}`, 5) };
  // every match, for the table: each wine once, with the kind it came under
  const all = [...kinds.producer.map((x) => ({ ...x, kind: "producer" })), ...kinds.area.map((x) => ({ ...x, kind: "area" })),
    ...kinds.new.map((x) => ({ ...x, kind: "new" })), ...kinds.unscored.map((x) => ({ ...x, kind: "unscored" }))];
  return { pattern, maxPrice, famGems, all, ...shortlist };
}

// ---- On the page --------------------------------------------------------------------------------
let gemUnscored = []; // the picks on screen without a score, for "Get quick scores for these"
document.addEventListener("click", (e) => {
  if (!e.target.closest?.("#mc-panel [data-gem-score]")) return;
  for (const id of gemUnscored) quickMarks.add(id); // the usual marked quick scores, a batch of 25 at a time
  saveQuickMarks();
  openScoreDialog(true);
});
const gemMoney = (w) => (w.price_local && w.currency ? `${w.currency} ${Number(w.price_local).toFixed(2)} (about ${money(w.price)})` : money(w.price));
function gemEvidence(x) {
  const bits = [];
  if (x.how === "score") bits.push(`Scored <strong>${Math.round(x.s)}</strong>, where wines at this price usually get about ${Math.round(weExpected(x.w.price))} in Wine Enthusiast's reviews.`);
  if (x.we) {
    const lab = x.lab || x.we[6][0];
    bits.push(`Wine Enthusiast: ${esc(/s$/i.test(x.we[0]) ? `${x.we[0]}'` : `${x.we[0]}'s`)} wines average <strong>${x.we[3]}</strong> over ${x.we[2]} ${x.we[2] === 1 ? "review" : "reviews"}${x.we[5] != null ? `, ${x.we[5] >= 0 ? `${x.we[5]} points above` : `${-x.we[5]} points below`} what their prices usually score` : ""}.` +
      (lab ? ` Their ${esc(lab[0] || lab[1])}${lab[0] && lab[1] ? ` (${esc(lab[1])})` : ""} scored ${lab[2]} at US$${lab[3]}.` : "") +
      ` <span class="hint-inline">(older reviews, no vintages: the producer's reputation, not this bottle's score)</span>`);
  }
  if (!bits.length) bits.push(`<span class="hint-inline">No score yet for this wine or its producer.</span>`);
  return bits.join(" ");
}
const gemTag = (x) => ((x.how === "score" && x.q >= 3) || (x.how === "we" && x.we[5] >= 2 && x.we[2] >= 3) ? `<span class="gem-tag">💎 Gem</span> ` : "");
// What the family (and this computer) said after tasting it.
function gemSaid(w) {
  const f = gemFam(w), m = gemMine(w);
  const line = (who, r) => `<p class="gem-said">${who}: <strong>${verdictWords(r.verdict)}</strong>${r.points ? ` · ${r.points}` : ""}${r.note ? ` · “${esc(r.note)}”` : ""}</p>`;
  return (f ? line("A family member", f) : "") + (m?.verdict && JSON.stringify(m) !== JSON.stringify(f) ? line("You", m) : "");
}
function gemCard(x, why) {
  return `<li class="gem-pick">${gemTag(x)}${x.fam ? `<span class="gem-tag gem-fam">👪 Family favourite</span> ` : ""}<button type="button" class="linklike gem-name" data-somm-pop="${esc(x.w.id)}">${esc(x.w.name)}</button>
    <span class="gem-where">${esc(sourceLabel(x.w.source))} · ${gemMoney(x.w)}</span>
    <p class="gem-why">${why}</p>${gemSaid(x.w)}<p class="gem-ev">${gemEvidence(x)}</p>
    <p class="gem-actions">${rateButton(x.w, "Tried it?")} ${familyScore(x.w) == null ? quickMarkButton(x.w) : ""}</p></li>`;
}
function gemsHtml(owner, title) {
  if (!weData) return `<p class="empty">Opening the reviews…</p>`;
  const pattern0 = gemPattern(owner), price = mc.gemPrice || gemDefaultPrice(pattern0);
  const r = gemPicks(owner, price), p = r.pattern, who = owner;
  const n = p.value.length;
  const grapes = [...p.grapes].map(([g, k]) => `${esc(g)} (${k})`).join(", ");
  const topPairs = [...p.pairs].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, c]) => { const [g, a] = k.split("|"); return `${esc(g)} from ${esc(a)} (${c})`; }).join(", ");
  const prods = [...p.producers.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => `${esc(x.name)} (${x.n})`).join(", ");
  const head = `<div class="somm-card gem-pattern"><h3 class="somm-wine-h">💎 Gems for ${esc(who)}</h3>
    <p>Wines in the stores that fit what ${esc(who)} already loves${p.cut != null ? " at a modest price" : ""}, and that aren't in ${esc(title)}.</p>
    <p><strong>What ${esc(who)} loves${p.cut != null ? " at a modest price" : ""}</strong> (${n} ${n === 1 ? "wine" : "wines"} scored about 91 or more${p.cut != null ? `, in ${esc(who)}'s modest price bands, up to about $${p.cut}` : ""}):</p>
    <ul class="gem-pat">${grapes ? `<li><strong>Grapes:</strong> ${grapes}</li>` : ""}${topPairs ? `<li><strong>From:</strong> ${topPairs}</li>` : ""}${prods ? `<li><strong>Producers:</strong> ${prods}</li>` : ""}</ul>
    ${p.cut == null ? `<p class="hint">This cellar has no price bands yet, so the pattern uses the best-scored wines at any price.</p>` : ""}
    <div class="somm-row"><label>Up to <select data-gem-price aria-label="Highest price">${GEM_PRICES.map((v) => `<option value="${v}"${v === price ? " selected" : ""}>$${v}</option>`).join("")}</select> a bottle</label>
      <span class="hint-inline">Searched: ${esc(knownSources().map(sourceLabel).join(", "))}${knownSources().includes("LCBO") ? "" : ". The LCBO joins once its list is opened on this computer (Find wines, step 1)"}. Swiss prices are shown in francs, with dollars.</span></div>
    <p class="hint">Tried one? Press <strong>Tried it?</strong> and choose 💎 A gem, 👍 Fine or 👎 Not for me. It's shared with the family without your name, and 💎 wines come first for everyone.</p>
    <p class="hint">💎 Gem: scored well above what its price usually gets, or from a producer whose wines do. 👪 Family favourite: a producer two of the cellars love at a modest price. Scores come first from the family, CellarTracker and Claude's quick scores (Claude's judgement), then Wine Enthusiast's reviews of the producer.</p></div>`;
  const unscored = [...r.producer, ...r.area, ...r.new].filter((x) => familyScore(x.w) == null && x.w.kind !== "typed");
  gemUnscored = unscored.map((x) => x.w.id);
  const scoreAll = unscored.length ? `<div class="somm-card gem-score"><p><strong>${unscored.length} of these picks have no score of their own yet.</strong> A Claude quick score (Claude's judgement, from published reviews) ranks them better, and is shared with the family so nobody asks twice.</p>
    <p><button type="button" class="btn btn-gem" data-gem-score>⭐ Get quick scores for these ${unscored.length} ${unscored.length === 1 ? "wine" : "wines"}</button> <span class="hint-inline">or mark single wines below with ＋ Add Claude Quick Score.</span></p></div>` : "";
  const kind = (h, list, why, empty) => `<div class="somm-card"><h3 class="somm-wine-h">${h}</h3>${list.length ? `<ul class="gem-list">${list.map((x) => gemCard(x, why(x))).join("")}</ul>` : `<p class="hint">${empty}</p>`}</div>`;
  const famCard = r.famGems.length ? `<div class="somm-card gem-family"><h3 class="somm-wine-h">💎 Family gems</h3>
    <p class="hint">Wines someone in the family tried and marked 💎, in the stores up to $${price}. They come first, whatever ${esc(who)}'s pattern says.</p>
    <ul class="gem-list">${r.famGems.map((x) => gemCard(x, `Tried and marked a gem${x.famV ? " by a family member" : " on this computer"}.`)).join("")}</ul></div>` : "";
  return head + famCard + scoreAll +
    kind("More from a producer you love", r.producer, (x) => `${esc(who)} owns ${x.prod.n} ${x.prod.n === 1 ? "wine" : "wines"} from ${esc(x.prod.name)} scored about 91 or more${pattern0.cut != null ? " at a modest price" : ""}.`, `No other wine from ${esc(who)}'s favourite producers is in the stores up to $${price}.`) +
    kind("Your grape, from an area you love", r.area, (x) => `${esc(who)} owns ${x.pair} ${esc(x.g)} ${x.pair === 1 ? "wine" : "wines"} from ${esc(x.area)} scored about 91 or more${pattern0.cut != null ? " at a modest price" : ""}.`, `Nothing new from those areas up to $${price}.`) +
    kind("Your grape, from somewhere new", r.new, (x) => `${esc(x.g)} is one of ${esc(who)}'s value grapes (${p.grapes.get(x.g)} wines); this one is from ${esc(x.area || x.w.country || "elsewhere")}.`, `Nothing scored yet up to $${price}.`) +
    gemAllHtml(r) + `<p class="hint">These are suggestions to taste, not scores for these bottles.</p>`;
}

// ---- Every gem and match, in a table to sort and narrow ----------------------------------------
const gemAll = { only: true, kind: "", colour: "", country: "", grape: "", store: "", col: "rank", dir: -1, shown: 50 };
const GEM_KINDS = { producer: "Producer you love", area: "Your grape, an area you love", new: "Your grape, somewhere new", unscored: "Your grape, no score yet" };
const gemRowScore = (x) => (x.how === "score" ? Math.round(x.s) : null);
const gemSort = {
  rank: (x) => x.rank, name: (x) => fold(x.w.name), store: (x) => sourceLabel(x.w.source), price: (x) => x.w.price,
  score: (x) => gemRowScore(x) ?? (x.we ? x.we[3] - 100 : -999), type: (x) => x.w.type || "", country: (x) => x.w.country || "",
  grape: (x) => x.g || "", kind: (x) => Object.keys(GEM_KINDS).indexOf(x.kind), gem: (x) => (gemTag(x) ? 1 : 0),
};
function gemAllHtml(r) {
  if (gemAll.owner !== r.pattern.owner) Object.assign(gemAll, { owner: r.pattern.owner, kind: "", colour: "", country: "", grape: "", store: "", shown: 50 }); // another cellar: start afresh
  const base = r.all.filter((x) => !gemAll.only || gemTag(x));
  const rows = base.filter((x) => (!gemAll.kind || x.kind === gemAll.kind) && (!gemAll.colour || x.w.type === gemAll.colour) &&
    (!gemAll.country || x.w.country === gemAll.country) && (!gemAll.grape || x.g === gemAll.grape) && (!gemAll.store || x.w.source === gemAll.store));
  const key = gemSort[gemAll.col] || gemSort.rank, dir = gemAll.dir;
  rows.sort((a, b) => { const ka = key(a), kb = key(b); return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir || b.rank - a.rank; });
  const opts = (k, label, get, words = (v) => v) => { const vals = [...new Set(base.map(get).filter(Boolean))].sort((a, b) => String(words(a)).localeCompare(String(words(b))));
    return `<select data-gall="${k}" aria-label="${esc(label)}"><option value="">Any ${esc(label.toLowerCase())}</option>${vals.map((v) => `<option value="${esc(v)}"${String(v) === String(gemAll[k]) ? " selected" : ""}>${esc(words(v))}</option>`).join("")}</select>`; };
  const cols = [["gem", "💎"], ["name", "Wine"], ["store", "Store"], ["price", "Price"], ["score", "Score"], ["type", "Colour"], ["country", "Country"], ["grape", "Grape"], ["kind", "Why"]];
  const head = cols.map(([k, l]) => `<th scope="col"><button type="button" class="linklike" data-gall-col="${k}" aria-pressed="${gemAll.col === k}">${l}${gemAll.col === k ? (dir > 0 ? " ▲" : " ▼") : ""}</button></th>`).join("");
  const cell = (k, x) => {
    switch (k) {
      case "gem": return gemTag(x) ? "💎" : "";
      case "name": return `<button type="button" class="linklike" data-somm-pop="${esc(x.w.id)}">${esc(x.w.name)}</button>${gemFam(x.w) ? ` <span class="hint-inline">${esc(verdictWords(gemFam(x.w).verdict))} (family)</span>` : ""}`;
      case "store": return esc(sourceLabel(x.w.source));
      case "price": return gemMoney(x.w);
      case "score": return gemRowScore(x) != null ? `<strong>${gemRowScore(x)}</strong>` : x.we ? `<span class="hint-inline">producer avg ${x.we[3]} (WE)</span>` : "";
      case "type": return esc(x.w.type || "");
      case "country": return esc(x.w.country || "");
      case "grape": return esc(x.g || "");
      default: return esc(GEM_KINDS[x.kind] || "");
    }
  };
  const shown = rows.slice(0, gemAll.shown);
  return `<div class="somm-card gem-all"><h3 class="somm-wine-h">Every ${gemAll.only ? "gem" : "match"} up to $${r.maxPrice}</h3>
    <p class="hint">The lists above show the best few of each kind. Here is every one, to sort by clicking a heading or narrow with the menus. Sorted best first to start.</p>
    <div class="somm-row somm-narrow">
      <span class="gem-switch" role="radiogroup" aria-label="Which wines"><label><input type="radio" name="gall-only" value="1"${gemAll.only ? " checked" : ""} data-gall-only> 💎 Gems only (${r.all.filter((x) => gemTag(x)).length})</label>
        <label><input type="radio" name="gall-only" value="0"${gemAll.only ? "" : " checked"} data-gall-only> All matches (${r.all.length})</label></span>
      ${opts("kind", "Kind", (x) => x.kind, (v) => GEM_KINDS[v])}${opts("colour", "Colour", (x) => x.w.type)}${opts("country", "Country", (x) => x.w.country)}
      ${opts("grape", "Grape", (x) => x.g)}${opts("store", "Store", (x) => x.w.source, sourceLabel)}
      ${gemAll.kind || gemAll.colour || gemAll.country || gemAll.grape || gemAll.store ? `<button type="button" class="btn btn-mini" data-gall-clear>Show all again</button>` : ""}</div>
    <p class="somm-sel-count">${rows.length.toLocaleString()} ${rows.length === 1 ? "wine" : "wines"}</p>
    ${rows.length ? `<div class="somm-table-wrap"><table class="somm-table gem-table"><thead><tr>${head}</tr></thead>
      <tbody>${shown.map((x) => `<tr>${cols.map(([k]) => `<td>${cell(k, x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="empty">Nothing matches these choices.</p>`}
    ${rows.length > shown.length ? `<p><button type="button" class="btn" data-gall-more>Show ${Math.min(50, rows.length - shown.length)} more (${(rows.length - shown.length).toLocaleString()} left)</button></p>` : ""}
    <p class="hint">Score: the family's, CellarTracker's or a Claude quick score for this wine; otherwise the producer's average in Wine Enthusiast's older reviews (WE), which is a reputation, not this bottle's score.</p></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("#mc-panel [data-gall-col], #mc-panel [data-gall-more], #mc-panel [data-gall-clear]");
  if (!t) return;
  if (t.dataset.gallCol) { const k = t.dataset.gallCol; gemAll.dir = gemAll.col === k ? -gemAll.dir : ["name", "store", "type", "country", "grape", "kind"].includes(k) ? 1 : -1; gemAll.col = k; }
  else if ("gallMore" in t.dataset) gemAll.shown += 50;
  else Object.assign(gemAll, { kind: "", colour: "", country: "", grape: "", store: "", shown: 50 });
  const y = window.scrollY; renderCellarPanel(); window.scrollTo(0, y);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches?.("#mc-panel [data-gall-only]")) gemAll.only = t.value === "1";
  else if (t.matches?.("#mc-panel [data-gall]")) gemAll[t.dataset.gall] = t.value;
  else return;
  gemAll.shown = 50;
  const y = window.scrollY; renderCellarPanel(); window.scrollTo(0, y);
});

// The fair test: hide each value wine in turn and see whether the pattern still points to it,
// by its producer or by its grape and area. Run from the console: gemFairTest("David").
function gemFairTest(owner) {
  const full = gemPattern(owner); let byProducer = 0, byPair = 0, either = 0;
  for (const v of full.value) {
    const p = gemPattern(owner, v), area = full.areaOf(v);
    const prod = v.producer && p.producers.has(fold(v.producer));
    const pair = gemGrapes(v).some((g) => p.grapes.has(g) && p.pairs.has(`${g}|${area}`));
    byProducer += !!prod; byPair += !!pair; either += !!(prod || pair);
  }
  return { owner, valueWines: full.value.length, byProducer, byGrapeAndArea: byPair, either };
}
