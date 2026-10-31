"use strict";
// ---- Master Sommelier (its own page, the Sommelier button at the top) -------------------------------------------
// Wine and food matched from the pairing books, three ways in: "I have the wine" (typed, from
// the Comparison List, or every wine of a country), "I'm cooking…" (a food, then real bottles
// from the stores) and "Build me a menu" (a country's wines across the courses). Everything is
// worked out here from data/somm.json (notes taken from the books, in our own words, with
// book and page), data/recipes.json (each recipe's ingredients as the book prints them, and a
// method written in our own words) and the Dornenburg & Page tables in app.js. Claude is
// asked only by the "Get a recipe" and "Ask Claude to polish this menu" buttons.
// Loaded after app.js: it uses its helpers (WINES, grapesOf, wineTier, foodsOf, shopping…).

let SOMM = null, RECIPES = {};
const SOMM_EMPTY = { books: {}, grapes: {}, recipes: [], regions: {}, cheese: [], dessert: [], dishes: [], menus: [], bridges: {}, principles: [] };
const SOMM_VER = document.querySelector('script[src^="somm.js"]')?.src.split("v=")[1] || "";
function loadSomm() {
  if (SOMM) return Promise.resolve(SOMM);
  const get = (f, empty) => fetch(`data/${f}?v=${SOMM_VER}`, FRESH).then((r) => (r.ok ? r.json() : empty)).catch(() => empty);
  return (loadSomm.p ||= Promise.all([get("somm.json", SOMM_EMPTY), get("recipes.json", {})])
    .then(([d, r]) => { RECIPES = r || {}; return (SOMM = { ...SOMM_EMPTY, ...d }); }));
}
const bookName = (id) => SOMM?.books?.[id]?.short || id;
const ref = (b, p) => `${bookName(b)}${p ? `, p. ${p}` : ""}`;
const srcSpan = (b, p) => ` <span class="somm-src">(${esc(ref(b, p))})</span>`;
const COURSES = { starter: "Starter", main: "Main course", side: "Side", cheese: "Cheese course", dessert: "Dessert" };
const COURSE_FOODS = { starter: ["Seafood", "Fish", "Chicken", "Pasta and pizza"], cheese: ["Cheese"], dessert: ["Dessert"] };

// The names the books use for a wine: its grapes (those that fit its colour), and its style
// where that's what the books go by (sparkling, rosé, Port, sherry, a sweet white).
function sommKeys(w) {
  const t = fold([w.name, w.grape, w.region, w.region_or_grape, w.varietal].filter(Boolean).join(" "));
  const keys = grapesOf(w).filter((g) => !w.type || grapeFits(w, g) || !["Red", "White"].includes(w.type));
  // Douro and Dão dry reds are built on Touriga Nacional (Daring Pairings, p. 292)
  if (!keys.length && w.type === "Red" && /\b(douro|dao)\b/.test(t)) keys.push("Touriga Nacional");
  if (w.type === "Sparkling" || /\b(champagne|cava|cremant|prosecco|sparkling|franciacorta|sekt)\b/.test(t)) keys.push(...(/\bchampagne\b/.test(t) ? ["Champagne", "Sparkling"] : ["Sparkling"]));
  if (w.type === "Rosé" || /\brose\b|\brosado\b|\brosato\b/.test(t)) keys.push("Rosé");
  if (/\b(port|porto)\b/.test(t) || (w.type === "Fortified" && /\b(tawny|ruby|lbv|late bottled)\b/.test(t))) keys.push("Port");
  if (/\bmadeira\b/.test(t)) keys.push("Madeira");
  if (/\b(sherry|jerez|fino|manzanilla|amontillado|oloroso)\b/.test(t)) keys.push(/\b(oloroso|cream)\b/.test(t) ? "Sherry (oloroso)" : "Sherry (fino)");
  if (/\bsauternes|barsac\b/.test(t)) keys.push("Sauternes");
  if (/\btokaj/.test(t)) keys.push("Tokaji");
  if (/\bice ?wine|icewine|eiswein\b/.test(t)) keys.push("Ice wine");
  if (w.type === "Dessert" || (w.type === "White" && ["sweet", "medium-sweet"].includes(sweetV(w)))) keys.push("Late-harvest white");
  return [...new Set(keys)];
}
const sweetV = (w) => { try { return wineStyle(w).sweet.v; } catch { return null; } };
const inBooks = (k) => !!(SOMM?.grapes?.[k] || BOOK_TIER[k]);
const knownKey = (k) => inBooks(k) || GRAPE_FOOD[k] || COUSINS[k];
// a real dessert wine (not just an off-dry rosé): for a dessert course away from the country chosen
const realDessert = (w) => w.type === "Dessert" || (w.type === "Fortified" && sweetV(w) !== "dry") || sweetV(w) === "sweet" ||
  sommKeys(w).some((k) => ["Port", "Tokaji", "Ice wine", "Sauternes", "Madeira", "Sherry (oloroso)"].includes(k));
const isSweetWine = (w) => w.type === "Dessert" || ["sweet", "medium-sweet"].includes(sweetV(w)) ||
  (w.type === "Fortified" && sweetV(w) !== "dry");

// Grapes none of the books covers, each matched to covered grapes of the same style. This is
// Claude's judgement, not the books', and the cards say so: the books' dishes for those grapes
// are offered in their place.
const COUSINS = {
  "Saperavi": ["Xinomavro", "Touriga Nacional", "Tannat", "Aglianico"],
  "Fetească Neagră": ["Merlot", "Malbec"],
  "Rară Neagră": ["Pinot Noir", "Gamay"],
  "Baga": ["Nebbiolo", "Xinomavro"],
  "Agiorgitiko": ["Merlot", "Sangiovese"],
  "Petit Verdot": ["Cabernet Sauvignon", "Petite Sirah"],
  "Zweigelt": ["Gamay", "Pinot Noir"],
  "Rkatsiteli": ["Assyrtiko", "Grüner Veltliner", "Sauvignon Blanc"],
  "Mtsvane": ["Viognier", "Albariño"],
  "Kisi": ["Viognier", "Marsanne / Roussanne"],
  "Fetească Albă / Regală": ["Riesling", "Pinot Grigio / Gris"],
  "Furmint": ["Riesling", "Assyrtiko"],
  "Fiano": ["Viognier", "Chardonnay"],
  "Godello": ["Chardonnay", "Albariño"],
  "Chasselas": ["Pinot Blanc"],
  "Cortese (Gavi)": ["Vermentino", "Pinot Blanc"],
};
const COUSIN_STYLE = {
  "Saperavi": "dark, high in acid and firmly tannic", "Fetească Neagră": "plummy, spicy and medium- to full-bodied",
  "Rară Neagră": "light, with red fruit and soft tannins", "Baga": "high in acid and tannin", "Agiorgitiko": "plummy and soft",
  "Petit Verdot": "dark and tannic", "Zweigelt": "light and cherry-fruited", "Rkatsiteli": "crisp, high in acid, apple and quince",
  "Mtsvane": "fresh and aromatic, stone fruit", "Kisi": "rich, apricot and spice, often made as an amber wine",
  "Fetească Albă / Regală": "floral, fresh and aromatic", "Furmint": "high in acid, apple and smoke", "Fiano": "rich, nutty and waxy",
  "Godello": "rich but fresh, mineral", "Chasselas": "light, soft and delicate", "Cortese (Gavi)": "light, crisp and citrusy",
};
// The same grapes made semi-sweet (Kindzmarauli, Khvanchkara): the dry stand-ins' advice (steak,
// tannin) would be wrong, so these go by the books' sweet red, Port, instead.
const SWEET_COUSINS = { "Saperavi": ["Port"] };
const SWEET_COUSIN_STYLE = { "Saperavi": "here made semi-sweet, as Kindzmarauli or Khvanchkara: dark berries, soft tannin and a little sugar" };
const cousinsOf = (g, sweet) => (sweet && SWEET_COUSINS[g]) || COUSINS[g];
const borrowedOf = (keys) => keys.filter((g) => !inBooks(g) && COUSINS[g]);
// the books' names for a wine, with stand-ins for the grapes the books don't cover (sweet
// stand-ins for a sweet wine; a bare list of grapes counts as dry)
function bookKeys(w, sweet = null) {
  const k = Array.isArray(w) ? w : sommKeys(w);
  const sw = sweet ?? (Array.isArray(w) ? false : isSweetWine(w));
  return [...new Set([...k, ...borrowedOf(k).flatMap((g) => cousinsOf(g, sw))])].filter(inBooks);
}
const borrowedNote = (keys, sweet = false) => borrowedOf(keys).map((g) => `<p class="somm-note">None of the books covers <strong>${esc(g)}</strong> (${esc((sweet && SWEET_COUSIN_STYLE[g]) || COUSIN_STYLE[g] || "")}). ` +
  `What follows comes from ${cousinsOf(g, sweet).length === 1 ? "the nearest style the books do cover" : "grapes of the same style"}: <strong>${esc(cousinsOf(g, sweet).join(", "))}</strong>. That likeness is Claude's judgement, not the books'.</p>`).join("");

// The local food of countries the books leave out, from Claude's own knowledge (marked so).
// Each row: the grapes or style it suits, a label, and the dishes.
const MOLDOVA = {
  intro: "Moldovan and Romanian cooking share a table: pork, polenta (mămăligă), salty sheep's cheese, cabbage rolls and plenty of fruit.",
  rows: [
    { keys: ["Fetească Neagră"], label: "Fetească Neagră (plummy, spicy red)", main: "Red meat",
      dishes: "tochitură (pan-fried pork in a garlicky sauce, served with mămăligă and a fried egg), grilled mititei (little garlicky minced-meat rolls), roast duck with plums" },
    { keys: ["Rară Neagră"], label: "Rară Neagră (light red)", main: "Pork",
      dishes: "sarmale (cabbage or vine-leaf rolls filled with pork and rice), chicken stew with mămăligă, mushroom dishes" },
    { keys: ["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Malbec"], label: "Cabernet, Merlot and other reds", main: "Lamb",
      dishes: "grilled lamb or pork, beef stew with mămăligă, stuffed peppers" },
    { keys: ["Fetească Albă / Regală", "Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio / Gris", "Muscat / Moscato"], label: "white wines", main: "Fish",
      dishes: "zeamă (sour chicken soup with noodles and lovage), river fish such as carp or trout, plăcinte (pastries filled with cheese or cabbage)" },
  ],
  cheese: "brânză (salty sheep's cheese) and cheese plăcinte, with a Fetească Neagră or a Merlot",
  dessert: "cozonac (sweet walnut bread), alivancă (corn-and-cheese cake), plum or cherry desserts, with a sweet wine or a Moldovan sparkling",
};
const LOCAL_NOTES = {
  Georgia: {
    intro: "Georgia has made wine for 8,000 years, much of it in clay qvevri buried in the ground. Its food is built on walnuts, pomegranate, fresh herbs, garlic and grilled meat.",
    rows: [
      { keys: ["Saperavi"], dry: true, label: "Saperavi (dry red)", main: "Red meat",
        dishes: "mtsvadi (pork or lamb skewers grilled over vine cuttings, with raw onion and pomegranate), kharcho (beef stew with walnuts and sour plum), ostri (spicy beef and tomato stew), lobio (bean stew with coriander)" },
      { keys: ["Saperavi"], sweet: true, label: "semi-sweet reds (Kindzmarauli, Khvanchkara)", main: "Spicy food",
        dishes: "churchkhela (walnuts dipped in thickened grape juice), fresh fruit, dark chocolate, spicy dishes, salty sulguni cheese" },
      { keys: ["Rkatsiteli", "Mtsvane"], label: "Rkatsiteli and Mtsvane (crisp whites, Tsinandali)", main: "Lamb",
        dishes: "chakapuli (lamb braised with tarragon, sour plums and white wine), trout with tkemali (sour plum) sauce, badrijani nigvzit (eggplant rolls with walnut-garlic paste), pkhali (spinach or beet and walnut pâtés)" },
      { keys: ["Kisi"], amber: true, label: "amber (qvevri) wines such as Kisi", main: "Chicken",
        dishes: "satsivi (chicken or turkey in a walnut-garlic sauce), roast pork, mushrooms baked with sulguni cheese (sokos ketsi), khachapuri (cheese bread)" },
    ],
    cheese: "sulguni (stretchy and salty), imeruli (fresh and mild) and khachapuri (cheese bread), with a dry Saperavi or an amber wine",
    dessert: "churchkhela, pelamushi (grape-must pudding) and gozinaki (honey-walnut brittle), with a semi-sweet red such as Kindzmarauli or Khvanchkara",
  },
  Moldova: MOLDOVA,
  Romania: MOLDOVA,
};
const CLAUDE_TAG = `<span class="somm-claude">Claude's notes, not from the books</span>`;
const isAmber = (w) => /\b(amber|qvevri|kvevri|orange wine|skin.contact)\b/.test(fold(w.name));
function localRows(country, w = null) {
  const n = LOCAL_NOTES[country];
  if (!n) return [];
  if (!w) return n.rows;
  const k = sommKeys(w);
  return n.rows.filter((r) => r.keys.some((x) => k.includes(x)) && (!r.sweet || isSweetWine(w)) && (!r.dry || !isSweetWine(w)) &&
    (!r.amber || isAmber(w))).concat(isAmber(w) ? n.rows.filter((r) => r.amber && !r.keys.some((x) => k.includes(x))) : []);
}
function localNotesHtml(country) {
  const n = LOCAL_NOTES[country];
  if (!n) return "";
  return `<div class="somm-card somm-local"><h4>🍽 ${esc(country)}'s own table ${CLAUDE_TAG}</h4><p>${esc(n.intro)}</p>
    <ul>${n.rows.map((r) => `<li><strong>With ${esc(r.label)}:</strong> ${esc(r.dishes)}.</li>`).join("")}
      <li><strong>Cheese:</strong> ${esc(n.cheese)}.</li><li><strong>Dessert:</strong> ${esc(n.dessert)}.</li></ul></div>`;
}

// One grape with one food, from every book: [{dish, s (1-3), b, p, why}], best first.
function grapeDishes(g, f) {
  const out = [];
  for (const x of SOMM?.grapes?.[g]?.foods?.[f] || []) out.push({ dish: x[0], s: x[1], b: x[2], p: x[3], why: x[4] || "", g });
  for (const [dish, s] of BOOK_DISHES[g]?.[f] || []) out.push({ dish, s: Math.min(3, s), b: "DPG", p: null, why: "", g });
  if (!out.length && GRAPE_FOOD[g]?.[f]) out.push({ dish: GRAPE_FOOD[g][f], s: 2, b: "DPG", p: null, why: "", g });
  const seen = new Set();
  return out.sort((a, b) => b.s - a.s).filter((x) => { const k = fold(x.dish); if (seen.has(k)) return false; seen.add(k); return true; });
}
// several grapes' dishes for one food, best first, no dish twice
function dishesFor(keys, f, n = 5) {
  const all = keys.flatMap((g) => grapeDishes(g, f)).sort((a, b) => b.s - a.s || (b.why ? 1 : 0) - (a.why ? 1 : 0));
  const seen = new Set();
  return all.filter((d) => { const k = fold(d.dish); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, n);
}
// How strongly the books back a grape with a food (1-3).
function grapeFoodTier(g, f) {
  const own = (SOMM?.grapes?.[g]?.foods?.[f] || []).map((x) => x[1]);
  return Math.min(3, Math.max(BOOK_TIER[g]?.[f] || 0, GRAPE_FOOD[g]?.[f] ? 2 : 0, ...own, 0));
}
function grapeFoods(g) {
  return FOODS.map((f) => ({ f, t: grapeFoodTier(g, f) })).filter((x) => x.t > 1 || grapeDishes(g, x.f).length).sort((a, b) => b.t - a.t);
}
const avoidsFor = (keys) => (SOMM?.dishes || []).filter((d) => (d[3] || []).some((a) => keys.includes(a)));
const avoidLi = (d) => `<li>Not with <strong>${esc(d[1])}</strong>${d[6] ? `: ${esc(d[6])}` : ""}${srcSpan(d[4], d[5])}</li>`;
const bridgesFor = (keys) => keys.flatMap((k) => (SOMM?.bridges?.[k] || []).map((x) => ({ k, ing: x[0], b: x[1], p: x[2] })));
// the books' rules that name these wines (serving, what to watch for)
const tipsFor = (keys, n = 3) => (SOMM?.principles || []).filter((p) => p[3].some((k) => keys.includes(k))).slice(0, n);
const tipLi = (p) => `<li>${esc(p[0])}${srcSpan(p[1], p[2])}</li>`;
const cheeseFor = (keys) => (SOMM?.cheese || []).filter((c) => c[1].some((x) => keys.includes(x)));
const dessertFor = (keys) => (SOMM?.dessert || []).filter((c) => c[1].some((x) => keys.includes(x)));
const listRefs = (rows, n = 6) => rows.slice(0, n).map((c) => `${esc(c[0])}${srcSpan(c[2], c[3])}`).join("; ");

// ---- Recipes ---------------------------------------------------------------------------------
function recipesFor(keys, f = null, words = []) {
  return (SOMM?.recipes || []).filter((r) => (!keys.length || r[6].some((x) => keys.includes(x))) && (!f || r[3] === f) &&
    (!words.length || words.some((t) => fold(r[0] + " " + r[5]).includes(t))));
}
const recipeKey = (r) => r[1] + "|" + fold(r[0]);
// The recipe opens on the card: the book's ingredients, a method in our own words, and the
// credit. A recipe not written out yet offers "Get a recipe" from Claude instead.
function recipeHtml(r) {
  const x = RECIPES[recipeKey(r)];
  const head = `<strong>${esc(r[0])}</strong>${srcSpan(r[1], r[2])}${r[6]?.length ? ` <span class="hint-inline">with ${esc(r[6].slice(0, 3).join(", "))}</span>` : ""}`;
  if (!x) return `<div class="somm-recipe-line">${head} ${recipeButton(r[0], r[6]?.join(", "))}</div>`;
  return `<details class="somm-recipe"><summary>📖 ${head} <span class="somm-open">Show the recipe</span></summary>
    <div class="somm-recipe-body">${x.s || x.t ? `<p class="hint">${esc([x.s, x.t].filter(Boolean).join(" · "))}</p>` : ""}
      ${r[7] ? `<p><strong>Why it suits the wine:</strong> ${esc(r[7])}</p>` : ""}
      <h5>Ingredients</h5><ul class="somm-ing">${x.i.map((l) => /:\s*$/.test(l) ? `<li class="somm-ing-h">${esc(l)}</li>` : `<li>${esc(l)}</li>`).join("")}</ul>
      <h5>Method</h5><ol class="somm-method">${x.m.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <p class="somm-src">Ingredients as printed in ${esc(ref(r[1], r[2]))}; the method is in our own words.</p></div></details>`;
}
function recipeButton(dish, wine = "") {
  return `<button type="button" class="btn btn-recipe" data-somm-recipe="${esc(dish)}" data-somm-recipe-wine="${esc(wine)}">🍳 Get a recipe</button>`;
}
function recipesHtml(list, max = 6, title = "Recipes from the books") {
  if (!list.length) return "";
  const byCourse = {};
  for (const r of list) (byCourse[r[4] || "main"] ||= []).push(r);
  const parts = Object.keys(COURSES).filter((c) => byCourse[c]).map((c) =>
    `<div class="somm-course"><span>${COURSES[c]}</span>${byCourse[c].slice(0, max).map(recipeHtml).join("")}</div>`);
  return `<h4>📖 ${title}</h4>${parts.join("")}`;
}
const recipePrompt = (dish, wine) => `Please write a recipe for a home cook: ${dish}${wine ? `, to serve with ${wine}` : ""}. ` +
  `Serves 4. List the ingredients with amounts, then short numbered steps with temperatures and times, then one or two lines on why it suits the wine.`;

// ---- Bottles -------------------------------------------------------------------------
function sommStores() {
  return [...document.querySelectorAll("#somm [data-somm-store]:checked")].map((b) => b.value);
}
function sommPool({ stores, country = "", colour = "", maxPrice = null }) {
  return WINES.filter((w) => stores.includes(w.source) && w.type !== "Sake" && w.type !== "Other" &&
    (!country || w.country === country) && (!colour || w.type === colour) &&
    (maxPrice == null || (priceOf(w) ?? Infinity) <= maxPrice) && (w.size_ml == null || w.size_ml >= 375));
}
const byBest = (a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0) || (priceOf(a) ?? 0) - (priceOf(b) ?? 0);
function sommRow(w, extra = "") {
  const s = familyScore(w);
  return `<li class="somm-bottle">
    <div class="somm-bottle-main"><div class="sl-name">${esc(w.name)}</div>
      <div>${typePill(w.type)} ${esc([w.country, w.vintage, sizeText(w)].filter(Boolean).join(" · "))}</div>
      <div><strong>${priceHtml(w)}</strong> at ${sourceBadge(w.source)}${s ? ` · <strong>${s}</strong> points` : ""}</div>${extra}</div>
    <div class="hit-buttons">${shoppingButton(w)}${researchButton(w)}</div></li>`;
}
const wineWord = (w) => `${w.name}${sommKeys(w).length ? ` (${sommKeys(w).join(", ")})` : ""}`;

// ---- Route 1: I have the wine ----------------------------------------------------------
function winePairingHtml(w, typed = false) {
  const keys = sommKeys(w), sweet = !typed && isSweetWine(w), grapes = bookKeys(keys, sweet);
  let foods;
  if (typed || !w.type) {
    const t = {};
    for (const g of grapes) for (const { f, t: n } of grapeFoods(g)) t[f] = Math.max(t[f] || 0, n);
    foods = Object.entries(t).map(([f, n]) => ({ f, t: n }));
  } else foods = foodsOf(w).map((f) => ({ f, t: Math.max(wineTier(w, f), ...grapes.map((g) => grapeFoodTier(g, f)).filter(() => !sweetOnly(w, f))) }));
  foods = foods.filter((x) => x.t > 1 || dishesFor(grapes, x.f).length || (!typed && pairDish(w, x.f)));
  foods.sort((a, b) => b.t - a.t || FOODS.indexOf(a.f) - FOODS.indexOf(b.f));
  const styles = grapes.filter((g) => keys.includes(g) && SOMM?.grapes?.[g]?.style).map((g) => ` ${esc(g)}: ${esc(SOMM.grapes[g].style)}.`).join("");
  const head = `<h3 class="somm-wine-h">${esc(w.name)}</h3>` + (typed ? "" :
    `<p>${typePill(w.type)} ${esc([w.country, w.vintage].filter(Boolean).join(" · "))} · <strong>${priceHtml(w)}</strong> at ${sourceBadge(w.source)}</p>`) +
    `<p class="somm-keys">${keys.length ? `Grape or style: <strong>${esc(keys.join(", "))}</strong>.` : "The grape isn't clear from the name."}${styles}</p>` + borrowedNote(keys, sweet);
  const local = !typed && LOCAL_NOTES[w.country] ? localRows(w.country, w) : [];
  const localHtml = local.length ? `<div class="somm-local-inline"><h4>🍽 From ${esc(w.country)}'s own table ${CLAUDE_TAG}</h4><ul>${local.map((r) => `<li>${esc(capFirst(r.dishes))}.</li>`).join("")}</ul></div>` : "";
  if (!foods.length) return `<div class="somm-card">${head}${localHtml}<p>${keys.length ? `The pairing books don't cover ${esc(keys.join(" or "))}` : "The grape or style can't be told from the name"}, so there's little to go on.${keys.length ? "" : " Try adding the grape (for example “Saperavi”)."} Claude can help: add the wine to the Short List and ask.</p></div>`;
  const rows = foods.map(({ f, t }) => {
    const ds = dishesFor(grapes, f, 5);
    const whys = ds.filter((d) => d.why).slice(0, 2).map((d) => `${esc(capFirst(d.why))}${srcSpan(d.b, d.p)}`);
    const src = [...new Set(ds.map((d) => bookName(d.b)))].join(", ");
    return `<li><span class="food-star tier-${t}">${STARS(t)}</span> <strong>${esc(f)}:</strong> ${ds.length
      ? esc(ds.map((d) => d.dish).join(", ")) : esc(typed ? "" : pairDish(w, f) || "")}.${whys.length ? ` ${whys.join(" ")}` : ""}${!whys.length && src ? ` <span class="somm-src">(${esc(src)})</span>` : ""}</li>`;
  }).join("");
  const avoid = avoidsFor(grapes).slice(0, 4).map(avoidLi).join("");
  let bold = "";
  if (!typed && w.type) try {
    bold = boldFoodsOf(w).map((x) => `<li>🍷 <strong>${esc(x.food)}:</strong> ${esc(capFirst(x.rule.dish(advContext(w)) || ""))}. ${esc(x.rule.why)}. <span class="somm-src">(${esc(x.rule.src)})</span></li>`).join("");
  } catch { bold = ""; }
  const ch = cheeseFor(grapes), de = dessertFor(grapes), br = bridgesFor(grapes), tips = tipsFor(grapes);
  return `<div class="somm-card">${head}${localHtml}
    <h4>🍖 Main dishes, by what's on the plate</h4><ul class="somm-foods">${rows}</ul>
    <p class="somm-src">★★★ the go-to · ★★ a common match · ★ pairs, but less often chosen.</p>
    ${br.length ? `<p><strong>🔗 Flavour bridges</strong> (ingredients that tie a dish to ${esc(br[0].k)}): ${esc(br[0].ing.join(", "))}.${srcSpan(br[0].b, br[0].p)}</p>` : ""}
    ${avoid ? `<h4>⚠️ What the books warn against</h4><ul>${avoid}</ul>` : ""}
    ${tips.length ? `<h4>💡 The books' advice</h4><ul>${tips.map(tipLi).join("")}</ul>` : ""}
    ${bold ? `<h4>Adventurous pairings</h4><ul>${bold}</ul>` : ""}
    ${ch.length ? `<p><strong>🧀 Cheese:</strong> ${listRefs(ch)}</p>` : ""}
    ${de.length ? `<p><strong>🍰 Dessert:</strong> ${listRefs(de)}</p>` : ""}
    ${recipesHtml(recipesFor(grapes), 4)}
    ${typed ? "" : `<div class="hit-buttons">${shoppingButton(w)}${researchButton(w)}</div>`}</div>`;
}

function countryPairingHtml(country, pool) {
  const byKey = new Map();
  for (const w of pool) for (const k of sommKeys(w)) (byKey.get(k) || byKey.set(k, []).get(k)).push(w);
  const keys = [...byKey].filter(([k]) => knownKey(k)).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const reg = SOMM?.regions?.[country];
  const local = reg?.foods?.length ? `<p><strong>Local food the books tie to ${esc(country)}'s wines:</strong> ${esc(reg.foods.join(", "))}` +
    ` <span class="somm-src">(${esc(reg.refs.map(([b, p]) => ref(b, p)).join("; "))})</span></p>` : "";
  if (!pool.length) return `<div class="somm-card"><p>No ${esc(country)} wines match those choices in the stores ticked. Try another store, colour or price.</p>${local}${localNotesHtml(country)}</div>`;
  const grapeHtml = keys.map(([g, ws]) => {
    const gk = bookKeys([g]);
    const top = FOODS.map((f) => ({ f, t: Math.max(0, ...gk.map((k) => grapeFoodTier(k, f))) })).filter((x) => x.t > 1).sort((a, b) => b.t - a.t).slice(0, 5);
    const recs = recipesFor(gk).slice(0, 3);
    return `<div class="somm-card"><h3 class="somm-wine-h">${esc(g)} <span class="hint-inline">(${ws.length} ${ws.length === 1 ? "bottle" : "bottles"})</span></h3>
      ${SOMM?.grapes?.[g]?.style ? `<p>${esc(SOMM.grapes[g].style)}</p>` : ""}${borrowedNote([g])}
      <ul class="somm-foods">${top.map(({ f, t }) => { const ds = dishesFor(gk, f, 4), why = ds.find((d) => d.why);
        return `<li><span class="food-star tier-${t}">${STARS(t)}</span> <strong>${esc(f)}:</strong> ${esc(ds.map((d) => d.dish).join(", "))}.${why ? ` ${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}` : ""}</li>`; }).join("")}</ul>
      ${recipesHtml(recs, 3)}
      <details class="somm-more"><summary>The bottles (${ws.length})<span class="pair-more" aria-hidden="true"></span></summary><ul class="somm-bottles">${ws.slice().sort(byBest).slice(0, 12).map((w) => sommRow(w)).join("")}</ul></details></div>`;
  }).join("");
  const missing = pool.filter((w) => !sommKeys(w).some(knownKey));
  const byType = new Map();
  for (const w of missing) (byType.get(w.type) || byType.set(w.type, []).get(w.type)).push(w);
  const styleHtml = [...byType].sort((a, b) => b[1].length - a[1].length).map(([type, ws]) => {
    const n = {};
    for (const w of ws) for (const f of foodsOf(w)) n[f] = (n[f] || 0) + 1;
    const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `<div class="somm-card"><h3 class="somm-wine-h">${esc(type)} blends and local grapes <span class="hint-inline">(${ws.length})</span></h3>
      <p class="hint">The books don't name these grapes, so the matches come from each wine's style (body, tannin, sweetness). Open a bottle's 🍽 Food pairings, or pair it on its own above.</p>
      <ul class="somm-foods">${top.map(([f, k]) => `<li><strong>${esc(f)}</strong>: ${k} of the ${ws.length}, for example ${esc(pairDish(ws.find((w) => foodsOf(w).includes(f)), f) || "")}</li>`).join("")}</ul>
      <details class="somm-more"><summary>The bottles (${ws.length})<span class="pair-more" aria-hidden="true"></span></summary><ul class="somm-bottles">${ws.slice().sort(byBest).slice(0, 15).map((w) => sommRow(w)).join("")}</ul></details></div>`;
  }).join("");
  return `<p class="somm-summary"><strong>${pool.length}</strong> ${esc(country)} wines in the stores ticked, by grape.</p>${local}${localNotesHtml(country)}${grapeHtml}${styleHtml}`;
}

// ---- Route 2: I'm cooking… -----------------------------------------------------------------
function cookHtml({ food, dish, stores, country, colour, maxPrice }) {
  const words = fold(dish).split(/[^a-z]+/).filter((t) => t.length > 3);
  const grapes = new Map();
  for (const g of new Set([...Object.keys(BOOK_TIER), ...Object.keys(SOMM?.grapes || {})])) {
    const t = grapeFoodTier(g, food);
    if (t) grapes.set(g, { t, why: grapeDishes(g, food).find((d) => d.why) });
  }
  // a dish named: the books' matches for it lift those wines to the top
  const dishRows = words.length ? (SOMM?.dishes || []).filter((d) => d[0] === food && words.some((t) => fold(d[1]).includes(t))) : [];
  for (const d of dishRows) for (const g of d[2]) grapes.set(g, { t: 3, why: { why: d[6], b: d[4], p: d[5] }, dish: d[1] });
  const avoid = new Set(dishRows.flatMap((d) => d[3] || []));
  const ranked = [...grapes].filter(([g]) => !avoid.has(g)).sort((a, b) => b[1].t - a[1].t);
  const pool = sommPool({ stores, country, colour, maxPrice }).filter((w) => !isSweetWine(w) || food === "Dessert" || food === "Cheese" || food === "Spicy food");
  const fit = (w) => Math.max(0, ...bookKeys(w).filter((k) => !avoid.has(k)).map((k) => grapes.get(k)?.t || 0));
  const bottles = pool.map((w) => ({ w, t: fit(w) })).filter((x) => x.t >= 2).sort((a, b) => b.t - a.t || byBest(a.w, b.w));
  const gList = ranked.slice(0, 10).map(([g, x]) => `<li><span class="food-star tier-${x.t}">${STARS(x.t)}</span> <strong>${esc(g)}</strong>` +
    `${x.dish ? ` with ${esc(x.dish)}` : grapeDishes(g, food).length ? `: ${esc(grapeDishes(g, food).slice(0, 3).map((d) => d.dish).join(", "))}` : ""}` +
    `${x.why?.why ? `. ${esc(capFirst(x.why.why))}${srcSpan(x.why.b, x.why.p)}` : ""}</li>`).join("");
  const recs = recipesFor([], food, words).length ? recipesFor([], food, words) : recipesFor([], food);
  const storeWord = stores.map(sourceLabel).join(", ");
  const local = country && LOCAL_NOTES[country] ? localNotesHtml(country) : "";
  return `<div class="somm-card"><h3 class="somm-wine-h">${esc(dish ? capFirst(dish) : food)}: what the books pour</h3>
      <ul class="somm-foods">${gList || "<li>The books name no wine for this.</li>"}</ul>
      ${avoid.size ? `<p><strong>⚠️ Avoid:</strong> ${esc([...avoid].join(", "))}.</p>` : ""}
      ${dish ? `<p>${recipeButton(dish, ranked[0]?.[0] || "")}</p>` : ""}
      ${recipesHtml(recs, 6, `Recipes from the books for ${food.toLowerCase()}`)}</div>${local}
    <div class="somm-card"><h3 class="somm-wine-h">Bottles you can buy (${bottles.length})</h3>
      <p class="hint">${esc(storeWord)}${country ? `, from ${esc(country)}` : ""}${colour ? `, ${esc(colour.toLowerCase())}` : ""}${maxPrice != null ? `, up to ${money(maxPrice)}` : ""}. Best match first, then best rated.</p>
      ${bottles.length ? `<ul class="somm-bottles">${bottles.slice(0, 12).map(({ w, t }) => sommRow(w, `<div><span class="food-star tier-${t}">${STARS(t)}</span> ${esc(sommKeys(w).join(", "))}</div>`)).join("")}</ul>` : "<p>No bottles match. Try more stores, another country or a higher price.</p>"}
      ${bottles.length > 12 ? `<button type="button" class="btn" data-somm-find="${esc(food)}">See all ${bottles.length} in Find wines</button>` : ""}</div>`;
}

// ---- Route 3: Build me a menu --------------------------------------------------------------
let lastMenu = null;
// A country's wines in the stores, or (own) the bottles handed in from the Comparison List.
function buildMenu({ country, nWines, courses, protein, stores, maxPrice, pool: given = null }) {
  const own = !!given;
  const pool = given || sommPool({ stores, country, maxPrice });
  if (own) nWines = Math.max(1, pool.length);
  const used = new Set(), plan = [];
  const pick = (cands, score) => cands.filter((w) => !used.has(w.id)).map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || byBest(a.w, b.w))[0]?.w || null;
  const tierFor = (w, f) => (foodsOf(w).includes(f) ? Math.max(wineTier(w, f), ...bookKeys(w).map((k) => grapeFoodTier(k, f))) : 0);
  const order = ["main", "dessert", "starter", "cheese"].filter((c) => courses.includes(c));
  const dryBonus = (w) => (["dry", null, undefined].includes(sweetV(w)) ? 5 : sweetV(w) === "off-dry" ? 1 : -20);
  for (const c of order) {
    let food = c === "main" ? protein : COURSE_FOODS[c]?.[0];
    let w = null, note = "";
    if (c === "dessert") {
      w = pick(pool.filter(isSweetWine), (x) => 1 + (bestScore(x) ?? 0) / 100);
      if (!w && own) note = "None of the ticked wines is a dessert wine.";
      else if (!w) {
        const away = sommPool({ stores, maxPrice }).filter((x) => realDessert(x) && x.country !== country);
        const classic = (x) => sommKeys(x).some((k) => ["Port", "Tokaji", "Ice wine", "Sauternes", "Late-harvest white", "Muscat / Moscato", "Madeira"].includes(k));
        w = pick(away, (x) => 1 + (classic(x) ? 3 : 0) + (x.type === "Dessert" ? 1 : 0) + (bestScore(x) ?? 0) / 100);
        note = w ? `${country} has no dessert wine in the stores ticked, so this one is from ${w.country}.` : `No dessert wine in the stores ticked.`;
      }
    } else if (c === "main") {
      const reds = pool.filter((x) => !isSweetWine(x) && x.type !== "Sparkling");
      const mains = ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood", "Pasta and pizza"];
      if (food) w = pick(reds, (x) => tierFor(x, food) && tierFor(x, food) * 10 + dryBonus(x) + (bestScore(x) ?? 0) / 100);
      else {
        const red = reds.filter((x) => x.type === "Red");
        w = pick(red.length ? red : reds, (x) => 30 + Math.max(0, ...mains.map((f) => tierFor(x, f))) * 10 + dryBonus(x) + (bestScore(x) ?? 0) / 100);
        if (w) food = foodsOf(w).filter((f) => !["Cheese", "Dessert"].includes(f)).sort((a, b) => tierFor(w, b) - tierFor(w, a))[0] || "Red meat";
      }
    } else {
      const fs = COURSE_FOODS[c] || [];
      w = pick(pool.filter((x) => !isSweetWine(x) || c === "cheese"), (x) => Math.max(0, ...fs.map((f) => tierFor(x, f))));
      if (w && c === "starter") food = fs.slice().sort((a, b) => tierFor(w, b) - tierFor(w, a))[0];
    }
    if (w) used.add(w.id);
    plan.push({ c, w, food, note });
  }
  // fewer wines than courses: the extra courses share the closest bottle already chosen
  const distinct = [];
  for (const p of plan) if (p.w && !distinct.includes(p.w)) distinct.push(p.w);
  if (distinct.length > nWines) {
    const keep = new Set(plan.filter((p) => p.c === "main" || p.c === "dessert").map((p) => p.w).filter(Boolean));
    for (const w of distinct) if (keep.size < nWines) keep.add(w);
    for (const p of plan) if (p.w && !keep.has(p.w)) {
      const share = [...keep].filter((w) => !isSweetWine(w) || p.c === "cheese").sort((a, b) => (tierFor(b, p.food) || 0) - (tierFor(a, p.food) || 0))[0];
      if (share) { p.w = share; p.note = (p.note ? p.note + " " : "") + "Same bottle as another course, to keep to " + nWines + " wines."; }
    }
  }
  // own bottles, more courses than wines: a course left without one shares the bottle that suits it best
  if (own) for (const p of plan) if (!p.w && p.c !== "dessert") {
    const share = pool.filter((x) => !isSweetWine(x) || p.c === "cheese").sort((a, b) => (tierFor(b, p.food) || 0) - (tierFor(a, p.food) || 0))[0];
    if (share) { p.w = share; p.note = "Same bottle as another course."; }
  }
  plan.sort((a, b) => Object.keys(COURSES).indexOf(a.c) - Object.keys(COURSES).indexOf(b.c));
  return { country, own, plan, pool: pool.length };
}
// One course: the local dish (for countries the books miss), the books' dishes with their
// reasons, a recipe, flavour bridges, warnings and the books' serving advice.
function courseHtml(p, country) {
  if (!p.w) return `<div class="somm-card somm-course-card"><h4>${COURSES[p.c]}</h4><p>${esc(p.note || `No ${country} wine suits this course in the stores ticked.`)}</p></div>`;
  const keys = sommKeys(p.w), sweet = isSweetWine(p.w), grapes = bookKeys(keys, sweet);
  const t = foodsOf(p.w).includes(p.food) ? Math.max(wineTier(p.w, p.food), ...grapes.map((k) => grapeFoodTier(k, p.food))) : 1;
  const n = LOCAL_NOTES[p.w.country];
  const parts = [];
  // what to serve
  if (p.c === "cheese") {
    const ch = cheeseFor(grapes);
    if (n) parts.push(`<p class="somm-dish"><strong>From ${esc(p.w.country)}'s table:</strong> ${esc(capFirst(n.cheese))}. ${CLAUDE_TAG}</p>`);
    parts.push(ch.length ? `<p class="somm-dish"><strong>The books' cheeses for this style:</strong> ${listRefs(ch, 6)}.</p>`
      : `<p class="somm-dish"><strong>Serve:</strong> ${esc(capFirst(pairDish(p.w, "Cheese") || ""))}.</p>`);
  } else if (p.c === "dessert") {
    const de = dessertFor(grapes);
    if (n && p.w.country === country) parts.push(`<p class="somm-dish"><strong>From ${esc(country)}'s table:</strong> ${esc(capFirst(n.dessert))}. ${CLAUDE_TAG}</p>`);
    parts.push(de.length ? `<p class="somm-dish"><strong>The books' desserts for this wine:</strong> ${listRefs(de, 6)}.</p>`
      : `<p class="somm-dish"><strong>Serve:</strong> ${esc(capFirst(pairDish(p.w, "Dessert") || ""))}.</p>`);
  } else {
    const local = n ? localRows(p.w.country, p.w) : [];
    if (local.length) parts.push(`<p class="somm-dish"><strong>From ${esc(p.w.country)}'s table:</strong> ${esc(capFirst(local[0].dishes))}. ${CLAUDE_TAG}</p>`);
    const ds = dishesFor(grapes, p.food, 4);
    if (ds.length) parts.push(`<p class="somm-dish"><strong>${local.length ? "What the books pour this style with" : "Serve"}:</strong></p><ul class="somm-foods">${ds.map((d) =>
      `<li>${esc(capFirst(d.dish))}${d.why ? `. ${esc(capFirst(d.why))}` : ""}${srcSpan(d.b, d.p)}${keys.includes(d.g) ? "" : ` <span class="hint-inline">(said of ${esc(d.g)})</span>`}</li>`).join("")}</ul>`);
    else parts.push(`<p class="somm-dish"><strong>Serve:</strong> ${esc(capFirst(pairDish(p.w, p.food) || ""))}.</p>`);
    const top = local.length ? local[0].dishes.split(/,(?![^(]*\))/)[0] : ds[0]?.dish;
    if (top) parts.push(`<p>${recipeButton(top.trim(), wineWord(p.w))}</p>`);
  }
  const recs = recipesFor(grapes, p.c === "cheese" || p.c === "dessert" ? null : p.food)
    .filter((r) => p.c === "dessert" ? r[4] === "dessert" : p.c === "cheese" ? r[4] === "cheese" : !["dessert", "cheese"].includes(r[4])).slice(0, 3);
  const br = p.c === "main" || p.c === "starter" ? bridgesFor(grapes) : [];
  const avoid = avoidsFor(grapes).filter((d) => p.c === "main" || p.c === "starter" ? d[0] === p.food || !["Cheese", "Dessert"].includes(d[0]) : d[0] === (p.c === "cheese" ? "Cheese" : "Dessert")).slice(0, 2);
  const tips = tipsFor(grapes, 2);
  return `<div class="somm-card somm-course-card"><h4>${COURSES[p.c]}${p.food && p.c !== "cheese" && p.c !== "dessert" ? `: ${esc(p.food.toLowerCase())}` : ""} <span class="food-star tier-${t}">${STARS(t)}</span></h4>
    <ul class="somm-bottles">${sommRow(p.w, keys.length ? `<div>${esc(keys.join(", "))}</div>` : "")}</ul>
    ${p.note ? `<p class="somm-note">${esc(p.note)}</p>` : ""}${borrowedNote(keys, sweet)}
    ${parts.join("")}
    ${recs.length ? `<h5>📖 Recipes from the books</h5>${recs.map(recipeHtml).join("")}` : ""}
    ${br.length ? `<p><strong>🔗 Flavour bridges</strong> for ${esc(br[0].k)} (ingredients that tie a dish to it): ${esc(br[0].ing.join(", "))}.${srcSpan(br[0].b, br[0].p)}</p>` : ""}
    ${avoid.length ? `<p><strong>⚠️ Watch out:</strong></p><ul>${avoid.map(avoidLi).join("")}</ul>` : ""}
    ${tips.length ? `<p><strong>💡 The books' advice:</strong></p><ul>${tips.map(tipLi).join("")}</ul>` : ""}</div>`;
}
function menuHtml(m) {
  const reg = SOMM?.regions?.[m.country];
  const wines = [...new Set(m.plan.map((p) => p.w).filter(Boolean))];
  // the books' own menus that pour the same grapes, for ideas
  const mk = new Set(wines.flatMap((w) => bookKeys(w)));
  const bookMenus = (SOMM?.menus || []).map((x) => ({ x, n: x[3].filter((c) => c[1].some((k) => mk.has(k))).length })).filter((y) => y.n)
    .sort((a, b) => b.n - a.n).slice(0, 3).map(({ x }) => `<li><strong>${esc(x[0])}</strong>${srcSpan(x[1], x[2])}: ` +
      x[3].map((c) => `${esc(c[0])}${c[1].length ? ` <span class="hint-inline">with ${esc(c[1].join(" / "))}</span>` : ""}`).join(" · ") + `</li>`).join("");
  const n = LOCAL_NOTES[m.country];
  const head = m.own ? `<strong>A menu from your Comparison List</strong>: ${wines.length} of the ${m.pool} ${m.pool === 1 ? "wine" : "wines"} ticked, each on the course it suits best.`
    : `<strong>A ${esc(m.country)} menu</strong>, ${wines.length} ${wines.length === 1 ? "wine" : "wines"}, chosen from ${m.pool} ${esc(m.country)} bottles in the stores ticked.`;
  return `<p class="somm-summary">${head}</p>
    ${n ? `<p>${esc(n.intro)} ${CLAUDE_TAG}</p>` : ""}
    ${reg?.foods?.length ? `<p><strong>Local food the books tie to these wines:</strong> ${esc(reg.foods.join(", "))}.</p>` : ""}
    ${m.plan.map((p) => courseHtml(p, m.country)).join("")}
    ${bookMenus ? `<div class="somm-card"><h4>📖 Menus in the books with the same grapes, for ideas</h4><ul>${bookMenus}</ul></div>` : ""}
    <div class="somm-ask"><button type="button" class="btn btn-primary" data-somm="ask-menu">Ask Claude to polish this menu</button>
      <button type="button" class="btn" data-somm="menu-all">⚖️ Add all ${wines.length} wines to the Comparison List</button>
      <p id="somm-ask-msg" class="status" role="status"></p></div>`;
}
function menuPrompt(m) {
  const lines = m.plan.map((p) => `- ${COURSES[p.c]}${p.food && p.c === "main" ? ` (${p.food.toLowerCase()})` : ""}: ${p.w ? `${p.w.name}${p.w.vintage ? " " + p.w.vintage : ""}, ${money(priceOf(p.w) ?? p.w.price)} at ${sourceLabel(p.w.source)}` : "no wine found"}${p.note ? ` (${p.note})` : ""}`);
  return `I'm planning a dinner to show off ${m.own ? "some wines I've picked" : `wines from ${m.country}`}. My wine finder suggested these bottles for each course:\n\n${lines.join("\n")}\n\n` +
    `Please act as a Master Sommelier: for each course, suggest one specific dish that suits that wine (with a short reason), say whether you'd change any of the wines and why, and give serving tips (temperature, decanting, order of pouring). Keep it practical for a home cook.`;
}

// ---- The panel -----------------------------------------------------------------------------
function sommCountries() {
  const stores = sommStores(), n = new Map();
  for (const w of WINES) if (stores.includes(w.source) && w.country && w.country !== "Country not stated") n.set(w.country, (n.get(w.country) || 0) + 1);
  return [...n].sort((a, b) => a[0].localeCompare(b[0]));
}
function fillCountrySelects() {
  const opts = sommCountries().map(([c, k]) => `<option value="${esc(c)}">${esc(c)} (${k})</option>`).join("");
  for (const sel of document.querySelectorAll("#somm select[data-somm-country]")) {
    const v = sel.value;
    sel.innerHTML = (sel.dataset.sommCountry === "any" ? `<option value="">Any country</option>` : `<option value="">Choose a country…</option>`) + opts;
    sel.value = v;
  }
}
function renderSommStores() {
  const box = $("somm-stores");
  if (!box) return;
  const known = knownSources(), on = new Set(sommStores().length ? sommStores() : ["BC Liquor"]);
  box.innerHTML = `<span class="somm-label">Buying from:</span> ` + known.map((s) => `<label class="somm-check"><input type="checkbox" data-somm-store value="${esc(s)}"${on.has(s) ? " checked" : ""}> ${esc(sourceLabel(s))}</label>`).join("") +
    (known.includes("LCBO") ? "" : ` <span class="hint-inline">The LCBO (Ontario) appears here once it's unlocked: tick LCBO under <strong>Sold by</strong> in Find wines and enter the family code.</span>`);
}
// The Comparison List as its own way in: each wine with its details, a tick box each.
function renderSommComparison() {
  const box = $("somm-cmp-list");
  if (!box) return;
  const items = shopping.map((s) => findWine(s.id) || s);
  const row = (w) => `<li class="somm-bottle"><label class="somm-cmp-row"><input type="checkbox" data-somm-cmp value="${esc(w.id)}" checked>
    <span class="somm-bottle-main"><span class="sl-name">${esc(w.name)}</span><br>
      ${w.type ? typePill(w.type) + " " : ""}${esc([w.country, w.vintage, w.size_ml ? sizeText(w) : ""].filter(Boolean).join(" · "))}<br>
      ${priceOf(w) != null ? `<strong>${priceHtml(w)}</strong> at ${sourceBadge(w.source)}` : esc(sourceLabel(w.source) || "added by name")}${familyScore(w) ? ` · <strong>${familyScore(w)}</strong> points` : ""}${sommKeys(w).length ? ` · ${esc(sommKeys(w).join(", "))}` : ""}</span></label></li>`;
  box.innerHTML = items.length
    ? `<p><strong>${items.length} ${items.length === 1 ? "wine" : "wines"}</strong> on your Comparison List: <button type="button" class="linklike" data-somm="cmp-all">tick all</button> · <button type="button" class="linklike" data-somm="cmp-none">untick all</button></p>
       <ul class="somm-bottles somm-cmp-list">${items.map(row).join("")}</ul>
       <button type="button" class="btn btn-somm btn-big" data-somm="pair-cmp">Pair the ticked wines</button>`
    : `<p class="hint">Your Comparison List is empty. Press <strong>⚖️ ＋ Add wine to Comparison List</strong> on any wine in Find wines or My wines, then come back here.</p>`;
}
function sommTab(name) {
  for (const b of document.querySelectorAll("#somm [data-somm-tab]")) b.setAttribute("aria-selected", String(b.dataset.sommTab === name));
  for (const p of document.querySelectorAll("#somm .somm-pane")) p.hidden = p.id !== "somm-" + name;
  $("somm-out").innerHTML = "";
  storeSet("wf.sommTab", name);
}
function openSomm() {
  renderSommStores();
  renderSommComparison();
  fillCountrySelects();
  if (!allLoaded()) loadAllSources().then(() => { renderSommStores(); fillCountrySelects(); });
  return loadSomm();
}
const sommNum = (id) => { const v = parseFloat($(id)?.value); return Number.isFinite(v) && v > 0 ? v : null; };
const showOut = (html) => { $("somm-out").innerHTML = html; $("somm-out").scrollIntoView({ behavior: "smooth", block: "start" }); };

const renderSommHits = debounce(() => {
  const q = $("somm-q").value.trim(), out = $("somm-hits");
  if (q.length < 3) { out.innerHTML = ""; return; }
  const hits = listHits(q).slice(0, 6);
  out.innerHTML = (hits.length ? `<p>Found on our store lists: tap one to pair it.</p><ul class="somm-hit-list">${hits.map((w) =>
    `<li><button type="button" class="btn somm-hit" data-somm-wine="${esc(w.id)}">${esc(w.name)}${w.vintage ? ` ${esc(String(w.vintage))}` : ""} · ${priceHtml(w)} · ${esc(sourceLabel(w.source))}</button></li>`).join("")}</ul>` : "") +
    `<button type="button" class="btn btn-somm" data-somm="pair-typed">Pair “${esc(q)}” as typed</button>`;
}, 300);

document.addEventListener("click", async (e) => {
  const t = e.target.closest("#somm [data-somm], #somm [data-somm-tab], #somm [data-somm-wine], #somm [data-somm-find], #somm [data-somm-recipe]");
  if (!t) return;
  await loadSomm();
  if (t.dataset.sommTab) return sommTab(t.dataset.sommTab);
  if (t.dataset.sommWine) { const w = findWine(t.dataset.sommWine); if (w) showOut(winePairingHtml(w)); return; }
  if (t.dataset.sommRecipe) { // Claude writes a recipe for a dish the books don't give one for
    const prompt = recipePrompt(t.dataset.sommRecipe, t.dataset.sommRecipeWine), { url } = claudeLink(prompt);
    const r = await openClaudeHere(url, prompt);
    let msg = t.nextElementSibling;
    if (!msg?.classList.contains("somm-recipe-msg")) { msg = document.createElement("span"); msg.className = "somm-recipe-msg status"; t.after(msg); }
    msg.innerHTML = " " + newTabMessage(r, url);
    return;
  }
  if (t.dataset.sommFind) {
    state = defaultState();
    state.sources = new Set(sommStores());
    state.food = new Set([t.dataset.sommFind]);
    const c = $("somm-cook-country").value; if (c) state.countries = new Set([c]);
    const p = sommNum("somm-cook-price"); if (p != null) state.priceTo = p;
    state.sorts = ["food-desc", "best-desc", ""];
    renderAll(); showView("find");
    return;
  }
  const a = t.dataset.somm;
  if (a === "pair-typed") {
    const q = $("somm-q").value.trim();
    if (q) showOut(winePairingHtml({ id: "typed", name: q, kind: "typed" }, true));
  } else if (a === "cmp-all" || a === "cmp-none") {
    for (const b of document.querySelectorAll("#somm [data-somm-cmp]")) b.checked = a === "cmp-all";
  } else if (a === "pair-cmp") {
    const ids = [...document.querySelectorAll("#somm [data-somm-cmp]:checked")].map((b) => b.value);
    const ws = ids.map((id) => findWine(id) || shopping.find((s) => s.id === id)).filter(Boolean);
    showOut(ws.length ? ws.map((w) => winePairingHtml(w, w.kind === "typed")).join("") : `<p>Tick at least one wine.</p>`);
  } else if (a === "menu-cmp") { // the ticked Comparison List wines, each sent to the course it suits best
    const ids = [...document.querySelectorAll("#somm [data-somm-cmp]:checked")].map((b) => b.value);
    const ws = ids.map((id) => findWine(id) || shopping.find((s) => s.id === id)).filter((w) => w && w.type);
    if (!ws.length) { showOut(`<p>Tick at least one wine first.</p>`); return; }
    const courses = [...document.querySelectorAll("#somm [data-somm-cmp-course]:checked")].map((b) => b.value);
    if (!courses.length) { showOut(`<p>Tick at least one course.</p>`); return; }
    lastMenu = buildMenu({ country: "", courses, protein: $("somm-cmp-protein").value, stores: sommStores(), pool: ws });
    showOut(menuHtml(lastMenu));
  } else if (a === "pair-country") {
    const country = $("somm-country").value;
    if (!country) { $("somm-country").focus(); return; }
    showOut(countryPairingHtml(country, sommPool({ stores: sommStores(), country, colour: $("somm-colour").value, maxPrice: sommNum("somm-price") })));
  } else if (a === "cook") {
    const food = document.querySelector("#somm [name=somm-food]:checked")?.value;
    if (!food) { $("somm-cook-msg").textContent = "Choose what you're cooking first."; return; }
    $("somm-cook-msg").textContent = "";
    showOut(cookHtml({ food, dish: $("somm-dish").value.trim(), stores: sommStores(), country: $("somm-cook-country").value,
      colour: $("somm-cook-colour").value, maxPrice: sommNum("somm-cook-price") }));
  } else if (a === "menu") {
    const country = $("somm-menu-country").value;
    if (!country) { $("somm-menu-country").focus(); return; }
    const courses = [...document.querySelectorAll("#somm [data-somm-course]:checked")].map((b) => b.value);
    if (!courses.length) return;
    lastMenu = buildMenu({ country, nWines: +$("somm-nwines").value || 3, courses, protein: $("somm-protein").value,
      stores: sommStores(), maxPrice: sommNum("somm-menu-price") });
    showOut(menuHtml(lastMenu));
  } else if (a === "ask-menu" && lastMenu) {
    const prompt = menuPrompt(lastMenu), { url } = claudeLink(prompt);
    const r = await openClaudeHere(url, prompt);
    $("somm-ask-msg").innerHTML = newTabMessage(r, url);
  } else if (a === "menu-all" && lastMenu) {
    for (const w of new Set(lastMenu.plan.map((p) => p.w).filter(Boolean))) if (!onShopping(w.id)) toggleShopping(w.id);
    t.textContent = "✓ All on the Comparison List";
  }
});
document.addEventListener("change", (e) => { if (e.target.matches?.("#somm [data-somm-store]")) fillCountrySelects(); });
document.addEventListener("input", (e) => { if (e.target.id === "somm-q") renderSommHits(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "somm-q") { e.preventDefault(); document.querySelector('#somm [data-somm="pair-typed"]')?.click(); }
});
// fill the panel's lists whenever the Sommelier page is shown
new MutationObserver(() => { if (!$("view-somm").hidden) openSomm(); })
  .observe($("view-somm"), { attributes: true, attributeFilter: ["hidden"] });
sommTab(storeGet("wf.sommTab", "wine"));
