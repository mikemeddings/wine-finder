"use strict";
// ---- Master Sommelier (its own page, the Sommelier button at the top) -------------------------------------------
// Wine and food matched from the pairing books, three ways in: "I have a bottle" (typed, or
// every wine of a country), "I have some food" (a food, then real bottles from the family's
// cellars and the stores) and "Plan a dinner" (a country's wines across the courses). Everything is
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

// CellarTracker's blend names as the grapes they mean, grapes the name alone doesn't give, and a
// plain "Red Blend" or "White Blend" where its region settles it. Only for a wine with no grape yet.
const BLEND_KEYS = [
  ["Red", /\bred bordeaux blend\b/, ["Cabernet Sauvignon", "Merlot"]],
  ["Red", /\bred rhone blend\b/, ["Grenache / Garnacha", "Syrah / Shiraz"]],
  ["White", /\bwhite rhone blend\b/, ["Marsanne / Roussanne"]],
  ["White", /\bmelon a queue rouge\b/, ["Chardonnay"]],
  [null, /\bpetite arvine\b/, ["Petite Arvine"]],
  [null, /\bheida\b|\bsavagnin\b/, ["Heida / Savagnin"]],
  [null, /\bamigne\b/, ["Amigne"]],
  [null, /\bcompleter\b/, ["Completer"]],
  [null, /\bresi\b/, ["Resi"]],
  ["Red", /\bcornalin\b/, ["Cornalin"]],
  ["Red", /\bswartland\b/, ["Syrah / Shiraz"]],
  ["White", /\bswartland\b/, ["Chenin Blanc"]],
  ["Red", /\btoscana\b/, ["Sangiovese"]],
  ["Red", /\bpurcari\b/, ["Fetească Neagră"]],
];

// The names the books use for a wine: its grapes (those that fit its colour), and its style
// where that's what the books go by (sparkling, rosé, Port, sherry, a sweet white).
function sommKeys(w) {
  const t = fold([w.name, w.grape, w.region, w.region_or_grape, w.varietal].filter(Boolean).join(" "));
  const keys = grapesOf(w).filter((g) => !w.type || grapeFits(w, g) || !["Red", "White"].includes(w.type));
  // Douro and Dão dry reds are built on Touriga Nacional (Daring Pairings, p. 292)
  if (!keys.length && w.type === "Red" && /\b(douro|dao)\b/.test(t)) keys.push("Touriga Nacional");
  if (!keys.length) keys.push(...(BLEND_KEYS.find(([type, re]) => (!type || type === w.type) && re.test(t))?.[2] || []));
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
  "Petite Arvine": ["Riesling", "Sauvignon Blanc"],
  "Heida / Savagnin": ["Grüner Veltliner", "Chardonnay"],
  "Amigne": ["Viognier", "Pinot Grigio / Gris"],
  "Completer": ["Riesling", "Chenin Blanc"],
  "Resi": ["Sauvignon Blanc", "Riesling"],
  "Cornalin": ["Syrah / Shiraz", "Sangiovese"],
};
const COUSIN_STYLE = {
  "Saperavi": "dark, high in acid and firmly tannic", "Fetească Neagră": "plummy, spicy and medium- to full-bodied",
  "Rară Neagră": "light, with red fruit and soft tannins", "Baga": "high in acid and tannin", "Agiorgitiko": "plummy and soft",
  "Petit Verdot": "dark and tannic", "Zweigelt": "light and cherry-fruited", "Rkatsiteli": "crisp, high in acid, apple and quince",
  "Mtsvane": "fresh and aromatic, stone fruit", "Kisi": "rich, apricot and spice, often made as an amber wine",
  "Fetească Albă / Regală": "floral, fresh and aromatic", "Furmint": "high in acid, apple and smoke", "Fiano": "rich, nutty and waxy",
  "Godello": "rich but fresh, mineral", "Chasselas": "light, soft and delicate", "Cortese (Gavi)": "light, crisp and citrusy",
  "Petite Arvine": "crisp and salty, with grapefruit", "Heida / Savagnin": "full, nutty and fresh", "Amigne": "rich, with tangerine and honey",
  "Completer": "rich but high in acid", "Resi": "sharp, light and mineral", "Cornalin": "dark, spicy and cherry-fruited",
};
// The same grapes made semi-sweet (Kindzmarauli, Khvanchkara): the dry stand-ins' advice (steak,
// tannin) would be wrong, so these go by the books' sweet red, Port, instead.
const SWEET_COUSINS = { "Saperavi": ["Port"], "Amigne": ["Late-harvest white"], "Petite Arvine": ["Late-harvest white"] };
const SWEET_COUSIN_STYLE = { "Saperavi": "here made semi-sweet, as Kindzmarauli or Khvanchkara: dark berries, soft tannin and a little sugar" };
const cousinsOf = (g, sweet) => (sweet && SWEET_COUSINS[g]) || COUSINS[g];
const borrowedOf = (keys) => keys.filter((g) => !inBooks(g) && COUSINS[g]);

// Grapes of the same style, for "other wines for this dish": when the book pours Xinomavro
// with a recipe, bottles of these grapes are offered as stand-ins, marked as Claude's
// judgement. A grape can sit in two families (Aglianico is both high-acid and big).
const STYLE_FAMILIES = [
  ["light, bright reds with soft tannin", ["Pinot Noir", "Gamay", "Zweigelt", "Rară Neagră", "Dolcetto", "Barbera", "Cinsaut", "Mencía", "Blaufränkisch"]],
  ["high-acid, firmly tannic reds", ["Nebbiolo", "Xinomavro", "Baga", "Aglianico", "Saperavi", "Sangiovese", "Tannat"]],
  ["medium-bodied, savoury reds", ["Sangiovese", "Tempranillo", "Montepulciano", "Corvina (Amarone, Valpolicella)", "Cabernet Franc", "Mencía", "Blaufränkisch", "Agiorgitiko", "Carignan", "Pinotage", "Barbera"]],
  ["plush, dark-fruited reds", ["Merlot", "Malbec", "Carmenère", "Zinfandel / Primitivo", "Grenache / Garnacha", "Nero d'Avola", "Pinotage", "Fetească Neagră", "Agiorgitiko", "Petite Sirah"]],
  ["big, tannic, long-lived reds", ["Cabernet Sauvignon", "Syrah / Shiraz", "Petit Verdot", "Tannat", "Petite Sirah", "Touriga Nacional", "Mourvèdre / Monastrell", "Aglianico", "Saperavi", "Malbec", "Carignan", "Nebbiolo", "Cornalin"]],
  ["sharp, citrus, mineral whites", ["Sauvignon Blanc", "Verdejo", "Albariño", "Txakoli", "Assyrtiko", "Grüner Veltliner", "Riesling", "Rkatsiteli", "Furmint", "Chenin Blanc", "Vermentino", "Godello", "Petite Arvine", "Resi", "Completer"]],
  ["light, soft, gentle whites", ["Pinot Grigio / Gris", "Trebbiano", "Garganega (Soave)", "Cortese (Gavi)", "Pinot Blanc", "Chasselas", "Arneis", "Vermentino", "Fetească Albă / Regală", "Godello", "Albariño"]],
  ["rich, full-bodied whites", ["Chardonnay", "Marsanne / Roussanne", "Viognier", "Sémillon", "Fiano", "Godello", "Kisi", "Chenin Blanc", "Grüner Veltliner", "Heida / Savagnin", "Amigne"]],
  ["aromatic, perfumed whites", ["Gewürztraminer", "Muscat / Moscato", "Torrontés", "Viognier", "Riesling", "Mtsvane", "Fetească Albă / Regală", "Kisi", "Pinot Gris"]],
  ["sparkling wines", ["Sparkling", "Champagne", "Glera (Prosecco)"]],
  ["dry rosés", ["Rosé"]],
  ["sweet whites", ["Sauternes", "Late-harvest white", "Tokaji", "Ice wine", "Vinsanto", "Muscat / Moscato"]],
  ["sweet fortified wines", ["Port", "Madeira", "Sherry (oloroso)", "Late-harvest white"]],
];
// the books' blend names, as the grapes they mean
const KEY_ALIASES = { "Bordeaux": ["Cabernet Sauvignon", "Merlot"], "Rhône blends": ["Syrah / Shiraz", "Grenache / Garnacha"],
  "Super Tuscan": ["Sangiovese", "Cabernet Sauvignon"], "Central Coast white": ["Chardonnay"], "White Burgundy": ["Chardonnay"], "Red Burgundy": ["Pinot Noir"] };
const expandKeys = (keys) => [...new Set(keys.flatMap((k) => KEY_ALIASES[k] || [k]))];
// the grapes of the same style as any of these, with the family name and the grape it stands in for
function sameStyleAs(keys) {
  const out = new Map();
  for (const [name, grapes] of STYLE_FAMILIES) for (const k of keys) if (grapes.includes(k))
    for (const g of grapes) if (!keys.includes(g) && !out.has(g)) out.set(g, { family: name, like: k });
  return out;
}
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
  Switzerland: {
    intro: "Swiss wine is mostly drunk at home, with food from the lakes and the mountains: melted cheese, air-dried meat, lake fish and rösti.",
    rows: [
      { keys: ["Chasselas"], type: "White", label: "Chasselas and other gentle whites", main: "Fish",
        dishes: "fondue moitié-moitié, filets de perche (Lake Geneva perch) with lemon butter, papet vaudois (leeks and potato with sausage)" },
      { keys: ["Petite Arvine", "Heida / Savagnin", "Resi", "Completer", "Riesling"], dry: true, label: "Valais and Graubünden whites (Petite Arvine, Heida, Completer)", main: "Cheese",
        dishes: "raclette with potatoes and cornichons, an assiette valaisanne (air-dried beef, rye bread, mountain cheese), trout with almonds" },
      { keys: ["Amigne"], label: "Amigne", main: "Cheese",
        dishes: "Vacherin Mont-d'Or baked in its box, foie gras, apricot tart" },
      { keys: ["Cornalin", "Syrah / Shiraz", "Gamay", "Pinot Noir"], type: "Red", label: "Swiss reds (Cornalin, Syrah, Gamay, Pinot Noir)", main: "Red meat",
        dishes: "viande séchée des Grisons, veal in cream sauce with rösti (Zürcher Geschnetzeltes), venison with spätzli" },
      { keys: ["Merlot"], label: "Ticino Merlot", main: "Pasta and pizza",
        dishes: "risotto with luganighe sausage, polenta with braised beef" },
    ],
    cheese: "Gruyère, Tête de Moine and Vacherin Mont-d'Or, with Chasselas, Petite Arvine or a light Pinot Noir",
    dessert: "tarte aux pruneaux and meringues with double cream from Gruyère, with a sweet Amigne or a Valais late-harvest wine",
  },
};
const CLAUDE_TAG = `<span class="somm-claude">Claude's notes, not from the books</span>`;
const isAmber = (w) => /\b(amber|qvevri|kvevri|orange wine|skin.contact)\b/.test(fold(w.name));
function localRows(country, w = null) {
  const n = LOCAL_NOTES[country];
  if (!n) return [];
  if (!w) return n.rows;
  const k = sommKeys(w);
  return n.rows.filter((r) => (r.keys.some((x) => k.includes(x)) || (!k.length && r.type === w.type)) && (!r.sweet || isSweetWine(w)) && (!r.dry || !isSweetWine(w)) &&
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
// The books mark some of a grape's dishes "(rosé)": those are for its rosé, not its red or white.
const dishForWine = (w, d) => (!w.type || w.type === "Rosé" ? d
  : { ...d, dish: d.dish.split(/,\s*/).filter((x) => !/\(ros[eé]\)/i.test(x)).join(", ") });
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
  return `<details class="somm-recipe" data-recipe="${esc(recipeKey(r))}"><summary>📖 ${head} <span class="somm-open">Show the recipe</span></summary>
    <div class="somm-recipe-body">${x.s || x.t ? `<p class="hint">${esc([x.s, x.t].filter(Boolean).join(" · "))}</p>` : ""}
      ${r[7] ? `<p><strong>Why it suits the wine:</strong> ${esc(r[7])}</p>` : ""}
      <h5>Ingredients</h5><ul class="somm-ing">${x.i.map((l) => /:\s*$/.test(l) ? `<li class="somm-ing-h">${esc(l)}</li>` : `<li>${esc(l)}</li>`).join("")}</ul>
      <h5>Method</h5><ol class="somm-method">${x.m.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <p class="somm-src">Ingredients as printed in ${esc(ref(r[1], r[2]))}; the method is in our own words.</p>
      <div class="somm-recipe-tools" data-recipe-tools="${esc(recipeKey(r))}">
        <button type="button" class="btn" data-recipe-shop aria-expanded="false">🛒 Shopping list</button>
        <select data-recipe-what aria-label="What to print or email"><option value="both">Recipe and shopping list</option><option value="recipe">The recipe</option><option value="list">The shopping list</option></select>
        <button type="button" class="btn" data-recipe-out="print">🖨 Print</button> <button type="button" class="btn" data-recipe-out="email">✉️ Email</button>
        <span class="status" role="status"></span><div class="somm-shop-box"></div></div></div></details>`;
}
// ---- Other wines for this dish -------------------------------------------------------------
// Bottles in the stores ticked that carry the grape the book pours with a recipe, then bottles
// of grapes of the same style (marked), by country and price. Filled when the recipe is opened.
let RECIPE_BY_KEY = null;
function recipeByKey(key) {
  if (!RECIPE_BY_KEY) { RECIPE_BY_KEY = new Map(); for (const r of SOMM?.recipes || []) RECIPE_BY_KEY.set(recipeKey(r), r); }
  return RECIPE_BY_KEY.get(key);
}
function matchBottles(r, bottles) {
  const want = expandKeys(r[6] || []), alike = sameStyleAs(want);
  const sweetOk = r[4] === "dessert" || want.some((k) => ["Sauternes", "Late-harvest white", "Tokaji", "Ice wine", "Vinsanto", "Port", "Madeira", "Sherry (oloroso)"].includes(k));
  const pool = bottles.filter((w) => sweetOk || !isSweetWine(w));
  const rows = [];
  for (const w of pool) {
    const ks = sommKeys(w);
    const hit = ks.find((k) => want.includes(k));
    if (hit) { rows.push({ w, exact: true, grape: hit }); continue; }
    const near = ks.find((k) => alike.has(k));
    if (near) rows.push({ w, exact: false, grape: near, ...alike.get(near) });
  }
  return rows.sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || byBest(a.w, b.w));
}
const recipeBottles = (r, { country = "", maxPrice = null } = {}) => matchBottles(r, sommPool({ stores: sommStores(), country, maxPrice, cellars: [] }));
const bottleWhy = (x) => (x.exact ? `<div class="somm-rb-why">✓ <strong>${esc(x.grape)}</strong>, the grape the book pours with this dish</div>`
  : `<div class="somm-rb-why"><strong>${esc(x.grape)}</strong>: same style as ${esc(x.like)} (${esc(x.family)}). ${CLAUDE_TAG}</div>`);
// The family's bottles for a recipe, ready to drink now, whatever is ticked on the Sommelier page.
function recipeFamilyHtml(r, max = 5) {
  const order = ["first", "soon", "ready"];
  const rows = matchBottles(r, cellarFindWines().filter((w) => drinkStage(w) !== "wait"))
    .sort((a, b) => order.indexOf(drinkStage(a.w)) - order.indexOf(drinkStage(b.w)));
  if (!rows.length) return "";
  return `<h5>🍷 In the family's cellars, ready to drink</h5><ul class="somm-bottles">${rows.slice(0, max).map((x) => sommRow(x.w, bottleWhy(x))).join("")}</ul>` +
    (rows.length > max ? `<p class="hint">Showing ${max} of ${rows.length}.</p>` : "");
}
function recipeBottlesHtml(r, opts, max = 8) {
  const rows = recipeBottles(r, opts), named = expandKeys(r[6] || []).join(", ");
  const where = `${opts.country ? `from ${esc(opts.country)}` : "in the stores ticked"}${opts.maxPrice != null ? ` up to ${money(opts.maxPrice)}` : ""}`;
  if (!rows.length) return `<p class="hint">No bottle ${where} carries ${esc(named)} or a grape of the same style. Try another country, a higher price, or tick more stores at the top.</p>`;
  const exact = rows.filter((x) => x.exact).length;
  return `<p class="hint">${rows.length} ${rows.length === 1 ? "bottle" : "bottles"} ${where}: ${exact ? `${exact} of ${esc(named)}` : `none of ${esc(named)}`}${rows.length > exact ? `, ${rows.length - exact} of the same style` : ""}. Best rated first.</p>
    <ul class="somm-bottles">${rows.slice(0, max).map((x) => sommRow(x.w, bottleWhy(x))).join("")}</ul>${rows.length > max ? `<p class="hint">Showing ${max}; narrow by country or price to see others.</p>` : ""}`;
}
function recipeBottlesBox(r) {
  if (!$("somm-stores")?.children.length) renderSommStores(); // a recipe opened from a wine card, before the Sommelier page
  const opts = sommCountries().map(([c, k]) => `<option value="${esc(c)}">${esc(c)} (${k})</option>`).join("");
  return `<div class="somm-rb" data-somm-rb="${esc(recipeKey(r))}">${recipeFamilyHtml(r)}<h5>🍾 Other wines for this dish</h5>
    <p class="hint">The book pours <strong>${esc(expandKeys(r[6] || []).join(", "))}</strong> with it. Other countries make that grape, and grapes of the same style suit the dish too. Choose a country or a price:</p>
    <div class="somm-row"><select data-rb-country aria-label="Country"><option value="">Any country</option>${opts}</select>
      <label class="somm-price">Up to $<input type="number" data-rb-price min="0" step="1" inputmode="numeric" placeholder="any"></label></div>
    <div class="somm-rb-out">${recipeBottlesHtml(r, {})}</div></div>`;
}
function refreshRecipeBottles(box) {
  const r = recipeByKey(box.dataset.sommRb);
  if (!r) return;
  const v = parseFloat(box.querySelector("[data-rb-price]").value);
  box.querySelector(".somm-rb-out").innerHTML = recipeBottlesHtml(r, { country: box.querySelector("[data-rb-country]").value, maxPrice: Number.isFinite(v) && v > 0 ? v : null });
}
const refreshRecipeBottlesSoon = debounce(refreshRecipeBottles, 300);
document.addEventListener("change", (e) => { const box = e.target.closest?.(".somm-rb"); if (box && e.target.matches("[data-rb-country]")) refreshRecipeBottles(box); });
document.addEventListener("input", (e) => { const box = e.target.closest?.(".somm-rb"); if (box && e.target.matches("[data-rb-price]")) refreshRecipeBottlesSoon(box); });
// the bottles are worked out only when a recipe is opened, and the choices (country, price)
// are thrown away when it's closed, so the next recipe starts clean
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (!d.matches?.("details.somm-recipe")) return;
  if (!d.open) { d.querySelector(".somm-rb")?.remove(); return; }
  if (d.querySelector(".somm-rb")) return;
  const r = recipeByKey(d.dataset.recipe);
  if (!r) return;
  d.querySelector(".somm-recipe-body")?.insertAdjacentHTML("beforeend", recipeBottlesBox(r));
  const sel = d.querySelector("[data-rb-country]"); if (sel) sel.value = "";
}, true);

// Print one recipe: the page's print area (the same one the Short List prints through)
// gets the recipe alone, then the browser's print dialog opens.
function printRecipe(r) {
  const x = RECIPES[recipeKey(r)];
  if (!x) return;
  $("print-area").innerHTML = `<h1>${esc(r[0])}</h1>
    <p>${esc(ref(r[1], r[2]))}${r[6]?.length ? ` · with ${esc(r[6].join(", "))}` : ""}${x.s || x.t ? ` · ${esc([x.s, x.t].filter(Boolean).join(" · "))}` : ""}</p>
    ${r[7] ? `<p><strong>Why it suits the wine:</strong> ${esc(r[7])}</p>` : ""}
    <h2>Ingredients</h2><ul class="pa-ing">${x.i.map((l) => /:\s*$/.test(l) ? `<li class="pa-ing-h">${esc(l)}</li>` : `<li>${esc(l)}</li>`).join("")}</ul>
    <h2>Method</h2><ol>${x.m.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="pa-foot">Ingredients as printed in ${esc(ref(r[1], r[2]))}; the method is in our own words. Printed from Basil's Wine Finder, ${new Date().toLocaleDateString()}.</p>`;
  $("print-area").dataset.custom = "recipe"; // so the Short List doesn't overwrite it when the print dialog opens
  window.print();
  setTimeout(() => { delete $("print-area").dataset.custom; }, 2000); // in case afterprint never fires
}
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-somm-print]");
  if (!b) return;
  const r = recipeByKey(b.dataset.sommPrint);
  if (r) printRecipe(r);
});

const pickSection = (w) => { const pick = recipePickHtml(w, null, 3, 0); return pick ? `<h4>📖 For the foods this wine suits best</h4>${pick}` : ""; };
function recipeButton(dish, wine = "") {
  return `<button type="button" class="btn btn-recipe" data-somm-recipe="${esc(dish)}" data-somm-recipe-wine="${esc(wine)}">🍳 Ask Claude for a recipe (opens claude.ai)</button>`;
}
function recipesHtml(list, max = 6, title = "Recipes from the books") {
  if (!list.length) return "";
  const byCourse = {};
  for (const r of list) (byCourse[r[4] || "main"] ||= []).push(r);
  const parts = Object.keys(COURSES).filter((c) => byCourse[c]).map((c) =>
    `<div class="somm-course"><span>${COURSES[c]}</span>${byCourse[c].slice(0, max).map(recipeHtml).join("")}</div>`);
  return `<h4>📖 ${title}</h4>${parts.join("")}`;
}
const OTHER_STYLES = new Set(["Sparkling", "Champagne", "Rosé", "Sauternes", "Late-harvest white", "Port", "Madeira", "Tokaji", "Ice wine"]);
// The recipes for a wine, best first: the grape the book pours, then grapes of the same style,
// then anything for that food in the wine's colour. Each tier starts somewhere different for
// each wine and each day, so wines of one grape don't all open on the same dish.
function recipeChoices(w, food = null) {
  const keys = bookKeys(w), sweet = isSweetWine(w), alike = sameStyleAs(keys);
  const foods = food ? [food] : foodsOf(w).filter((f) => wineTier(w, f) > 1);
  const fits = (r) => r[4] !== "side" && (foods.includes(r[3]) || (!food && sweet && r[4] === "dessert"));
  const seed = [...String(w.id) + new Date().toDateString()].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 100003, 7);
  const turn = (list) => { const k = seed % (list.length || 1); return [...list.slice(k), ...list.slice(0, k)]; };
  const pool = (SOMM?.recipes || []).filter(fits).map((r) => ({ r, want: expandKeys(r[6] || []) }));
  const exact = pool.filter((x) => x.want.some((k) => keys.includes(k)));
  const near = pool.filter((x) => !exact.includes(x) && x.want.some((k) => alike.has(k)));
  const other = pool.filter((x) => !exact.includes(x) && !near.includes(x) && x.want.some((g) => grapeFits(w, g) && !OTHER_STYLES.has(g)));
  return [...turn(exact).map((x) => ({ ...x, tier: "exact" })),
    ...turn(near).map((x) => ({ ...x, tier: "style", grape: x.want.find((k) => alike.has(k)) })),
    ...turn(other).map((x) => ({ ...x, tier: "food" }))];
}
const choiceNote = (x, keys) => (x.tier === "exact" ? "" : x.tier === "style"
  ? `<p class="hint">The book pours ${esc(x.want.join(", "))} with this: the same style as ${esc(keys.join(", ") || "this wine")}. ${CLAUDE_TAG}</p>`
  : `<p class="hint">A dish for this food; the book pours ${esc(x.want.join(", "))} with it, not this grape. ${CLAUDE_TAG}</p>`);
// One answer's recipes so far, so neighbouring cards don't show the same dish.
let recipesShown = new Set(), advShown = new Set();
const TIER_HEADS = { exact: "The books pour this wine's grape with these", style: "Same style of wine (Claude's judgement)", food: "Other dishes for this food (Claude's judgement)" };
function recipePickHtml(w, food = null, n = 1, at = null, course = "") {
  const every = recipeChoices(w, food), list = every.filter((x) => !course || x.r[4] === course);
  if (!list.length) return "";
  let i = at;
  if (i == null) { i = list.findIndex((x) => !recipesShown.has(recipeKey(x.r))); if (i < 0) i = 0; }
  const all = n >= list.length;
  const shown = all ? list : Array.from({ length: n }, (_, k) => list[(i + k) % list.length]);
  for (const x of shown) recipesShown.add(recipeKey(x.r));
  const courses = [...new Set(every.map((x) => x.r[4]))].filter((c) => COURSES[c]);
  let tier = "exact";
  const rows = shown.map((x) => { const head = x.tier !== tier ? `<p class="hint">${esc(TIER_HEADS[x.tier])}</p>` : ""; tier = x.tier; return head + recipeHtml(x.r); });
  return `<div class="somm-recipe-pick" data-pick-wine="${esc(w.id)}" data-pick-food="${esc(food || "")}" data-pick-n="${n}" data-pick-at="${i}" data-pick-course="${esc(course)}">
    ${rows.join("")}
    ${!all || courses.length > 1 ? `<div class="somm-row somm-pick-nav">
      ${!all && n === 1 ? `<button type="button" class="btn btn-mini" data-pick-next>Another recipe</button>` : ""}
      ${!all ? `<button type="button" class="btn btn-mini" data-pick-all>Show all ${list.length} recipes</button>` : ""}
      ${courses.length > 1 ? `<select data-pick-course-choice aria-label="Course"><option value="">Any course</option>${courses.map((c) => `<option value="${esc(c)}"${c === course ? " selected" : ""}>${esc(COURSES[c])}</option>`).join("")}</select>` : ""}</div>` : ""}</div>`;
}
function redrawPick(box, at, course, n = +box.dataset.pickN) {
  const id = box.dataset.pickWine; // a wine typed by hand is on no list
  const w = findWine(id) || shopping.find((x) => x.id === id) || (wineNow?.w.id === id ? wineNow.w : null);
  if (w) box.outerHTML = recipePickHtml(w, box.dataset.pickFood || null, n, at, course);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-pick-all]");
  if (b) { const box = b.closest(".somm-recipe-pick"); redrawPick(box, 0, box.dataset.pickCourse, 9999); }
  const nx = e.target.closest?.("[data-pick-next]");
  if (nx) { const box = nx.closest(".somm-recipe-pick"), up = box.parentElement, i = [...up.children].indexOf(box);
    redrawPick(box, +box.dataset.pickAt + 1, box.dataset.pickCourse, 1);
    up.children[i]?.querySelector("details.somm-recipe")?.setAttribute("open", ""); }
});
document.addEventListener("change", (e) => {
  if (e.target.matches?.("[data-pick-course-choice]")) redrawPick(e.target.closest(".somm-recipe-pick"), 0, e.target.value);
});
// A wine card's Food pairings: its country's own table, then recipes for the foods it suits best.
function cardRecipesHtml(w) {
  if (!w.name) return "";
  const local = localRows(w.country, w);
  const localHtml = local.length ? `<h4>From ${esc(w.country)}'s own table ${CLAUDE_TAG}</h4><ul class="pair-fold-list">${local.map((r) => `<li>${esc(capFirst(r.dishes))}.</li>`).join("")}</ul>` : "";
  const pick = recipePickHtml(w, null, 3, 0);
  return localHtml + (pick ? `<h4>📖 Recipes for this wine</h4>${pick}` : "");
}
const recipePrompt = (dish, wine) => `Please write a recipe for a home cook: ${dish}${wine ? `, to serve with ${wine}` : ""}. ` +
  `Serves 4. List the ingredients with amounts, then short numbered steps with temperatures and times, then one or two lines on why it suits the wine.`;

// ---- Bottles -------------------------------------------------------------------------
function sommStores() {
  return [...document.querySelectorAll("#somm [data-somm-store]:checked")].map((b) => b.value);
}
const sommCellars = () => [...document.querySelectorAll("#somm [data-somm-cellar]:checked")].map((b) => b.value);
const tickedWord = () => (!sommCellars().length ? "the stores ticked" : sommStores().length ? "the stores and cellars ticked" : "the cellars ticked");
function sommPool({ stores, country = "", colour = "", maxPrice = null, cellars = sommCellars() }) {
  const fits = (w) => w.type !== "Sake" && w.type !== "Other" && (!country || w.country === country) && (!colour || w.type === colour) &&
    (w.size_ml == null || w.size_ml >= 375);
  const own = cellars.length ? cellarFindWines().filter((w) => cellars.includes(w.source) && fits(w)) : [];
  return [...own, ...WINES.filter((w) => stores.includes(w.source) && fits(w) && (maxPrice == null || (priceOf(w) ?? Infinity) <= maxPrice))];
}
const byBest = (a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0) || (priceOf(a) ?? 0) - (priceOf(b) ?? 0);
// Where a bottle comes from: a store and its price, or a family cellar (no price) and its drinking window.
const bottleWhere = (w) => (w.kind === "cellar"
  ? `<span class="badge badge-cellar${cellarTone(w.source)}">In ${esc(w.source)}</span> ${drinkTag(w)}`
  : `<strong>${priceHtml(w)}</strong> at ${sourceBadge(w.source)}`);
function sommRow(w, extra = "") {
  const s = familyScore(w) && Math.round(familyScore(w));
  return `<li class="somm-bottle">
    <div class="somm-bottle-main"><div class="sl-name">${esc(w.name)}</div>
      <div>${typePill(w.type)} ${esc([w.country, w.vintage, sizeText(w)].filter(Boolean).join(" · "))}</div>
      <div>${bottleWhere(w)}${s ? ` · <strong>${s}</strong> points` : ""}</div>${extra}</div>
    <div class="hit-buttons">${shoppingButton(w)}${researchButton(w)}</div></li>`;
}
const wineWord = (w) => `${w.name}${sommKeys(w).length ? ` (${sommKeys(w).join(", ")})` : ""}`;

// ---- Route 1: I have a bottle ----------------------------------------------------------
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
    `<p>${typePill(w.type)} ${esc([w.country, w.vintage].filter(Boolean).join(" · "))} · ${bottleWhere(w)}</p>`) +
    `<p class="somm-keys">${keys.length ? `Grape or style: <strong>${esc(keys.join(", "))}</strong>.` : "The grape isn't clear from the name."}${styles}</p>` + borrowedNote(keys, sweet);
  const local = !typed && LOCAL_NOTES[w.country] ? localRows(w.country, w) : [];
  const localHtml = local.length ? `<div class="somm-local-inline"><h4>🍽 From ${esc(w.country)}'s own table ${CLAUDE_TAG}</h4><ul>${local.map((r) => `<li>${esc(capFirst(r.dishes))}.</li>`).join("")}</ul></div>` : "";
  if (!foods.length) return `<div class="somm-card">${head}${localHtml}<p>${keys.length ? `The pairing books don't cover ${esc(keys.join(" or "))}` : "The grape or style can't be told from the name"}, so there's little to go on.${keys.length ? "" : " Try adding the grape (for example “Saperavi”)."} Claude can help: add the wine to the Short List and ask.</p></div>`;
  const rows = foods.map(({ f, t }) => {
    const ds = dishesFor(grapes, f, 8).map((d) => dishForWine(w, d)).filter((d) => d.dish).slice(0, 5);
    const whys = ds.filter((d) => d.why).slice(0, 2).map((d) => `${esc(capFirst(d.why))}${srcSpan(d.b, d.p)}`);
    const src = [...new Set(ds.map((d) => bookName(d.b)))].join(", ");
    return `<li><span class="food-star tier-${t}">${STARS(t)}</span> <strong>${esc(f)}:</strong> ${ds.length
      ? esc(ds.map((d) => d.dish).join(", ")) : esc(typed ? "" : pairDish(w, f) || "")}.${whys.length ? ` ${whys.join(" ")}` : ""}${!whys.length && src ? ` <span class="somm-src">(${esc(src)})</span>` : ""}</li>`;
  }).join("");
  const avoid = avoidsFor(grapes).slice(0, 4).map(avoidLi).join("");
  let bold = "";
  if (!typed && w.type) try {
    const ctx = advContext(w);
    bold = advIdeasOf(w).slice(0, 8).map((r) => `<li>🍷 <strong>${esc(r.food)}:</strong> ${esc(capFirst(r.dish(ctx) || ""))}. ${esc(r.why)}. <span class="somm-src">(${esc(r.src)})</span></li>`).join("");
  } catch { bold = ""; }
  const ch = cheeseFor(grapes), de = dessertFor(grapes), br = bridgesFor(grapes), tips = tipsFor(grapes);
  return `<div class="somm-card${w.type ? ` wine-${esc(w.type)}` : ""}">${head}${localHtml}
    <h4>🍖 Main dishes, by what's on the plate</h4><ul class="somm-foods">${rows}</ul>
    <p class="somm-src">★★★ the go-to · ★★ a common match · ★ pairs, but less often chosen.</p>
    ${br.length ? `<p><strong>🔗 Flavour bridges</strong> (ingredients that tie a dish to ${esc(br[0].k)}): ${esc(br[0].ing.join(", "))}.${srcSpan(br[0].b, br[0].p)}</p>` : ""}
    ${avoid ? `<h4>⚠️ What the books warn against</h4><ul>${avoid}</ul>` : ""}
    ${tips.length ? `<h4>💡 The books' advice</h4><ul>${tips.map(tipLi).join("")}</ul>` : ""}
    ${bold ? `<h4>Adventurous pairings</h4><ul>${bold}</ul>` : ""}
    ${ch.length ? `<p><strong>🧀 Cheese:</strong> ${listRefs(ch)}</p>` : ""}
    ${de.length ? `<p><strong>🍰 Dessert:</strong> ${listRefs(de)}</p>` : ""}
    ${typed ? (grapes.length ? recipesHtml(recipesFor(grapes), 4) : "") : pickSection(w)}
    ${typed ? "" : `<div class="hit-buttons">${shoppingButton(w)}${researchButton(w)}</div>`}</div>`;
}

function countryPairingHtml(country, pool) {
  const byKey = new Map();
  for (const w of pool) for (const k of sommKeys(w)) (byKey.get(k) || byKey.set(k, []).get(k)).push(w);
  const keys = [...byKey].filter(([k]) => knownKey(k)).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  const reg = SOMM?.regions?.[country];
  const local = reg?.foods?.length ? `<p><strong>Local food the books tie to ${esc(country)}'s wines:</strong> ${esc(reg.foods.join(", "))}` +
    ` <span class="somm-src">(${esc(reg.refs.map(([b, p]) => ref(b, p)).join("; "))})</span></p>` : "";
  if (!pool.length) return `<div class="somm-card"><p>No ${esc(country)} wines match those choices in ${tickedWord()}. Try another store, colour or price.</p>${local}${localNotesHtml(country)}</div>`;
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
  return `<p class="somm-summary"><strong>${pool.length}</strong> ${esc(country)} wines in ${tickedWord()}, by grape.</p>${local}${localNotesHtml(country)}${grapeHtml}${styleHtml}`;
}

// ---- A family cellar's answer: what to open first ------------------------------------------
// Bottles sort into four groups by the owner's own drinking window, so the ones that need
// drinking can't sink to the bottom of a long list. Every bottle stays reachable.
const STAGES = {
  first: { icon: "🔴", title: "Drink first", blurb: "Past their drinking window, or ending this year." },
  soon: { icon: "🟠", title: "Drink soon", blurb: "The drinking window ends next year." },
  ready: { icon: "🟢", title: "Ready, no rush", blurb: "Drinking well now, with time left." },
  wait: { icon: "⏳", title: "Not yet", blurb: "Too young: best left for now." },
};
function drinkStage(w) {
  if (w.drink_to && w.drink_to <= THIS_YEAR) return "first";
  if (w.drink_to === THIS_YEAR + 1) return "soon";
  return w.drink_from && w.drink_from > THIS_YEAR ? "wait" : "ready";
}
function drinkTag(w) {
  if (!w.drink_from && !w.drink_to) return "";
  const stage = drinkStage(w), to = w.drink_to;
  const text = stage === "wait" ? `From ${w.drink_from}` : stage === "ready" ? (to ? `Ready, until ${to}` : "Ready")
    : to < THIS_YEAR ? `Window ended ${to}` : `Drink by ${to}`;
  return `<span class="drink-tag drink-${stage}">${STAGES[stage].icon} ${esc(text)}</span>`;
}
// A general guide by style; the books say little about serving.
function servingGuide(w) {
  const look = wineStyle(w), body = look.body?.v, age = w.vintage ? THIS_YEAR - w.vintage : null;
  let tip;
  if (w.type === "Sparkling") tip = "Serve well chilled, 6–8°C.";
  else if (w.type === "Dessert" || w.type === "Fortified" || isSweetWine(w)) tip = "Serve cool, 8–12°C.";
  else if (w.type !== "Red") tip = body === "full" ? "Serve lightly chilled, 10–12°C." : "Serve chilled, 8–10°C.";
  else tip = body === "light" ? "Serve cool, 13–14°C." : "Serve at 16–18°C.";
  if (w.type === "Red" && age != null && age >= 20) tip += " Old wine: open it just before serving and pour gently.";
  else if (w.type === "Red" && (look.tannin?.v === "firm" || body === "full") && (age == null || age <= 12)) tip += " Decant it an hour ahead.";
  return tip;
}
// The food a bottle suits best, for lists with no food chosen.
const bestFood = (w) => foodsOf(w).filter((f) => f !== "Dessert" || isSweetWine(w)).sort((a, b) => wineTier(w, b) - wineTier(w, a))[0] || null;
// A wine's adventurous idea, for this food if it has one: the dish, why it works, how to make it
// work and where the idea comes from. bold: it's the reason this wine is listed at all.
function advIdeaHtml(w, food, bold) {
  try {
    const rules = advIdeasOf(w), from = food ? rules.filter((r) => r.food === food) : rules;
    const at = [...String(w.id) + new Date().toDateString()].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 100003, 7) % (from.length || 1);
    const turned = [...from.slice(at), ...from.slice(0, at)], rule = turned.find((r) => !advShown.has(r)) || turned[0]; // neighbours differ where they can
    if (rule) advShown.add(rule);
    const dish = rule && rule.dish(advContext(w));
    if (!dish) return "";
    const word = (sommKeys(w)[0] || w.type.toLowerCase()).split(/ \/| \(/)[0];
    const why = rule.why.replace(/[:;,]? ?[“"].*$/, "").trim();
    const src = rule.src.replace(/, “[^”]*”/g, "").split(";")[0].trim();
    return `<p class="somm-adv">⚡ <strong>${bold ? "Adventurous:" : "Feeling adventurous?"}</strong> This ${esc(word)} with ${esc(dish)}.${why ? ` ${esc(capFirst(why))}.` : ""}${rule.warn ? ` <em>${esc(capFirst(rule.warn))}.</em>` : ""} <span class="somm-src">(${esc(src)})</span></p>${bold ? `<p>${recipeButton(capFirst(dish), wineWord(w))}</p>` : ""}`;
  } catch { return ""; }
}
// The books' dishes for a bottle; their advice for an off-dry style doesn't fit a dry bottle of the same grape.
function wineDishes(w, f, keys) {
  const offDry = (x) => w.type && sweetV(w) === "dry" && /off.dry|spatlese|spätlese|kabinett/i.test(x);
  const ds = dishesFor(keys, f, 8).map((d) => dishForWine(w, d)).filter((d) => d.dish && !offDry(d.dish)).slice(0, 3);
  return { ds, why: ds.find((d) => d.why && !offDry(d.why)) };
}
function advListHtml(w) {
  const ctx = advContext(w);
  return `<ul class="pair-fold-list">${advIdeasOf(w).slice(0, 8).map((r, k) => `<li><strong>${esc(r.food)}:</strong> ${esc(capFirst(r.dish(ctx) || ""))}. ${esc(r.why.replace(/[:;,]? ?[“"].*$/, "").trim())}.${r.warn ? ` <em>${esc(capFirst(r.warn))}.</em>` : ""} <span class="somm-src">(${esc(r.src.replace(/, “[^”]*”/g, "").split(";")[0].trim())})</span>
    <div><button type="button" class="btn btn-mini" data-adv-recipes="${k}" data-adv-wine="${esc(w.id)}">Show recipes</button></div><div class="somm-adv-out"></div></li>`).join("")}</ul>`;
}
// Recipes for one adventurous idea. The books don't mark recipes adventurous, so these are the
// wine's recipes for that food, any that share the idea's words first.
function advRecipesHtml(w, rule) {
  const dish = rule.dish(advContext(w)) || "", wanted = fold(dish).split(/[^a-z]+/).filter((t) => t.length > 3 && !["with", "such", "even", "other", "served"].includes(t));
  const hits = (x) => { const r = RECIPES[recipeKey(x.r)], hay = fold(`${x.r[0]} ${(r?.i || []).join(" ")}`); return wanted.filter((t) => hay.includes(t)).length; };
  const list = recipeChoices(w, rule.food).map((x) => ({ ...x, n: hits(x) })).sort((a, b) => b.n - a.n);
  const ask = `<p>${recipeButton(capFirst(dish), wineWord(w))}</p>`;
  if (!list.length) return `<p class="hint">The books have no recipe for this.</p>${ask}`;
  return `${list[0].n ? "" : `<p class="hint">The books have no recipe for this exact dish, so here are ${esc(rule.food.toLowerCase())} recipes for this wine.</p>`}${list.slice(0, 5).map((x) => recipeHtml(x.r)).join("")}${list.length > 5 ? `<p class="hint">Showing 5 of ${list.length}.</p>` : ""}${ask}`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest?.("[data-adv-recipes]");
  if (!b) return;
  await loadSomm();
  const w = findWine(b.dataset.advWine), rule = w && advIdeasOf(w)[+b.dataset.advRecipes], out = b.closest("li").querySelector(".somm-adv-out");
  if (!rule) return;
  out.innerHTML = out.innerHTML ? "" : advRecipesHtml(w, rule);
  b.textContent = out.innerHTML ? "Hide recipes" : "Show recipes";
});
function cellarBottleHtml(w, food, reason = "", bold = false) {
  const f = food || bestFood(w), keys = bookKeys(w);
  const { ds, why } = f ? wineDishes(w, f, keys) : { ds: [], why: null };
  const dishes = ds.length ? ds.map((d) => d.dish).join(", ") : f ? pairDish(w, f) : "";
  const count = f && !bold ? recipeChoices(w, f).length : 0, ideas = advIdeasOf(w).length;
  return sommRow(w, `<div class="somm-detail">
    ${reason ? `<p class="somm-reason">${esc(reason)}</p>` : ""}
    ${why && !bold ? `<p><strong>Why it works:</strong> ${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}</p>` : ""}
    ${dishes && !bold ? `<p><strong>${food ? "Dishes to try" : `Best with ${esc(f.toLowerCase())}`}:</strong> ${esc(dishes)}.</p>` : ""}
    ${food || bold ? advIdeaHtml(w, food, bold) : ""}
    <p><strong>How to serve it:</strong> ${esc(servingGuide(w))} <span class="somm-src">(general guide)</span></p>
    ${count ? `<details class="somm-fold"><summary>📖 ${count} ${esc(f.toLowerCase())} ${count === 1 ? "recipe" : "recipes"} for this wine</summary>${recipePickHtml(w, f)}${ds[0] ? `<p>${recipeButton(capFirst(ds[0].dish), wineWord(w))}</p>` : ""}</details>` : ""}
    ${ideas ? `<details class="somm-fold"${bold ? " open" : ""}><summary>⚡ Adventurous ideas for this wine (${ideas})</summary>${advListHtml(w)}</details>` : ""}</div>`);
}
const stageReason = (w) => ({ first: w.drink_to < THIS_YEAR ? `Its window ended in ${w.drink_to}, so open it soon.` : `Its window ends this year.`,
  soon: `Its window ends next year.`, ready: `Drinking well now.`, wait: "" }[drinkStage(w)]);
// The cellar's answer, re-drawn when its colour, country or order changes. rows: [{w, t}].
// what: "for spicy food"; moodLine: the summary's ending for a mood, with no food chosen.
let answerArgs = null, answerOpts = {};
// Any list of wines (cellar, store or both): a tick box on each row for Pairings, sorting on up to
// three columns, and the columns that suit what's in it. rows: [{w, t, bold}].
function cellarAnswerHtml(rows, food, what = "", moodLine = "", title = "", kind = "") {
  answerArgs = { rows, food, what, moodLine, title, kind };
  if (kind !== "find") atLimit = { max: null, same: false };
  const cellar = rows.some((x) => x.w.kind === "cellar");
  answerOpts = { colour: "", country: "", where: "", daring: false, shown: 60,
    sorts: [{ col: cellar ? "drink" : food ? "match" : "score", dir: 1 }, { col: food && cellar ? "match" : "", dir: 1 }, { col: "", dir: 1 }] };
  return `<div id="somm-cellar-answer">${answerBodyHtml()}</div>`;
}
function answerControlsHtml() {
  const { rows, food } = answerArgs, { colour, country, daring } = answerOpts;
  const list = (k) => [...new Set(rows.map((x) => x.w[k]).filter((v) => v && v !== "Country not stated"))].sort();
  const opt = (v, label, on) => `<option value="${esc(v)}"${v === on ? " selected" : ""}>${esc(label)}</option>`;
  return `<div class="somm-row somm-narrow">
    <select data-somm-narrow="colour" aria-label="Colour">${opt("", "Any colour", colour)}${list("type").map((v) => opt(v, v, colour)).join("")}</select>
    <select data-somm-narrow="country" aria-label="Country">${opt("", "Any country", country)}${list("country").map((v) => opt(v, v, country)).join("")}</select>
    ${rows.some((x) => x.w.kind === "cellar") && rows.some((x) => x.w.kind !== "cellar") ? `<select data-somm-narrow="where" aria-label="Where">${opt("", "Cellar and store wines", answerOpts.where)}${opt("cellar", "Cellar wines only", answerOpts.where)}${opt("store", "Store wines only", answerOpts.where)}</select>` : ""}
    ${food ? "" : `<label class="somm-check"><input type="checkbox" data-somm-narrow="daring"${daring ? " checked" : ""}> ⚡ Only wines with an adventurous pairing</label>`}</div>`;
}
const TABLE_WORDS = { name: "name", type: "colour", country: "country", vintage: "vintage", score: "score", match: "best match", drink: "drink window", daring: "adventurous first", bottles: "bottles", price: "price", rep: "producer's reputation", store: "at the store", where: "where it is" };
// What each direction means, for the "Sort by" menus: [first way, reversed].
const DIR_WORDS = { name: ["A to Z", "Z to A"], type: ["A to Z", "Z to A"], country: ["A to Z", "Z to A"], where: ["A to Z", "Z to A"],
  vintage: ["oldest first", "newest first"], score: ["best first", "lowest first"], match: ["best first", "weakest first"],
  drink: ["drink first", "keep longest"], bottles: ["most first", "fewest first"], price: ["cheapest first", "dearest first"],
  rep: ["best first", "lowest first"], store: ["same wine first", "last"], daring: ["adventurous first", "last"] };
const BAND_WORDS = { 1: "under $25", 2: "$25–40", 3: "$40–60", 4: "$60–100", 5: "over $100" };
let bandByName = null;
const cellarBand = (w) => w.pb ?? (bandByName ??= new Map(Object.values(sharedCellars || {}).flatMap((c) => (c?.wines || []).filter((x) => x.pb).map((x) => [fold(x.name), x.pb])))).get(fold(w.name)) ?? null;
const realScore = (w) => { const s = bestScore(w); return s != null && s > 1 ? s : null; };
const matchText = (x) => (x.bold ? "⚡" : x.t ? STARS(x.t) : "");
function sortValue(x, col, isDaring) {
  const w = x.w;
  switch (col) {
    case "name": return fold(w.name);
    case "type": return w.type || "";
    case "country": return w.country || "";
    case "where": return w.kind === "cellar" ? `0 ${w.source}` : `1 ${sourceLabel(w.source)}`;
    case "vintage": return w.vintage ?? 9999;
    case "score": return -(realScore(w) ?? 0);
    case "match": return x.bold ? 0.5 : -(x.t || 0);
    case "bottles": return -(w.quantity || 0);
    case "daring": return isDaring(x) ? 0 : 1;
    case "price": return w.kind === "cellar" ? (cellarBand(w) ? cellarBand(w) * 1000 : 1e9) : (priceOf(w) ?? 1e9);
    case "rep": return -((weIndex && weOf(w)?.[3]) || 0);
    case "store": return atStoreOf(w)?.v ?? 9;
    default: return w.kind === "cellar" ? Object.keys(STAGES).indexOf(drinkStage(w)) * 10000 + (w.drink_to ?? 9999) : 99999;
  }
}
// Kept for the cellar page's own table (one column at a time).
function tableSort(rows, col, dir, isDaring) {
  return sortRows(rows, [{ col, dir }], isDaring);
}
function sortRows(rows, sorts, isDaring) {
  const on = sorts.filter((x) => x.col);
  return rows.map((x) => [x, on.map((o) => sortValue(x, o.col, isDaring)), realScore(x.w) ?? 0]).sort(([a, p, sa], [b, q, sb]) => {
    for (let i = 0; i < on.length; i++) {
      const d = (typeof p[i] === "string" ? p[i].localeCompare(q[i]) : p[i] - q[i]) * on[i].dir;
      if (d) return d;
    }
    return (b.t || 0) - (a.t || 0) || sb - sa;
  }).map(([x]) => x);
}
function wineTableHtml(list, cols, col, dir, isDaring, colAttr = "data-somm-col", headExtra = {}) {
  const cell = (k, x) => { const w = x.w;
    switch (k) {
      case "tick": return `<input type="checkbox" class="pair-tick" data-pair-tick="${esc(w.id)}"${inPairs(w.id) ? " checked" : ""} aria-label="Add ${esc(w.name)} to Pairings">`;
      case "name": return `<button type="button" class="linklike" data-somm-pop="${esc(w.id)}">${esc(w.name)}</button>`;
      case "where": return w.kind === "cellar" ? `<span class="badge badge-cellar${cellarTone(w.source)}">${esc(w.source)}</span>` : sourceBadge(w.source);
      case "price": return w.kind === "cellar" ? (cellarBand(w) ? `<span class="hint-inline">${esc(BAND_WORDS[cellarBand(w)])}</span>` : "") : priceOf(w) != null ? `<strong>${priceHtml(w)}</strong>` : "";
      case "type": return esc(w.type || "");
      case "country": return esc(w.country || "");
      case "vintage": return esc(String(w.vintage ?? "NV"));
      case "score": return realScore(w) != null ? `<strong>${Math.round(realScore(w))}</strong>` : "";
      case "match": return matchText(x);
      case "rep": { const p = w.kind !== "cellar" && weIndex ? weOf(w) : null; return p ? `<span title="${esc(`${p[0]}: average of ${p[2]} Wine Enthusiast reviews`)}">${p[3]}</span>` : ""; }
      case "store": return atStoreHtml(w);
      case "bottles": return w.quantity ? String(w.quantity) : "";
      case "drink": return w.kind === "cellar" ? drinkTag(w) : "";
      default: return isDaring(x) ? "⚡" : "";
    } };
  return `<div class="somm-table-wrap"><table class="somm-table"><thead><tr>${cols.map(([k, label]) => k === "tick" ? `<th scope="col"><span class="visually-hidden">Pairings</span>✓</th>`
      : `<th scope="col"><button type="button" class="linklike" ${colAttr}="${k}" aria-pressed="${col === k}">${esc(label)}${col === k ? (dir > 0 ? " ▲" : " ▼") : ""}</button>${headExtra[k] || ""}</th>`).join("")}</tr></thead>
      <tbody>${list.map((x) => `<tr${inPairs(x.w.id) ? ' class="row-picked"' : ""}>${cols.map(([k]) => `<td${k === "match" ? ' class="somm-match"' : k === "tick" ? ' class="somm-tick"' : k === "name" ? ' class="somm-name"' : ""}>${cell(k, x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function sortControlsHtml(cols) {
  const choices = cols.filter(([k]) => k !== "tick");
  const one = (i) => { const o = answerOpts.sorts[i];
    return `<select data-somm-sort="${i}" aria-label="${i ? "Then by" : "Sort by"}">${i ? `<option value="">nothing</option>` : ""}${choices.map(([k, l]) => `<option value="${k}"${o.col === k ? " selected" : ""}>${esc(l === "⚡" ? "Adventurous" : l)}</option>`).join("")}</select>` +
      (o.col ? `<button type="button" class="btn btn-mini" data-somm-sortdir="${i}">${esc((DIR_WORDS[o.col] || ["up", "down"])[o.dir > 0 ? 0 : 1])} ⇅</button>` : ""); };
  return `<div class="somm-row somm-sorts"><span class="somm-label">Sort by</span>${one(0)}<span class="somm-label">then by</span>${one(1)}<span class="somm-label">then by</span>${one(2)}</div>`;
}
// Banner, then a table to tick and sort. A wine's name opens its card.
function answerBodyHtml() {
  const { food, what, moodLine, title } = answerArgs, { colour, country, daring, sorts, shown } = answerOpts;
  const isDaring = (x) => (food ? !!x.bold : advIdeasOf(x.w).length > 0);
  const where = answerOpts.where;
  const rows = answerArgs.rows.filter((x) => (!colour || x.w.type === colour) && (!country || x.w.country === country) && (!daring || isDaring(x)) &&
    (!where || (where === "cellar") === (x.w.kind === "cellar")));
  const list = sortRows(rows, sorts, isDaring);
  const n = list.length, daringN = food ? rows.filter((x) => x.bold).length : 0;
  const all = answerArgs.rows, hasCellar = all.some((x) => x.w.kind === "cellar"), hasStore = all.some((x) => x.w.kind !== "cellar");
  const st = sommStores(), urgent = rows.filter((x) => x.w.kind === "cellar" && ["first", "soon"].includes(drinkStage(x.w))).length;
  const mode = food ? { classic: "Classic matches", bold: "Classic and adventurous", only: "Adventurous only" }[document.querySelector("#somm [name=somm-daring]:checked")?.value] : "";
  const names = [...new Set(all.map((x) => (x.w.kind === "cellar" ? x.w.source : sourceLabel(x.w.source))))];
  const head = [food ? capFirst(what.replace(/^for /, "")) : title, mode, andWords(names)].filter(Boolean).join(" · ");
  const count = !n ? "Nothing fits these choices." : `${n.toLocaleString()} ${n === 1 ? "wine" : "wines"}${daringN && daringN < n ? `: ${n - daringN} classic, ${daringN} adventurous` : daringN ? ", all adventurous" : ""}.${hasCellar && food ? urgent ? ` ${urgent} should be drunk soon.` : " None is urgent." : ""}`;
  const cols = [["tick", "✓"], ["name", "Wine"], ...(hasCellar && hasStore ? [["where", "Where"]] : []),
    ["price", hasStore ? (hasCellar ? "Price or band" : "Price") : "Price band"], ["type", "Colour"], ["country", "Country"], ["vintage", "Vintage"], ["score", "Score"],
    ...(food ? [["match", "Match"]] : []), ...(hasStore ? [["rep", "Producer"]] : []),
    ...(hasCellar && st.length ? [["store", `At ${st.length === 1 ? (st[0] === "LCBO" ? "the LCBO" : sourceLabel(st[0])) : "the stores"}`]] : []),
    ...(hasCellar ? [["bottles", "Bottles"], ["drink", "Drink window"]] : []), ["daring", "⚡"]];
  const said = sorts.filter((o) => o.col).map((o) => `${TABLE_WORDS[o.col] || o.col} (${(DIR_WORDS[o.col] || ["", ""])[o.dir > 0 ? 0 : 1]})`).join(", then ");
  const page = list.slice(0, shown);
  return `<div class="somm-selection"><p class="somm-sel-head">${esc(head)}</p><p class="somm-sel-count">${esc(count)}</p>
      <p>${moodLine ? `${esc(capFirst(`These wines ${moodLine}`))} ` : ""}Sorted by <strong>${esc(said)}</strong>. Tick the wines you want, then press <strong>See pairings</strong>. A wine's name opens its card.</p>
      ${hasCellar ? `<p class="hint">Drinking dates are the cellar owner's own.${hasCellar && st.length ? ` At the store: ✓ the same wine and vintage, ≈ another vintage, or how many of the producer's wines the store has.` : ""}</p>` : ""}
      ${hasStore ? `<p class="hint">Producer: the producer's average in Wine Enthusiast's reviews, a reputation rather than this bottle's score.</p>` : ""}
      ${all.length > 1 ? answerControlsHtml() + sortControlsHtml(cols) : ""}</div>
    <div class="somm-pairbar pairbar-slot" hidden></div>
    ${n ? wineTableHtml(page, cols, sorts[0].col, sorts[0].dir, isDaring) : ""}
    ${n > page.length ? `<p><button type="button" class="btn" data-somm-more>Show ${Math.min(60, n - page.length)} more (${(n - page.length).toLocaleString()} left)</button></p>` : ""}`;
}
function redrawAnswer() {
  const box = $("somm-cellar-answer");
  if (!box) return;
  const y = window.scrollY;
  box.innerHTML = answerBodyHtml();
  renderPairBar();
  window.scrollTo(0, y);
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches?.("#somm-cellar-answer [data-somm-narrow]")) {
    answerOpts[t.dataset.sommNarrow] = t.type === "checkbox" ? t.checked : t.value;
    answerOpts.shown = 60;
  } else if (t.matches?.("#somm-cellar-answer [data-somm-sort]")) {
    const i = +t.dataset.sommSort;
    answerOpts.sorts[i] = { col: t.value, dir: 1 };
    if (!answerOpts.sorts[0].col) answerOpts.sorts[0] = { col: "name", dir: 1 };
  } else if (t.matches?.("[data-pair-tick]")) {
    const id = t.dataset.pairTick;
    if (t.checked !== inPairs(id)) togglePair(id);
    if (t.checked && !inPairs(id)) { t.checked = false; for (const b of document.querySelectorAll(".pairbar-slot, #somm-pairbar")) if (!b.hidden) b.insertAdjacentHTML("beforeend", ` <strong class="status">Only ${PAIR_MAX} at a time: untick one first.</strong>`); }
    t.closest("tr")?.classList.toggle("row-picked", inPairs(id));
    return;
  } else return;
  redrawAnswer();
});
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("#somm-cellar-answer [data-somm-sortdir], #somm-cellar-answer [data-somm-more]");
  if (!t) return;
  if (t.dataset.sommSortdir != null) { const o = answerOpts.sorts[+t.dataset.sommSortdir]; o.dir = -o.dir; }
  else answerOpts.shown += 60;
  redrawAnswer();
});
const needCellar = () => `<div class="somm-card"><p>Tick a cellar under <strong>Where are the bottles?</strong> first.</p></div>`;
// The middle of the owner's drinking window: a rough guide, since wines age differently.
function atPeak(w) {
  if (!w.drink_from || !w.drink_to || w.drink_to <= w.drink_from) return false;
  const along = (THIS_YEAR - w.drink_from) / (w.drink_to - w.drink_from);
  return along >= 0.35 && along <= 0.75;
}
const openable = (w) => drinkStage(w) !== "wait";
const MOODS = {
  all: { icon: "📋", label: "All the wines", line: "make up the whole list.", test: () => true },
  first: { icon: "🔴", label: "Drink first", line: "should be drunk soon.", test: (w) => ["first", "soon"].includes(drinkStage(w)) },
  peak: { icon: "🎯", label: "At their peak", line: "are in the middle of their drinking window: a rough guide to their best.", test: atPeak },
  treasures: { icon: "🏆", label: "The treasures", line: "score 95 or more and are ready to open.", test: (w) => openable(w) && (bestScore(w) ?? 0) >= 95 },
  old: { icon: "🕰", label: "Old and wise", line: "are 15 years or older and ready to open.", test: (w) => openable(w) && w.vintage && THIS_YEAR - w.vintage >= 15 },
  light: { icon: "🍃", label: "Light and easy", line: "are light-bodied and ready to open.", test: (w) => openable(w) && wineStyle(w).body.v === "light" },
  bold: { icon: "🔥", label: "Big and bold", line: "are full-bodied and ready to open.", test: (w) => openable(w) && wineStyle(w).body.v === "full" },
  sweet: { icon: "🍯", label: "A touch of sweetness", line: "have some sweetness and are ready to open.", test: (w) => openable(w) && ["off-dry", "medium-sweet", "sweet"].includes(wineStyle(w).sweet.v) },
  daring: { icon: "⚡", label: "Something adventurous", line: "have a surprising food match and are ready to open.", test: (w) => openable(w) && boldFoodsOf(w).length > 0 },
};
function moodHtml(key) {
  if (!sommCellars().length) return needCellar();
  const m = MOODS[key], rows = sommPool({ stores: [] }).filter(m.test).map((w) => ({ w, t: 0 }));
  return cellarAnswerHtml(rows, null, "", m.line, m.label);
}
// "Help me choose" (in Find a wine) is there only with a cellar ticked; each button counts the cellars ticked.
function renderMoods() {
  const box = $("somm-moods"), help = $("somm-help-choose");
  if (!box || !help) return;
  renderCellarPick();
  for (const id of ["somm-cook-next", "somm-daring"]) if ($(id)) $(id).hidden = !sommCellars().length; // adventurous matches are for the cellars
  if ($("somm-cook-filters")) { // with a cellar ticked, colour and country sit with the answer
    $("somm-cook-filters").hidden = !!sommCellars().length;
    if (sommCellars().length) $("somm-cook-country").selectedIndex = $("somm-cook-colour").selectedIndex = 0;
  }
  renderFindIntro(); renderFindFilters(); renderDinnerQ(); renderPairBar();
  if ($("somm-cook-price-l")) $("somm-cook-price-l").hidden = !sommStores().length;
  help.hidden = !sommCellars().length;
  if (help.hidden) return;
  const pool = sommPool({ stores: [] }), st = sommStores();
  // with a store ticked too: how many of each pick that store sells (same wine, any vintage)
  const buyable = st.length ? new Set(pool.filter((w) => ["exact", "vintage"].includes(atStoreOf(w, { max: null, same: false })?.kind)).map((w) => w.id)) : null;
  box.innerHTML = Object.entries(MOODS).map(([k, m]) => { const ws = pool.filter(m.test), at = buyable ? ws.filter((w) => buyable.has(w.id)).length : 0;
    return `<button type="button" class="btn btn-mood${findF.preset === k ? " btn-mood-on" : ""}" data-somm-mood="${k}" aria-pressed="${findF.preset === k}">${findF.preset === k ? "✓ " : ""}${m.icon} ${esc(m.label)} <span class="tap-n">${ws.length}${buyable ? ` · ${at} at ${esc(theStore(st))}` : ""}</span></button>`; }).join(" ") +
    ` <button type="button" class="btn btn-mood" data-somm="surprise">🎲 Surprise me</button>` +
    (findF.preset ? `<p class="somm-preset-on">Showing <strong>${esc(MOODS[findF.preset].label)}</strong> only (wines that ${esc(MOODS[findF.preset].line.replace(/\.$/, ""))}). Everything below narrows this list.
      <button type="button" class="linklike" data-somm-mood="${findF.preset}">✕ Show all of ${esc(andWords(sommCellars()))}'s wines</button></p>` : "");
}
// I have a bottle: the ticked cellars' wines to choose from, what needs drinking first at the top.
function renderCellarPick() {
  const box = $("somm-cellar-list"), cels = sommCellars();
  if (!box) return;
  box.hidden = !cels.length;
  if ($("somm-cellar-hint")) $("somm-cellar-hint").hidden = !!cels.length || !cellarSources().length;
  if (box.hidden) return;
  const order = Object.keys(STAGES), wines = sommPool({ stores: [] }).slice().sort((a, b) => order.indexOf(drinkStage(a)) - order.indexOf(drinkStage(b)) || a.name.localeCompare(b.name));
  box.innerHTML = `<h4>Choose a wine from ${esc(cels.join(" or "))}</h4>
    <select id="somm-cellar-pick" aria-label="Choose a wine"><option value="">Choose a wine (${wines.length})…</option>${Object.entries(STAGES).map(([k, st]) => {
      const list = wines.filter((w) => drinkStage(w) === k);
      return list.length ? `<optgroup label="${st.icon} ${esc(st.title)}">${list.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</optgroup>` : "";
    }).join("")}</select>`;
}
document.addEventListener("change", async (e) => {
  if (e.target.id !== "somm-cellar-pick" || !e.target.value) return;
  await loadSomm();
  const w = findWine(e.target.value);
  if (w) { showOut(wineStartHtml(w)); fillStory(w); }
});
// In words, what the answers below will choose from.
function renderUsing() {
  if ($("somm-stores").children.length) storeSet("wf.sommSources", { stores: sommStores(), cellars: sommCellars() });
  const names = [...sommCellars(), ...sommStores().map(sourceLabel)];
  const text = names.length ? names.join(", ") : "";
  $("somm-using").innerHTML = text ? `<strong>Using:</strong> ${esc(text)}` : `<strong>Nothing ticked.</strong> Tick a cellar or a store above.`;
  renderTrail();
}
function runCook() {
  const food = document.querySelector("#somm [name=somm-food]:checked")?.value;
  if (!food) { $("somm-cook-msg").textContent = "Choose what you're cooking first."; return; }
  $("somm-cook-msg").textContent = "";
  showOut(cookHtml({ food, dish: $("somm-dish").value.trim(), stores: sommStores(), country: $("somm-cook-country").value,
    colour: $("somm-cook-colour").value, maxPrice: sommNum("somm-cook-price") }));
}
// Choosing the food is the question: the answer follows at once.
document.addEventListener("change", async (e) => {
  if (!e.target.matches?.("#somm [name=somm-food], #somm [name=somm-daring]")) return;
  if (!document.querySelector("#somm [name=somm-food]:checked")) return;
  await loadSomm();
  if (sommStores().length) await loadWe(); // the Producer column needs the reviews
  runCook();
});
function runFridge() {
  const text = $("somm-fridge").value.trim();
  if (!wineNow) return showWineFood(pairsFridgeHtml(text), text ? `the fridge: ${text}` : "");
  for (const b of document.querySelectorAll("#somm [data-wine-food]")) b.setAttribute("aria-pressed", "false");
  showWineFood(fridgeHtml(wineNow.w, text), text ? `the fridge: ${text}` : "");
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "somm-fridge") { e.preventDefault(); loadSomm().then(runFridge); } });
// Every box and choice on the page back to how it starts. Start over (top bar) uses it too, with
// jump false. The stores and cellars ticked in step 1 stay: they say where the bottles are.
function startAgain(jump = true) {
  for (const w of pairList.slice()) togglePair(w.id); // a fresh start carries no old picks
  resetChoices();
  sommTab("", true);
  if (jump) $("somm-h").scrollIntoView({ block: "start" });
}
// Every answer and choice in steps 3 and 4 back to how it starts (step 1's ticks stay).
function resetChoices() {
  wineNow = null; lastMenu = null;
  if ($("somm-cellar-pick")) $("somm-cellar-pick").value = "";
  for (const el of document.querySelectorAll("#somm [name=somm-food]:checked")) el.checked = false;
  for (const id of ["somm-q", "somm-dish", "somm-price", "somm-cook-price", "somm-menu-price"]) if ($(id)) $(id).value = "";
  for (const id of ["somm-country", "somm-colour", "somm-cook-country", "somm-cook-colour", "somm-menu-country", "somm-cmp-protein"]) if ($(id)) $(id).selectedIndex = 0;
  for (const [name, v] of [["somm-protein", ""], ["somm-nwines", "one"], ["somm-special", ""]]) { const r = document.querySelector(`#somm [name=${name}][value="${v}"]`); if (r) r.checked = true; }
  for (const b of document.querySelectorAll("#somm [data-somm-avoid]")) b.checked = false;
  if ($("somm-guests")) $("somm-guests").value = "";
  for (const b of document.querySelectorAll("#somm [data-somm-course]")) b.checked = b.value === "main";
  for (const b of document.querySelectorAll("#somm [data-somm-cmp-course]")) b.checked = b.value !== "starter";
  dinnerAnchors = []; dinnerOpts = null; dinnerFixed = null; findF = { ...FIND0 };
  renderFindFilters();
  const classic = document.querySelector("#somm [name=somm-daring][value=classic]");
  if (classic) classic.checked = true;
  for (const id of ["somm-hits", "somm-country-msg", "somm-cook-msg"]) if ($(id)) $(id).innerHTML = "";
  if ($("somm-stores")?.children.length) renderSommComparison(); // its ticks back on
}
// One good bottle for tonight: from the best of what's ready, the urgent ones favoured.
function surpriseHtml() {
  if (!sommCellars().length) return needCellar();
  const weight = (w) => (bestScore(w) ?? 85) + ({ first: 6, soon: 3 }[drinkStage(w)] || 0);
  const pool = sommPool({ stores: [] }).filter((w) => drinkStage(w) !== "wait").sort((a, b) => weight(b) - weight(a)).slice(0, 25);
  if (!pool.length) return `<div class="somm-card"><p>Nothing in these cellars is ready yet.</p></div>`;
  const w = pool[Math.floor(Math.random() * pool.length)];
  return `<div class="somm-card somm-top"><h4>🎲 Tonight, how about…</h4><ul class="somm-bottles">${cellarBottleHtml(w, null, stageReason(w))}</ul>
    <button type="button" class="btn" data-somm="surprise">Another one</button></div>`;
}
function printOut(title = "From the family's cellars") {
  const copy = $("somm-out").cloneNode(true);
  for (const el of copy.querySelectorAll("button, .hit-buttons, .somm-recipe-pick, details, input, select")) el.remove();
  $("print-area").innerHTML = `<div class="pa-big"><h1>${esc(title)}</h1>${copy.innerHTML}
    <p class="pa-foot">Printed from Basil's Wine Finder, ${new Date().toLocaleDateString()}.</p></div>`;
  $("print-area").dataset.custom = "somm";
  window.print();
  setTimeout(() => { delete $("print-area").dataset.custom; }, 2000);
}

// ---- One wine, then one food: "What have you got?" -----------------------------------------
// Choosing a wine asks what's in the kitchen. A food tile or the fridge box then answers for this
// wine with that food; the full write-up waits under "More about this wine".
let wineNow = null; // { w, typed }
const FOOD_ICONS = { "Red meat": "🥩", Lamb: "🐑", Pork: "🐖", Chicken: "🍗", Fish: "🐟", Seafood: "🦐", "Pasta and pizza": "🍝", Cheese: "🧀", "Spicy food": "🌶️", Dessert: "🍰" };
const foodIcon = (f) => (FOOD_ICONS[f] ? `<span class="food-icon" aria-hidden="true">${FOOD_ICONS[f]}</span> ` : "");
function foodRating(w, typed, f) {
  const keys = bookKeys(sommKeys(w), !typed && isSweetWine(w));
  if (typed) { const t = Math.max(0, ...keys.map((k) => grapeFoodTier(k, f))); return t > 1 ? { t } : keys.length ? { stretch: true } : {}; }
  if (foodsOf(w).includes(f)) return { t: Math.max(1, wineTier(w, f)) };
  return advIdeasOf(w).some((r) => r.food === f) ? { bold: true } : { stretch: true };
}
const ratingText = (r) => (r.t ? STARS(r.t) : r.bold ? "⚡" : r.stretch ? "a stretch" : "");
// The answer to "what suits this wine best?", before any question is asked.
function bestWithHtml(w, typed) {
  const keys = bookKeys(sommKeys(w), !typed && isSweetWine(w));
  const best = FOODS.map((f) => ({ f, t: foodRating(w, typed, f).t || 0 })).filter((x) => x.t > 1).sort((a, b) => b.t - a.t);
  if (!best.length) return "";
  const line = ({ f }) => { const { ds } = wineDishes(w, f, keys), dishes = ds.length ? ds.map((d) => d.dish).join(", ") : typed ? "" : pairDish(w, f);
    return `<li>${foodIcon(f)}<button type="button" class="linklike" data-wine-food="${esc(f)}">${esc(f)}</button>${dishes ? `: ${esc(dishes)}` : ""}</li>`; };
  return `<div class="somm-best"><h4>Best with</h4><ul>${best.slice(0, 3).map(line).join("")}</ul>${best.length > 3 ? `<p class="hint">And ${best.length - 3} more below. Click a food for why it works and its recipes.</p>` : `<p class="hint">Click a food for why it works and its recipes.</p>`}</div>`;
}
function wineStartHtml(w, typed = false, fromList = false) {
  wineNow = { w, typed };
  const order = (x) => { const r = foodRating(w, typed, x); return r.t ? 4 - r.t : r.bold ? 4 : 5; };
  const tiles = FOODS.slice().sort((a, b) => order(a) - order(b)).map((f) =>
    `<button type="button" class="somm-food" data-wine-food="${esc(f)}" aria-pressed="false">${foodIcon(f)}${esc(f)} <span class="tile-rate">${ratingText(foodRating(w, typed, f))}</span></button>`).join("");
  return `<div id="somm-wine-answer">
    <p class="somm-trail"><strong>${esc(w.name)}</strong> <span id="somm-trail-food"></span>
      <button type="button" class="btn btn-mini" data-somm="other-food" id="somm-other-food" hidden>Choose another food</button>
      ${fromList ? `<button type="button" class="btn btn-mini" data-somm="back-list">Back to the list</button>` : `<button type="button" class="btn btn-mini" data-somm="other-wine">Choose another wine</button>`}</p>
    ${typed ? "" : `<p>${typePill(w.type)} ${esc([w.country, w.vintage].filter(Boolean).join(" · "))} · ${bottleWhere(w)}${familyScore(w) ? ` · <strong>${Math.round(familyScore(w))}</strong> points` : ""}</p><div class="hit-buttons">${pairButton(w)}${shoppingButton(w)}${researchButton(w)}</div>`}
    ${mainCoursesHtml(w, typed)}<div id="somm-at-store"></div>
    <div class="somm-way"><h4>Thinking of something else?</h4>
      <p class="hint">★ a classic match · ⚡ an adventurous one. Tap a food, or type what's in the fridge, to see how it goes with this wine.</p>
      <div class="somm-foods-pick">${tiles}</div>
      <label class="somm-label" for="somm-fridge">Or type what's in the fridge <span class="hint-inline">(for example pork, apples)</span></label>
      <div class="somm-row"><input type="text" id="somm-fridge" autocomplete="off"> <button type="button" class="btn btn-somm" data-somm="fridge">Find recipes</button></div></div>
    <div id="somm-wine-food"></div>
    ${!typed && advIdeasOf(w).length ? `<details class="somm-fold"><summary>⚡ Adventurous ideas for this wine (${Math.min(8, advIdeasOf(w).length)})</summary>${advListHtml(w)}</details>` : ""}
    <details class="somm-more"><summary>More about this wine and its pairings<span class="pair-more" aria-hidden="true"></span></summary><div id="somm-story"></div>${winePairingHtml(w, typed)}</details></div>`;
}
// Says what the recipes below are: the adventurous part is the wine with this food, not the recipe.
function recipesHeading(w, f, r) {
  const first = recipeChoices(w, f)[0], word = (sommKeys(w)[0] || "").split(/ \/| \(/)[0];
  const what = first?.tier === "exact" && word ? `${esc(f)} recipes the books pour with ${esc(word)}` : `${esc(f)} recipes for this wine`;
  return r.bold ? `⚡ Adventurous match: ${what}` : `📖 ${what}`;
}
// The story from a Claude write-up: this wine's own, or another vintage's, and it says which.
async function fillStory(w) {
  const note = !w.name || w.kind === "typed" ? null : notesFor(w)[0];
  if (!note) return;
  let text = note.text;
  if (!text) try { text = (await fetch(`${NOTES_DIR}/${encodeURIComponent(sharedIdOf(note.id) || note.id)}.json`, FRESH).then((r) => r.json())).text; } catch { return; }
  const m = /\*\*The story\.?\*\*\s*([\s\S]*?)(?:\n\n|$)/.exec(text || "");
  const box = $("somm-story");
  if (!m || !box || wineNow?.w !== w) return;
  box.innerHTML = `<div class="somm-card"><h4>The story</h4>${hasOwnResearch(w) ? "" : `<p class="hint">From Claude's write-up on ${esc(note.name || "another vintage")}.</p>`}<p>${mdInline(m[1])}</p></div>`;
}
function wineFoodHtml(w, typed, f) {
  const r = foodRating(w, typed, f), keys = bookKeys(sommKeys(w), !typed && isSweetWine(w));
  const { ds, why } = wineDishes(w, f, keys);
  const dishes = ds.length ? ds.map((d) => d.dish).join(", ") : typed ? "" : pairDish(w, f);
  const verdict = r.t ? `${STARS(r.t)} A classic match.` : r.bold ? "⚡ An adventurous match." : r.stretch ? "Not a natural match, so these are the closest ideas." : "";
  const adv = !typed && r.bold ? advIdeaHtml(w, f, true) : "";
  const pick = recipePickHtml(w, f, 3, 0);
  return `<div class="somm-card"><h3 class="somm-wine-h">${foodIcon(f)}This wine with ${esc(f.toLowerCase())}</h3>
    ${verdict ? `<p class="somm-reason">${esc(verdict)}</p>` : ""}
    ${why ? `<p><strong>Why it works:</strong> ${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}</p>` : ""}
    ${dishes && !r.bold ? `<p><strong>Dishes to try:</strong> ${esc(dishes)}.</p>${ds[0] ? `<p>${recipeButton(capFirst(ds[0].dish), wineWord(w))}</p>` : ""}` : ""}
    ${adv}
    ${typed ? "" : `<p><strong>How to serve it:</strong> ${esc(servingGuide(w))} <span class="somm-src">(general guide)</span></p>`}
    ${pick ? `<h4>${recipesHeading(w, f, r)}</h4>${pick}` : !keys.length && typed
      ? `<p class="hint">The grape can't be told from the name, so these aren't matched to this wine.</p>${recipesHtml(recipesFor([], f), 4, `${f} recipes from the books`)}`
      : `<p>The books have no ${esc(f.toLowerCase())} recipe for this wine.</p>`}</div>`;
}
// The fridge box: recipes that use what's typed, most of it first, then the best match for the wine.
function fridgeHtml(w, text) {
  const wanted = fold(text).split(/[^a-z]+/).filter((t) => t.length > 2).map((t) => t.replace(/s$/, ""));
  if (!wanted.length) return `<div class="somm-card"><p>Type something from the fridge first, such as pork.</p></div>`;
  const keys = bookKeys(w), alike = sameStyleAs(keys), rank = { exact: 0, style: 1, food: 2, other: 3 };
  const rows = (SOMM?.recipes || []).map((r) => {
    const x = RECIPES[recipeKey(r)];
    if (!x) return null;
    const hay = fold(`${r[0]} ${(x.i || []).join(" ")}`), found = wanted.filter((t) => hay.includes(t)).length;
    if (!found) return null;
    const want = expandKeys(r[6] || []);
    const tier = want.some((k) => keys.includes(k)) ? "exact" : want.some((k) => alike.has(k)) ? "style" : want.some((g) => grapeFits(w, g) && !OTHER_STYLES.has(g)) ? "food" : "other";
    return { r, want, tier, found };
  }).filter(Boolean).sort((a, b) => b.found - a.found || rank[a.tier] - rank[b.tier]);
  if (!rows.length) return `<div class="somm-card"><p>No recipe in the books uses ${esc(text)}. ${recipeButton(capFirst(text), wineWord(w))}</p></div>`;
  const shown = rows.slice(0, 6), note = (x) => (x.tier === "other" ? `<p class="hint">The book pours ${esc(x.want.join(", "))} with this, not a wine like yours.</p>` : choiceNote(x, sommKeys(w)));
  return `<div class="somm-card"><h3 class="somm-wine-h">Recipes with ${esc(text)}</h3>
    <p class="hint">${rows.length} ${rows.length === 1 ? "recipe" : "recipes"} use this, the best for this wine first${rows.length > 6 ? `; showing 6` : ""}.</p>
    ${shown.map((x) => note(x) + recipeHtml(x.r)).join("")}</div>`;
}
function showWineFood(html, label) {
  $("somm-wine-food").innerHTML = html;
  $("somm-trail-food").textContent = label ? `› ${label}` : "";
  $("somm-other-food").hidden = !label;
  if (label) jumpTo($("somm-wine-food"));
}

// ---- Several wines at once: the food pairings list ----------------------------------------
// The wine's card pops out over the list, and "Add to food pairings" collects up to five wines
// for "What have you got?" across all of them.
function popWine(id) {
  const w = findWine(id);
  if (!w) return;
  $("somm-pop-body").innerHTML = w.kind === "cellar" ? cellarCardMine(w) : wineCard(w);
  const add = $("somm-pop-add"); // the card's own button gives way to this one, at the foot of the window
  add.dataset.pair = id;
  add.setAttribute("aria-pressed", String(inPairs(id)));
  add.textContent = pairWords(inPairs(id));
  $("somm-pop").showModal?.();
}
// buttons that lead elsewhere shouldn't leave the card open over the page
document.addEventListener("click", (e) => { if (e.target.closest?.('#somm-pop [data-action="mw-where"], #somm-pop [data-notes]')) $("somm-pop").close(); });
function renderPairBar() {
  if (typeof sommRoute !== "undefined" && sommRoute) renderTrail(); // the picks line in the trail
  const slot = document.querySelector("#somm-out .pairbar-slot");
  for (const b of document.querySelectorAll("[data-pair-tick]")) { b.checked = inPairs(b.dataset.pairTick); b.closest("tr")?.classList.toggle("row-picked", b.checked); }
  for (const box of [$("somm-pairbar"), $("mc-pairbar"), ...document.querySelectorAll(".pairbar-slot")]) {
  if (!box) continue;
  box.hidden = !pairList.length || (box.id === "somm-pairbar" && !!slot);
  box.innerHTML = pairList.length ? `<strong>🍽 Pairings: ${pairList.length} of ${PAIR_MAX} wines</strong>
    ${pairList.map((w) => `<span class="chip">${esc(w.name)}<button type="button" class="chip-x" data-pair="${esc(w.id)}" aria-label="Remove ${esc(w.name)}">✕</button></span>`).join(" ")}
    <button type="button" class="btn btn-somm" data-somm="see-pairs">See pairings</button> <button type="button" class="btn btn-mini" data-somm="clear-pairs">Clear</button>` : "";
  }
}
const backToList = () => (answerArgs && !!$("somm-cellar-answer"));
function openWine(w, fromList) {
  const food = fromList && answerArgs?.food;
  showOut(wineStartHtml(w, false, fromList));
  fillStory(w);
  fillAtStore(w);
  if (food) {
    document.querySelector(`#somm button.somm-food[data-wine-food="${food}"]`)?.setAttribute("aria-pressed", "true");
    $("somm-wine-food").innerHTML = wineFoodHtml(w, false, food);
    $("somm-trail-food").textContent = `› ${food}`;
    $("somm-other-food").hidden = false;
  }
}
function openWineFood(w, food) {
  showOut(wineStartHtml(w, false, false));
  fillStory(w); fillAtStore(w);
  if (!food) return;
  document.querySelector(`#somm button.somm-food[data-wine-food="${food}"]`)?.setAttribute("aria-pressed", "true");
  $("somm-wine-food").innerHTML = wineFoodHtml(w, false, food);
  $("somm-trail-food").textContent = `› ${food}`;
  $("somm-other-food").hidden = false;
  jumpTo($("somm-wine-food"));
}
function seePairs() {
  if (!pairList.length) return;
  const fromList = backToList();
  if (pairList.length === 1) return openWine(findWine(pairList[0].id) || pairList[0], fromList);
  wineNow = null;
  showOut(pairsStartHtml(fromList));
}
const pairWines = () => pairList.map((x) => findWine(x.id) || x);
const suits = (w, f) => { const r = foodRating(w, false, f); return r.t ? "classic" : r.bold ? "bold" : ""; };
function pairsStartHtml(fromList) {
  const wines = pairWines(), n = wines.length;
  const score = (f) => wines.reduce((k, w) => k + (foodRating(w, false, f).t || (foodRating(w, false, f).bold ? 0.5 : 0)), 0);
  const tiles = FOODS.slice().sort((a, b) => score(b) - score(a)).map((f) => {
    const k = wines.filter((w) => suits(w, f)).length;
    return `<button type="button" class="somm-food" data-pairs-food="${esc(f)}" aria-pressed="false">${foodIcon(f)}${esc(f)} <span class="tile-rate">${k} of ${n}</span></button>`;
  }).join("");
  return `<div id="somm-wine-answer">
    <p class="somm-trail"><strong>${n} wines together</strong> <span id="somm-trail-food"></span>
      <button type="button" class="btn btn-mini" data-somm="other-food" id="somm-other-food" hidden>Choose another food</button>
      ${fromList ? `<button type="button" class="btn btn-mini" data-somm="back-list">Back to the list</button>` : ""}</p>
    ${selectionReadHtml(wines)}
    ${pairsOverviewHtml(wines)}
    <div class="somm-way"><h4>Already know what you're cooking?</h4>
      <p class="hint">Each food shows how many of your wines suit it, classic or adventurous. Tap it for your wines with that food.</p>
      <div class="somm-foods-pick">${tiles}</div>
      <label class="somm-label" for="somm-fridge">Or type what's in the fridge <span class="hint-inline">(for example pork, apples)</span></label>
      <div class="somm-row"><input type="text" id="somm-fridge" autocomplete="off"> <button type="button" class="btn btn-somm" data-somm="fridge">Find recipes</button></div></div>
    <div id="somm-wine-food"></div></div>`;
}
// The answer for several wines, before any question: where they meet, each at its best, one dinner.
function pairsOverviewHtml(wines) {
  if (!SOMM) return "";
  const recipes = SOMM.recipes || [], main = (r) => r[4] !== "side";
  const rate = (w, f) => foodRating(w, false, f).t || 0;
  // A. foods every wine handles as a classic, strongest for the weakest wine first
  const meet = FOODS.map((f) => ({ f, lo: Math.min(...wines.map((w) => rate(w, f))) })).filter((x) => x.lo > 1).sort((a, b) => b.lo - a.lo);
  const meetCard = ({ f }) => {
    const both = recipes.filter((r) => r[3] === f && main(r) && wines.every((w) => recipeTierFor(w, r)));
    const dishes = wines.map((w) => { const { ds } = wineDishes(w, f, bookKeys(sommKeys(w), isSweetWine(w)));
      const d = ds.length ? ds.map((x) => x.dish).slice(0, 3).join(", ") : pairDish(w, f);
      return `<li>${pairName(w)} ${STARS(rate(w, f))}${d ? `: ${esc(d)}` : ""}</li>`; }).join("");
    const order = Object.keys(STAGES), pour = wines.slice().sort((a, b) => rate(b, f) - rate(a, f) || order.indexOf(drinkStage(a)) - order.indexOf(drinkStage(b)) || (a.drink_to ?? 9999) - (b.drink_to ?? 9999));
    const pourHtml = `<p class="somm-pour"><strong>Pour:</strong> ${pour.map((w, i) => `${esc(w.name)}${i === 0 && w.kind === "cellar" && ["first", "soon"].includes(drinkStage(w)) ? " (drink it sooner)" : ""}
      <button type="button" class="btn btn-mini" data-somm="just-wine" data-id="${esc(w.id)}" data-food="${esc(f)}">Use this one</button>`).join(" or ")}</p>`;
    return `<div class="somm-meet"><h5>${foodIcon(f)}<button type="button" class="linklike" data-pairs-food="${esc(f)}">${esc(f)}</button></h5><ul>${dishes}</ul>${pourHtml}
      ${both.length ? recipeFold("Recipes that suit every wine here", both, both.length <= 3) : `<p class="hint">No single recipe in the books suits all of them, but each wine has its own dishes above.</p>`}</div>`;
  };
  const meetHtml = `<div class="somm-card somm-pairs-a"><h3 class="somm-wine-h">Where your wines meet</h3>
    ${meet.length ? `<p class="hint">Foods the books rate as a classic match for every one of your wines.</p>${meet.slice(0, 2).map(meetCard).join("")}`
      : `<p>These wines don't share a classic food in the books: each is best with something different. The dinner below gives each its own course.</p>`}</div>`;
  // B. each wine with its top foods, the books' own grape first
  const foodFold = (w, { f, t }, i) => {
    const mine = recipes.filter((r) => r[3] === f && main(r)), exact = mine.filter((r) => recipeTierFor(w, r) === "exact"), style = mine.filter((r) => recipeTierFor(w, r) === "style");
    const { ds, why } = wineDishes(w, f, bookKeys(sommKeys(w), isSweetWine(w)));
    const dishes = ds.length ? ds.map((d) => d.dish).join(", ") : pairDish(w, f);
    const count = [exact.length ? `${exact.length} the books pour with ${grapeWordOf(w)}` : "", style.length ? `${style.length} for wines like it` : ""].filter(Boolean).join(", ");
    return `<details class="somm-fold"${i === 0 ? " open" : ""}><summary>${foodIcon(f)}${esc(f)} ${STARS(t)}${count ? ` <span class="hint-inline">· recipes: ${esc(count)}</span>` : ""}</summary>
      ${why ? `<p>${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}</p>` : ""}${dishes ? `<p><strong>Dishes the books suggest:</strong> ${esc(dishes)}.</p>` : ""}
      ${exact.length || style.length ? wineRecipeFolds(w, exact, style, true) : `<p class="hint">The books have no ${esc(f.toLowerCase())} recipe for this wine.</p>`}</details>`;
  };
  const bestHtml = `<div class="somm-card"><h3 class="somm-wine-h">Each wine at its best</h3>
    <p class="hint">★ rates the wine with the food, from the books. Recipes the books pour with the wine's own grape come first; the ones for wines like it are Claude's judgement.</p>
    ${wines.map((w) => { const best = bestFoodsOf(w).slice(0, 3);
      return `<div class="somm-pair-wine"><p class="somm-pair-head">${pairName(w)}</p><p>${w.kind === "cellar" ? drinkTag(w) : ""}</p>
        <p class="somm-row"><button type="button" class="btn btn-somm" data-somm="just-wine" data-id="${esc(w.id)}">Just this wine →</button>
          <button type="button" class="btn btn-mini" data-somm="drop-wine" data-id="${esc(w.id)}">✕ Drop it from my picks</button></p>
        ${best.length ? best.map((x, i) => foodFold(w, x, i)).join("") : `<p class="hint">The books don't rate this wine highly with any one food.</p>`}</div>`; }).join("")}</div>`;
  // C. one dinner with all of them, from the menu builder
  const courses = ["main", "cheese", ...(wines.some(isSweetWine) ? ["dessert"] : []), ...(wines.length > 2 ? ["starter"] : [])];
  const m = buildMenu({ country: "", courses, protein: "", stores: sommStores(), pool: wines });
  lastMenu = m;
  const line = (p) => `<li><label><strong>${esc(COURSES[p.c])}${p.food && p.c !== "cheese" && p.c !== "dessert" ? ` (${esc(p.food.toLowerCase())})` : ""}:</strong>
      <select data-dinner-course="${esc(p.c)}" aria-label="Wine for ${esc(COURSES[p.c])}">${wines.map((w) => `<option value="${esc(w.id)}"${p.w?.id === w.id ? " selected" : ""}>${esc(w.name)}</option>`).join("")}
        <option value=""${p.w ? "" : " selected"}>No wine with this course</option></select></label>${p.note ? ` <span class="hint-inline">${esc(p.note)}</span>` : ""}</li>`;
  const dinnerHtml = `<div class="somm-card"><h3 class="somm-wine-h">One dinner with all ${wines.length}</h3>
    <p class="hint">Each wine on the course it suits best. Change any course's wine, then plan it.</p><ol class="somm-dinner">${m.plan.map(line).join("")}</ol>
    <p><button type="button" class="btn btn-somm btn-big" data-somm="dinner-from-choice">🧀 Plan this dinner →</button></p>
    <details class="somm-fold"><summary>The full menu, with dishes and a recipe for each course</summary>${menuHtml(m)}</details></div>`;
  return meetHtml + bestHtml + dinnerHtml;
}
// How a recipe stands with a wine: the book pours its grape ("exact"), or a grape of the same style.
// The books don't rate recipes, so this is the only strength a recipe has.
function recipeTierFor(w, r) {
  const keys = bookKeys(w), alike = sameStyleAs(keys), want = expandKeys(r[6] || []);
  return want.some((k) => keys.includes(k)) ? "exact" : want.some((k) => alike.has(k)) ? "style" : "";
}
const recipeFold = (label, list, open = false) => (list.length
  ? `<details class="somm-fold"${open ? " open" : ""}><summary>${esc(label)} (${list.length})</summary>${list.map(recipeHtml).join("")}</details>` : "");
// "Riesling" for a Riesling, "Nebbiolo" for a Barolo: the grape the books would have to name.
const grapeWordOf = (w) => (sommKeys(w)[0] || "this grape").split(/ \/| \(/)[0];
// The grapes the books actually poured with these recipes, of the same style as this wine.
function likeGrapes(w, list) {
  const alike = sameStyleAs(bookKeys(w)), n = new Map();
  for (const r of list) for (const g of expandKeys(r[6] || [])) if (alike.has(g)) n.set(g, (n.get(g) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([g]) => g.split(/ \/| \(/)[0]);
}
// The two kinds of recipe for one wine: the books' own grape first, then wines like it, named.
function wineRecipeFolds(w, exact, style, openExact = exact.length <= 3) {
  const like = likeGrapes(w, style), names = like.slice(0, 4).join(", ") + (like.length > 4 ? "…" : "");
  return (!exact.length && style.length ? `<p class="hint">None of these recipes is one the books pour with ${esc(grapeWordOf(w))} itself, so they come from wines of the same style.</p>` : "") +
    recipeFold(`Recipes the books pour with ${grapeWordOf(w)}`, exact, openExact) +
    recipeFold(`Recipes for wines like it${names ? ` (the books pour ${names})` : ""}, Claude's judgement`, style);
}
// A wine's best foods from the books, strongest first.
const bestFoodsOf = (w) => FOODS.map((f) => ({ f, t: foodRating(w, false, f).t || 0 })).filter((x) => x.t > 1).sort((a, b) => b.t - a.t);
const foodLinks = (list) => list.map(({ f, t }) => `${foodIcon(f)}<button type="button" class="linklike" data-pairs-food="${esc(f)}">${esc(f.toLowerCase())}</button>${t ? ` ${STARS(t)}` : ""}`);
const orWords = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} or ${a.at(-1)}` : a[0] || "");
// One section per wine with its recipes, and first any that are the books' own match for every wine.
// A wine that doesn't suit the food (weak) keeps its recipes folded away, for anyone set on it.
function pairSectionsHtml(wines, recipes, head, weak = () => "") {
  const tiers = new Map(recipes.map((r) => [r, wines.map((w) => recipeTierFor(w, r))]));
  const shared = recipes.filter((r) => tiers.get(r).every((t) => t === "exact"));
  const other = recipes.filter((r) => tiers.get(r).every((t) => !t));
  const section = (w, k) => { const of = (t) => recipes.filter((r) => tiers.get(r)[k] === t), exact = of("exact"), style = of("style");
    const folds = wineRecipeFolds(w, exact, style), set = weak(w);
    return `<div class="somm-pair-wine">${head(w)}${set && folds ? `<details class="somm-fold somm-stretch"><summary>${esc(set)} (${exact.length + style.length})</summary>${folds}</details>` : folds}</div>`; };
  return `${shared.length ? `<div class="somm-pair-wine somm-pair-all"><h4>Good for all your wines</h4><p class="hint">The book's own match for every wine here.</p>${shared.map(recipeHtml).join("")}</div>` : ""}
    ${wines.map(section).join("")}${recipeFold("Other recipes using this", other)}`;
}
const pairName = (w) => `<button type="button" class="linklike somm-pair-name" data-somm-pop="${esc(w.id)}">${esc(w.name)}</button>`;
function pairsFoodHtml(f) {
  const order = Object.keys(STAGES), strength = (w) => { const r = foodRating(w, false, f); return r.t || (r.bold ? 0.5 : 0); };
  const wines = pairWines().sort((a, b) => strength(b) - strength(a) || order.indexOf(drinkStage(a)) - order.indexOf(drinkStage(b)));
  const food = f.toLowerCase();
  const weak = (w) => { const r = foodRating(w, false, f); return r.t || r.bold ? "" : `If you're set on ${food} anyway`; };
  const head = (w) => {
    const r = foodRating(w, false, f), { ds, why } = wineDishes(w, f, bookKeys(sommKeys(w), isSweetWine(w)));
    if (!r.t && !r.bold) {
      const best = bestFoodsOf(w).slice(0, 3);
      return `<p class="somm-pair-head">${pairName(w)}</p><p><strong>Not a natural match with ${esc(food)}.</strong> ${w.kind === "cellar" ? drinkTag(w) : ""}</p>
        ${best.length ? `<p>This ${esc(grapeWordOf(w))} is at its best with ${orWords(foodLinks(best))}.</p>` : ""}`;
    }
    const label = r.t ? `${STARS(r.t)} with ${food}` : `⚡ an adventurous match with ${food}`;
    const dishes = ds.length ? ds.map((d) => d.dish).join(", ") : r.bold ? "" : pairDish(w, f);
    return `<p class="somm-pair-head">${pairName(w)}</p><p><strong>${esc(label)}</strong> ${w.kind === "cellar" ? drinkTag(w) : ""}</p>
      ${why ? `<p>${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}</p>` : ""}${dishes ? `<p><strong>Dishes the books suggest:</strong> ${esc(dishes)}.</p>` : ""}${r.bold ? advIdeaHtml(w, f, false) : ""}`;
  };
  const recipes = (SOMM?.recipes || []).filter((r) => r[3] === f && r[4] !== "side" && wines.some((w) => recipeTierFor(w, r)));
  return `<div class="somm-card"><h3 class="somm-wine-h">${foodIcon(f)}Your wines with ${esc(food)}</h3>
    <p class="hint">★ rates the wine with this food, not the recipes. The books don't rate recipes.</p>
    ${pairSectionsHtml(wines, recipes, head, weak)}</div>`;
}
function pairsFridgeHtml(text) {
  const wanted = fold(text).split(/[^a-z]+/).filter((t) => t.length > 2).map((t) => t.replace(/s$/, ""));
  if (!wanted.length) return `<div class="somm-card"><p>Type something from the fridge first, such as pork.</p></div>`;
  const rows = (SOMM?.recipes || []).map((r) => { const x = RECIPES[recipeKey(r)]; if (!x) return null;
    const hay = fold(`${r[0]} ${(x.i || []).join(" ")}`), found = wanted.filter((t) => hay.includes(t)).length;
    return found ? { r, found } : null; }).filter(Boolean).sort((a, b) => b.found - a.found).map((x) => x.r);
  if (!rows.length) return `<div class="somm-card"><p>No recipe in the books uses ${esc(text)}.</p></div>`;
  const head = (w) => `<p class="somm-pair-head">${pairName(w)}</p><p>${w.kind === "cellar" ? drinkTag(w) : ""}</p>`;
  return `<div class="somm-card"><h3 class="somm-wine-h">Recipes with ${esc(text)}</h3>${pairSectionsHtml(pairWines(), rows, head)}</div>`;
}

// ---- Route 2: I have some food -----------------------------------------------------------------
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
  const matched = pool.map((w) => ({ w, t: fit(w) })).filter((x) => x.t >= 2);
  // a cellar wine is a classic match only if its own food list says so (a grape's tuna-with-red
  // note doesn't make every Cabernet a wine for fish); the rest wait for the adventurous box
  const own = matched.filter((x) => x.w.kind === "cellar" && foodsOf(x.w).includes(food));
  const daring = document.querySelector("#somm [name=somm-daring]:checked")?.value;
  if (daring === "only") own.length = 0;
  if (daring === "bold" || daring === "only") own.push(...pool.filter((w) => w.kind === "cellar" && !foodsOf(w).includes(food) && !bookKeys(w).some((k) => avoid.has(k)) &&
    boldFoodsOf(w).some((b) => b.food === food)).map((w) => ({ w, t: 1, bold: true })));
  const bottles = matched.filter((x) => x.w.kind !== "cellar").sort((a, b) => b.t - a.t || byBest(a.w, b.w));
  const gList = ranked.slice(0, 10).map(([g, x]) => `<li><span class="food-star tier-${x.t}">${STARS(x.t)}</span> <strong>${esc(g)}</strong>` +
    `${x.dish ? ` with ${esc(x.dish)}` : grapeDishes(g, food).length ? `: ${esc(grapeDishes(g, food).slice(0, 3).map((d) => d.dish).join(", "))}` : ""}` +
    `${x.why?.why ? `. ${esc(capFirst(x.why.why))}${srcSpan(x.why.b, x.why.p)}` : ""}</li>`).join("");
  const recs = recipesFor([], food, words).length ? recipesFor([], food, words) : recipesFor([], food);
  const storeWord = stores.map(sourceLabel).join(", ");
  const local = country && LOCAL_NOTES[country] ? localNotesHtml(country) : "";
  const rowsAll = [...own, ...bottles]; // cellar wines and store bottles in one table to tick and sort
  const answer = rowsAll.length || sommCellars().length || stores.length ? cellarAnswerHtml(rowsAll, food, `for ${dish || food.toLowerCase()}`) : "";
  const picked = pairList.length ? `<div class="somm-picked"><p class="somm-sel-head">Your ${pairList.length === 1 ? "picked wine" : `${pairList.length} picked wines`} with ${esc(food.toLowerCase())}</p>${pairsFoodHtml(food)}</div>
    <h4 class="somm-sub">Or choose from everything ticked</h4>` : "";
  return `${picked}${answer}<div class="somm-card"><h3 class="somm-wine-h">${esc(dish ? capFirst(dish) : food)}: what the books pour</h3>
      <ul class="somm-foods">${gList || "<li>The books name no wine for this.</li>"}</ul>
      ${avoid.size ? `<p><strong>⚠️ Avoid:</strong> ${esc([...avoid].join(", "))}.</p>` : ""}
      ${dish ? `<p>${recipeButton(dish, ranked[0]?.[0] || "")}</p>` : ""}
      ${recipesHtml(recs, 6, `Recipes from the books for ${food.toLowerCase()}`)}</div>${local}
    ${stores.length && !bottles.length ? `<p class="hint">No store bottles match: try more stores, another country or a higher price.</p>` : ""}`;
}

// ---- Route 3: Plan a dinner --------------------------------------------------------------
let lastMenu = null;
// A country's wines in the stores, or (own) the bottles handed in from the Comparison List.
// How weighty a wine is, for pouring light to heavy: sparkling, whites by body, rosé, reds by body.
function wineWeight(w) {
  if (!w || isSweetWine(w)) return 9;
  if (w.type === "Sparkling") return 0;
  const b = { light: 0, medium: 1, full: 2 }[styleOfW(w, "body")] ?? 1;
  return w.type === "Red" ? 4 + b : w.type === "Rosé" ? 3 : 1 + b;
}
function buildMenu({ country, nWines, courses, protein, stores, maxPrice, pool: given = null, banned = new Set(), keep = null, exclude = {}, cellars = sommCellars(), ceiling = null }) {
  const own = !!given;
  const canOpen = (w) => w.kind !== "cellar" || openable(w);
  const pool = given || sommPool({ stores, country, maxPrice, cellars }).filter(canOpen).filter((w) => !keep || keep(w));
  let mainW = null;
  let cur = "";
  if (own) nWines = Math.max(1, pool.length);
  const used = new Set(), plan = [];
  const urge = (w) => (w.kind === "cellar" ? { first: 8, soon: 4 }[drinkStage(w)] || 0 : 0);
  const pick = (cands, score) => cands.filter((w) => !used.has(w.id) && !exclude[cur]?.has(w.id)).map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s + urge(b.w) - a.s - urge(a.w) || byBest(a.w, b.w))[0]?.w || null;
  const tierFor = (w, f) => (foodsOf(w).includes(f) ? Math.max(wineTier(w, f), ...bookKeys(w).map((k) => grapeFoodTier(k, f))) : 0);
  const order = ["main", "dessert", "starter", "cheese"].filter((c) => courses.includes(c));
  const dryBonus = (w) => (["dry", null, undefined].includes(sweetV(w)) ? 5 : sweetV(w) === "off-dry" ? 1 : -20);
  for (const c of order) {
    cur = c;
    let food = c === "main" ? protein : COURSE_FOODS[c]?.filter((f) => !banned.has(f))[0] || COURSE_FOODS[c]?.[0];
    let w = null, note = "";
    if (c === "dessert") {
      w = pick(pool.filter(isSweetWine), (x) => 1 + (bestScore(x) ?? 0) / 100);
      if (!w && own) note = "None of the ticked wines is a dessert wine.";
      else if (!w) {
        const away = sommPool({ stores, maxPrice, cellars }).filter((x) => canOpen(x) && realDessert(x) && x.country !== country);
        const classic = (x) => sommKeys(x).some((k) => ["Port", "Tokaji", "Ice wine", "Sauternes", "Late-harvest white", "Muscat / Moscato", "Madeira"].includes(k));
        w = pick(away, (x) => 1 + (classic(x) ? 3 : 0) + (x.type === "Dessert" ? 1 : 0) + (bestScore(x) ?? 0) / 100);
        note = w && country ? `${country} has no dessert wine in ${tickedWord()}, so this one is from ${w.country}.` : w ? "" : `No dessert wine in ${tickedWord()}.`;
      }
    } else if (c === "main") {
      const reds = pool.filter((x) => !isSweetWine(x) && x.type !== "Sparkling");
      const mains = ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood", "Pasta and pizza"].filter((f) => !banned.has(f));
      if (food) w = pick(reds, (x) => tierFor(x, food) && tierFor(x, food) * 10 + dryBonus(x) + (bestScore(x) ?? 0) / 100);
      else {
        const red = reds.filter((x) => x.type === "Red");
        w = pick(red.length ? red : reds, (x) => 30 + Math.max(0, ...mains.map((f) => tierFor(x, f))) * 10 + dryBonus(x) + (bestScore(x) ?? 0) / 100);
        if (w) food = foodsOf(w).filter((f) => !["Cheese", "Dessert"].includes(f) && !banned.has(f)).sort((a, b) => tierFor(w, b) - tierFor(w, a))[0] || mains[0] || "Pasta and pizza";
      }
    } else {
      const fs = (COURSE_FOODS[c] || []).filter((f) => !banned.has(f));
      const mw = wineWeight(mainW || ceiling), top = c === "starter" ? (mw > 1 ? mw - 1 : mw) : 99; // pour light to heavy: the starter's wine lighter than the main's
      w = pick(pool.filter((x) => (!isSweetWine(x) || c === "cheese") && (!(mainW || ceiling) || wineWeight(x) <= top)), (x) => Math.max(0, ...fs.map((f) => tierFor(x, f))));
      if (w && c === "starter") food = fs.slice().sort((a, b) => tierFor(w, b) - tierFor(w, a))[0];
    }
    if (w) used.add(w.id);
    if (c === "main") mainW = w;
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
  if (!p.w) return `<div class="somm-card somm-course-card"><h4>${COURSES[p.c]}${p.food && p.c !== "cheese" && p.c !== "dessert" ? `: ${esc(p.food.toLowerCase())}` : ""}</h4><p>${esc(p.note || `No ${country ? `${country} ` : ""}wine suits this course in ${tickedWord()}.`)}</p>
    ${p.dinner ? `<p><button type="button" class="btn btn-somm" data-somm="menu-add" data-course="${esc(p.c)}">Add a wine for this course</button></p>` : ""}</div>`;
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
    const ds = dishesFor(grapes, p.food, 8).map((d) => dishForWine(p.w, d)).filter((d) => d.dish).slice(0, 4);
    if (ds.length) parts.push(`<p class="somm-dish"><strong>${local.length ? "What the books pour this style with" : "Serve"}:</strong></p><ul class="somm-foods">${ds.map((d) =>
      `<li>${esc(capFirst(d.dish))}${d.why ? `. ${esc(capFirst(d.why))}` : ""}${srcSpan(d.b, d.p)}${keys.includes(d.g) ? "" : ` <span class="hint-inline">(said of ${esc(d.g)})</span>`}</li>`).join("")}</ul>`);
    else parts.push(`<p class="somm-dish"><strong>Serve:</strong> ${esc(capFirst(pairDish(p.w, p.food) || ""))}.</p>`);
    const top = local.length ? local[0].dishes.split(/,(?![^(]*\))/)[0] : ds[0]?.dish;
    if (top) parts.push(`<p>${recipeButton(top.trim(), wineWord(p.w))}</p>`);
  }
  const pick = recipePickHtml(p.w, p.c === "dessert" ? "Dessert" : p.c === "cheese" ? "Cheese" : p.food, 1, null, p.c);
  const br = p.c === "main" || p.c === "starter" ? bridgesFor(grapes) : [];
  const avoid = avoidsFor(grapes).filter((d) => p.c === "main" || p.c === "starter" ? d[0] === p.food || !["Cheese", "Dessert"].includes(d[0]) : d[0] === (p.c === "cheese" ? "Cheese" : "Dessert")).slice(0, 2);
  const tips = tipsFor(grapes, 2);
  return `<div class="somm-card somm-course-card${p.w.type ? ` wine-${esc(p.w.type)}` : ""}"><h4>${COURSES[p.c]}${p.food && p.c !== "cheese" && p.c !== "dessert" ? `: ${esc(p.food.toLowerCase())}` : ""} <span class="food-star tier-${t}">${STARS(t)}</span></h4>
    <ul class="somm-bottles">${sommRow(p.w, keys.length ? `<div>${esc(keys.join(", "))}</div>` : "")}</ul>
    ${p.w.kind === "cellar" && sommStores().length && atStoreWords(p.w) ? `<p class="somm-at-line">🛒 Also ${atStoreWords(p.w)}</p>` : ""}
    ${p.dinner ? `<p><button type="button" class="btn btn-mini" data-somm="menu-swap" data-course="${esc(p.c)}">Another wine for this course</button>${p.anchor ? ` <span class="hint-inline">Your chosen wine.</span>` : ""}</p>` : ""}
    ${p.note ? `<p class="somm-note">${esc(p.note)}</p>` : ""}${borrowedNote(keys, sweet)}
    ${parts.join("")}
    ${pick ? `<h5>📖 A recipe for this course</h5>${pick}` : ""}
    ${br.length ? `<p><strong>🔗 Flavour bridges</strong> for ${esc(br[0].k)} (ingredients that tie a dish to it): ${esc(br[0].ing.join(", "))}.${srcSpan(br[0].b, br[0].p)}</p>` : ""}
    ${avoid.length ? `<p><strong>⚠️ Watch out:</strong></p><ul>${avoid.map(avoidLi).join("")}</ul>` : ""}
    ${tips.length ? `<p><strong>💡 The books' advice:</strong></p><ul>${tips.map(tipLi).join("")}</ul>` : ""}</div>`;
}
function menuHtml(m) {
  recipesShown = new Set();
  advShown = new Set();
  const reg = SOMM?.regions?.[m.country];
  const wines = [...new Set(m.plan.map((p) => p.w).filter(Boolean))];
  // the books' own menus that pour the same grapes, for ideas
  const mk = new Set(wines.flatMap((w) => bookKeys(w)));
  const bookMenus = (SOMM?.menus || []).map((x) => ({ x, n: x[3].filter((c) => c[1].some((k) => mk.has(k))).length })).filter((y) => y.n)
    .sort((a, b) => b.n - a.n).slice(0, 3).map(({ x }) => `<li><strong>${esc(x[0])}</strong>${srcSpan(x[1], x[2])}: ` +
      x[3].map((c) => `${esc(c[0])}${c[1].length ? ` <span class="hint-inline">with ${esc(c[1].join(" / "))}</span>` : ""}`).join(" · ") + `</li>`).join("");
  const n = LOCAL_NOTES[m.country];
  const head = m.dinner ? dinnerHeadHtml(m, wines)
    : m.own ? `<strong>A menu from your Comparison List</strong>: ${wines.length} of the ${m.pool} ${m.pool === 1 ? "wine" : "wines"} ticked, each on the course it suits best.`
    : `<strong>${m.country ? `A ${esc(m.country)} menu` : "Your menu"}</strong>, ${wines.length} ${wines.length === 1 ? "wine" : "wines"}, chosen from ${m.pool.toLocaleString()} ${esc(m.country)} wines in ${tickedWord()}${sommCellars().length ? " (cellar wines that are ready to open)" : ""}.`;
  return `<p class="somm-summary">${head}</p>
    ${n ? `<p>${esc(n.intro)} ${CLAUDE_TAG}</p>` : ""}
    ${reg?.foods?.length ? `<p><strong>Local food the books tie to these wines:</strong> ${esc(reg.foods.join(", "))}.</p>` : ""}
    ${m.plan.map((p) => courseHtml(p, m.country)).join("")}
    ${bookMenus ? `<div class="somm-card"><h4>📖 Menus in the books with the same grapes, for ideas</h4><ul>${bookMenus}</ul></div>` : ""}
    <div class="somm-ask"><button type="button" class="btn btn-primary" data-somm="ask-menu">Ask Claude to polish this menu</button>
      <button type="button" class="btn" data-somm="print-out" data-print-title="Your dinner menu">🖨 Print this menu</button>
      <button type="button" class="btn" data-somm="menu-all">⚖️ Add all ${wines.length} wines to the Comparison List</button>
      <button type="button" class="btn btn-somm" data-somm="dinner-shop">🛒 Shopping list for the whole dinner</button>
      <p id="somm-ask-msg" class="status" role="status"></p></div><div id="somm-dinner-shop"></div>`;
}
function menuPrompt(m) {
  const lines = m.plan.map((p) => `- ${COURSES[p.c]}${p.food && p.c === "main" ? ` (${p.food.toLowerCase()})` : ""}: ${p.w ? `${p.w.name}${p.w.vintage ? " " + p.w.vintage : ""}, ${p.w.kind === "cellar" ? `from ${sourceLabel(p.w.source)}` : `${money(priceOf(p.w) ?? p.w.price)} at ${sourceLabel(p.w.source)}`}` : "no wine found"}${p.note ? ` (${p.note})` : ""}`);
  return `I'm planning a dinner to show off ${m.own ? "some wines I've picked" : `wines from ${m.country}`}. My wine finder suggested these bottles for each course:\n\n${lines.join("\n")}\n\n` +
    `Please act as a Master Sommelier: for each course, suggest one specific dish that suits that wine (with a short reason), say whether you'd change any of the wines and why, and give serving tips (temperature, decanting, order of pouring). Keep it practical for a home cook.`;
}

// ---- The panel -----------------------------------------------------------------------------
function sommCountries() {
  const stores = sommStores(), n = new Map();
  for (const w of sommPool({ stores })) if (w.country && w.country !== "Country not stated") n.set(w.country, (n.get(w.country) || 0) + 1);
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
  // as ticked; anything not on the page yet comes from what this computer last used (BC Liquor to start)
  const saved = storeGet("wf.sommSources", { stores: ["BC Liquor"], cellars: [] });
  const shown = new Set([...box.querySelectorAll("input")].map((b) => b.value));
  const known = knownSources(), on = new Set([...sommStores(), ...saved.stores.filter((x) => !shown.has(x))]);
  const cellars = cellarSources(), mine = new Set([...sommCellars(), ...saved.cellars.filter((x) => !shown.has(x))]);
  const buying = `<div><span class="somm-label">Buying from:</span> ` + known.map((s) => `<label class="somm-check"><input type="checkbox" data-somm-store value="${esc(s)}"${on.has(s) ? " checked" : ""}> ${esc(sourceLabel(s))}</label>`).join(" ") +
    (known.includes("LCBO") ? "" : ` <span class="hint-inline">The LCBO (Ontario) appears here once it's unlocked: tick LCBO under <strong>Sold by</strong> in Find wines and enter the family code.</span>`) + `</div>`;
  box.innerHTML = (cellars.length ? `<div class="somm-cellars"><span class="somm-label">In our cellars:</span> ` + cellars.map((c) => `<label class="somm-check check-cellar${cellarTone(c)}"><input type="checkbox" data-somm-cellar value="${esc(c)}"${mine.has(c) ? " checked" : ""}> ${esc(c)}</label>`).join(" ") +
    `</div>` : "") + buying + `<div class="somm-source-tools"><button type="button" class="btn btn-mini" data-somm="clear-sources">Clear all</button>
    <button type="button" class="btn btn-mini" data-somm="all-sources">Select all</button> <span id="somm-using"></span></div>`;
  renderMoods();
  renderUsing();
  renderPairBar();
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
    : `<p class="hint">Your Comparison List is empty. Press <strong>⚖️ ＋ Add wine to Comparison List</strong> on any wine in Find wines or My cellars, then come back here.</p>`;
}
// ---- Where you are: the route, the trail and the source banner ----------------------------
// Step 2 chooses a route. Once chosen, steps 1 and 2 fold into a trail at the top (each can be
// pressed to change it), only that route's questions show, and the route's colour runs down them.
// Changing route starts its questions afresh, so no old choice is left showing without its answer.
const ROUTES = { wine: { icon: "🔎", label: "Find a wine" }, cook: { icon: "🍖", label: "I have some food" },
  menu: { icon: "🧀", label: "Plan a dinner" }, cmp: { icon: "⚖️", label: "From my Comparison List" } };
let sommRoute = "", sommEditSources = false;
function sommTab(name, keep = false) {
  if (!keep) resetChoices();
  sommRoute = ROUTES[name] ? name : "";
  sommEditSources = false;
  for (const b of document.querySelectorAll("#somm [data-somm-tab]")) b.setAttribute("aria-pressed", String(b.dataset.sommTab === sommRoute));
  for (const p of document.querySelectorAll("#somm .somm-pane")) p.hidden = p.id !== "somm-" + sommRoute;
  for (const k of Object.keys(ROUTES)) $("somm").classList.toggle("route-" + k, k === sommRoute);
  $("somm-out").innerHTML = "";
  $("somm-step3").hidden = true;
  renderTrail();
  if (sommRoute === "menu") renderDinnerQ();
  if (sommRoute === "wine") { renderFindIntro(); renderFindFilters(); }
}
// Each ticked cellar and store, in its own colours, with how many wines (and bottles) it holds.
function sourceChips() {
  const cel = sommCellars().map((c) => {
    const ws = cellarFindWines().filter((w) => w.source === c), b = ws.reduce((n, w) => n + (w.quantity || 0), 0);
    return `<span class="somm-src-chip badge-cellar${cellarTone(c)}">🍷 ${esc(c)} · ${ws.length.toLocaleString()} ${ws.length === 1 ? "wine" : "wines"}${b ? ` · ${b.toLocaleString()} bottles` : ""}</span>`;
  });
  const sto = sommStores().map((st) => {
    const n = WINES.filter((w) => w.source === st).length;
    return `<span class="somm-src-chip badge-${SOURCE_CLASS[st] || "other"}">🛒 ${esc(sourceLabel(st))}${n ? ` · ${n.toLocaleString()} wines` : ""}</span>`;
  });
  return [...cel, ...sto].join(" ");
}
function renderTrail() {
  const box = $("somm-trail");
  if (!box) return;
  const on = !!sommRoute, r = ROUTES[sommRoute], any = sommCellars().length + sommStores().length;
  $("somm-s1").hidden = on && !sommEditSources;
  $("somm-s1-done").hidden = !(on && sommEditSources);
  $("somm-s2").hidden = on;
  box.hidden = !on;
  if (!on) return;
  box.innerHTML = `<li class="trail-step"><button type="button" class="trail-btn" data-somm="edit-sources" aria-expanded="${sommEditSources}">
      <span class="zone-num">1</span> <span class="trail-what">${any ? `Choosing from ${sourceChips()}` : "Nothing ticked yet"}</span> <span class="trail-edit">✎ Change</span></button></li>
    <li class="trail-step trail-route"><button type="button" class="trail-btn" data-somm="to-step2">
      <span class="zone-num">2</span> <span class="trail-what">${r.icon} ${esc(r.label)}</span> <span class="trail-edit">✎ Change</span></button></li>` +
    (pairList.length ? `<li class="trail-step trail-picks"><div class="trail-btn trail-static"><span class="zone-num">3</span>
      <span class="trail-what">🍽 Your picks (${pairList.length}): ${pairWines().map((w) => `<span class="chip">${pickWords(w)}</span>`).join(" ")}</span>
      <button type="button" class="linklike trail-edit" data-somm="clear-pairs">✕ Clear the picks</button></div></li>` : "");
}
// A picked wine in a line: its name, where it is, and (for a cellar wine) whether the store ticked sells it.
function pickWords(w) {
  const at = w.kind === "cellar" ? atStoreWords(w) : "";
  return `${esc(w.name)} · ${w.kind === "cellar" ? esc(w.source) : priceOf(w) != null ? `${money(priceOf(w))} at ${esc(sourceLabel(w.source))}` : esc(sourceLabel(w.source) || "")}${at ? ` · ${at}` : ""}`;
}
// "≈ at the LCBO: 2024, $92" — the same wine at the stores ticked (any size said if not a standard bottle).
function atStoreWords(w) {
  const r = atStoreOf(w, { max: null, same: false }), st = sommStores();
  if (!r || r.kind === "producer") return "";
  const size = r.s.size_ml && !STANDARD_ML.has(r.s.size_ml) ? ` (${r.s.size_ml} ml)` : "";
  const where = st.length > 1 ? sourceLabel(r.s.source) : theStore(st);
  return r.kind === "exact" ? `✓ at ${esc(where)}: the same vintage, ${money(r.s.price)}${size}` : `≈ at ${esc(where)}: ${esc(String(r.s.vintage || "NV"))}, ${money(r.s.price)}${size}`;
}
function openSomm() {
  renderSommStores();
  renderSommComparison();
  fillCountrySelects();
  if (!allLoaded()) loadAllSources().then(() => { renderSommStores(); fillCountrySelects(); });
  return loadSomm();
}
const sommNum = (id) => { const v = parseFloat($(id)?.value); return Number.isFinite(v) && v > 0 ? v : null; };
// Straight there, in the page's own scroll: the answer can be well below the fold.
const jumpTo = (el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 10);
const showOut = (html) => {
  if (!sommRoute) sommTab("wine", true); // an answer from elsewhere (the Food Pairings bar, a cellar): it's about wines
  $("somm-out").innerHTML = html; $("somm-step3").hidden = false; jumpTo($("somm-step3"));
};

const renderSommHits = debounce(() => {
  const q = $("somm-q").value.trim(), out = $("somm-hits");
  $("somm-country-msg").textContent = "";
  if (q.length < 3) { out.innerHTML = ""; return; }
  const words = fold(q).split(/\s+/).filter(Boolean);
  const cels = sommCellars(), stores = sommStores(); // only what's ticked in step 1
  const hits = [...cellarFindWines().filter((w) => cels.includes(w.source) && words.every((t) => w._s.includes(t))),
    ...listHits(q).filter((w) => stores.includes(w.source))].slice(0, 12);
  out.innerHTML = (hits.length ? `<p>Click a wine to see its food pairings.</p><ul class="somm-hit-list">${hits.map((w) =>
    `<li><button type="button" class="btn btn-somm somm-hit" data-somm-wine="${esc(w.id)}">What to eat with ${esc(w.name)}${w.vintage && !w.name.includes(String(w.vintage)) ? ` ${esc(String(w.vintage))}` : ""} · ${w.kind === "cellar" ? "" : `${priceHtml(w)} · `}${esc(sourceLabel(w.source))} →</button></li>`).join("")}</ul>` : "") +
    (hits.length ? "" : `<p>Nothing by that name in ${esc(andWords(tickedNames()) || "what's ticked")}.</p>`) +
    (hits.some((w) => fold(w.name) === fold(q)) ? "" : `<button type="button" class="btn btn-somm" data-somm="pair-typed">Pair “${esc(q)}” as typed</button>`);
}, 300);

document.addEventListener("click", async (e) => {
  if ($("somm-country-msg") && !e.target.closest?.('[data-somm="pair-country"]')) $("somm-country-msg").textContent = "";
  const t = e.target.closest("#somm [data-somm], #somm [data-somm-tab], #somm [data-somm-wine], #somm [data-somm-find], [data-somm-recipe], #somm [data-somm-mood], #somm [data-wine-food], #somm [data-somm-col], #somm [data-somm-pop], #somm [data-pairs-food], #somm-pop [data-somm], #mc-pairbar [data-somm], #mc-panel [data-somm-pop]");
  if (!t) return;
  await loadSomm();
  if (t.dataset.sommMood) { // a quick pick narrows the Find list; pressed again, it lets go
    const k = t.dataset.sommMood;
    findF.preset = findF.preset === k ? "" : k;
    renderMoods(); renderFindFilters();
    return runFind();
  }
  if (t.dataset.sommTab) {
    sommTab(t.dataset.sommTab);
    if (t.dataset.sommTab === "wine") $("somm-q").focus(); // the tab may be open already: show where to start
    return;
  }
  if (t.dataset.sommWine) { const w = findWine(t.dataset.sommWine); if (w) openWine(w, false); return; }
  if (t.dataset.sommPop) return popWine(t.dataset.sommPop);
  if (t.dataset.pairsFood) {
    for (const b of document.querySelectorAll("#somm [data-pairs-food]")) b.setAttribute("aria-pressed", String(b === t));
    return showWineFood(pairsFoodHtml(t.dataset.pairsFood), t.dataset.pairsFood);
  }
  if (t.dataset.sommCol) {
    const k = t.dataset.sommCol, first = answerOpts.sorts[0];
    if (first.col === k) first.dir = -first.dir;
    else answerOpts.sorts = [{ col: k, dir: 1 }, ...answerOpts.sorts.filter((o) => o.col !== k)].slice(0, 3);
    while (answerOpts.sorts.length < 3) answerOpts.sorts.push({ col: "", dir: 1 });
    redrawAnswer();
    return;
  }
  if (t.dataset.wineFood && wineNow) {
    for (const b of document.querySelectorAll("#somm button.somm-food[data-wine-food]")) b.setAttribute("aria-pressed", String(b.dataset.wineFood === t.dataset.wineFood));
    return showWineFood(wineFoodHtml(wineNow.w, wineNow.typed, t.dataset.wineFood), t.dataset.wineFood);
  }
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
  if (a === "surprise") showOut(surpriseHtml());
  else if (a === "clear-sources" || a === "all-sources") {
    for (const b of document.querySelectorAll("#somm [data-somm-store], #somm [data-somm-cellar]")) b.checked = a === "all-sources";
    fillCountrySelects(); renderMoods(); renderUsing();
  } else if (a === "start-again") startAgain();
  else if (a === "to-step1" || (a === "edit-sources" && !sommEditSources)) {
    if (sommRoute) { sommEditSources = true; renderTrail(); }
    $("somm-stores").scrollIntoView({ block: "center" });
  } else if (a === "edit-sources") { sommEditSources = false; renderTrail(); }
  else if (a === "to-step2") { sommTab(""); $("somm-s2").scrollIntoView({ block: "center" }); }
  else if (a === "print-out") printOut(t.dataset.printTitle);
  else if (a === "close-pop") $("somm-pop").close();
  else if (a === "see-pairs") { if ($("somm-pop").open) $("somm-pop").close(); if ($("view-somm").hidden) showView("somm"); seePairs(); }
  else if (a === "clear-pairs") {
    for (const w of pairList.slice()) togglePair(w.id);
    renderPairBar();
    if (sommRoute === "menu") renderDinnerQ();
  }
  else if (a === "fridge") runFridge();
  else if (a === "other-food") {
    for (const b of document.querySelectorAll("#somm [data-wine-food], #somm [data-pairs-food]")) b.setAttribute("aria-pressed", "false");
    showWineFood("", "");
    $("somm-wine-answer").scrollIntoView({ block: "start" });
  } else if (a === "other-wine") startAgain();
  else if (a === "back-list") showOut(`<div id="somm-cellar-answer">${answerBodyHtml()}</div>`);
  else if (a === "pair-typed") {
    const q = $("somm-q").value.trim();
    if (q) showOut(wineStartHtml({ id: "typed", name: q, kind: "typed" }, true));
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
    $("somm-country-msg").textContent = country ? "" : "Choose a country first.";
    if (!country) { $("somm-country").focus(); return; }
    showOut(countryPairingHtml(country, sommPool({ stores: sommStores(), country, colour: $("somm-colour").value, maxPrice: sommNum("somm-price") })));
  } else if (a === "cook") {
    if (sommStores().length) await loadWe();
    runCook();
  } else if (a === "menu") {
    const o = readDinner();
    if (!o.courses.length) { showOut(`<div class="somm-card"><p>Tick at least one course.</p></div>`); return; }
    dinnerOpts = o;
    showOut(dinnerHtml());
  } else if ((a === "menu-swap" || a === "menu-add") && dinnerOpts) {
    const c = t.dataset.course;
    if (a === "menu-add") dinnerOpts.add.add(c);
    else { const cur = lastMenu?.plan.find((p) => p.c === c)?.w; if (cur) (dinnerOpts.swap[c] ||= new Set()).add(cur.id); }
    const y = window.scrollY; $("somm-out").innerHTML = dinnerHtml(); window.scrollTo(0, y);
  } else if (a === "find-list") runFind();
  else if (a === "dinner-shop") { const box = $("somm-dinner-shop"); if (box) { box.innerHTML = box.innerHTML ? "" : dinnerShopHtml(); if (box.innerHTML) box.scrollIntoView({ block: "start" }); } }
  else if (a === "just-wine") {
    const w = findWine(t.dataset.id) || pairWines().find((x) => x.id === t.dataset.id);
    if (w) openWineFood(w, t.dataset.food || "");
  } else if (a === "drop-wine") {
    togglePair(t.dataset.id);
    if (pairList.length >= 2) seePairs();
    else if (pairList.length === 1) openWine(findWine(pairList[0].id) || pairList[0], false);
    else showOut(`<div class="somm-card"><p>No wines picked now. Tick some in a list, or search for one above.</p></div>`);
  } else if (a === "dinner-from-choice") {
    const fixed = {};
    for (const sel of document.querySelectorAll("#somm-out [data-dinner-course]")) fixed[sel.dataset.dinnerCourse] = sel.value;
    const ids = [...new Set(Object.values(fixed).filter(Boolean))];
    startDinner(ids.map((id) => findWine(id) || pairWines().find((x) => x.id === id)).filter(Boolean), Object.keys(fixed), fixed);
  }
  else if ((a === "dinner-add-course" || a === "dinner-each") && dinnerOpts) {
    if (a === "dinner-add-course") { const c = t.dataset.course; if (!dinnerOpts.courses.includes(c)) dinnerOpts.courses.push(c);
      const b = document.querySelector(`#somm [data-somm-course][value="${c}"]`); if (b) b.checked = true; }
    else { dinnerOpts.mode = "each"; const r = document.querySelector('#somm [name=somm-nwines][value="each"]'); if (r) r.checked = true; }
    const y = window.scrollY; $("somm-out").innerHTML = dinnerHtml(); window.scrollTo(0, y);
  }
  else if (a === "to-find") { sommTab("wine"); $("somm-wine").scrollIntoView({ block: "start" }); }
  else if (a === "dinner-from-wine" && wineNow && !wineNow.typed) startDinner([wineNow.w]);
  else if (a === "dinner-from-pairs") {
    startDinner(pairWines(), t.dataset.courses?.split(","));
  } else if (a === "ask-menu" && lastMenu) {
    const prompt = menuPrompt(lastMenu), { url } = claudeLink(prompt);
    const r = await openClaudeHere(url, prompt);
    $("somm-ask-msg").innerHTML = newTabMessage(r, url);
  } else if (a === "menu-all" && lastMenu) {
    for (const w of new Set(lastMenu.plan.map((p) => p.w).filter(Boolean))) if (!onShopping(w.id)) toggleShopping(w.id);
    t.textContent = "✓ All on the Comparison List";
  }
});
document.addEventListener("change", (e) => { if (e.target.matches?.("#somm [data-somm-store], #somm [data-somm-cellar]")) { fillCountrySelects(); renderMoods(); renderUsing(); } });
document.addEventListener("input", (e) => { if (e.target.id === "somm-q") renderSommHits(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "somm-q") { e.preventDefault(); document.querySelector('#somm [data-somm="pair-typed"]')?.click(); }
});
// ==== Find a wine, the store column, the answers and the dinner (2026-11-19) =====================
const andWords = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] || "");
const tickedNames = () => [...sommCellars(), ...sommStores().map(sourceLabel)];
const theStore = (st) => (st.length === 1 ? (st[0] === "LCBO" ? "the LCBO" : sourceLabel(st[0])) : andWords(st.map(sourceLabel)));

// ---- Find a wine: what's ticked, in words, and the filters -----------------------------------
function renderFindIntro() {
  const el = $("somm-wine-intro"), qh = $("somm-q-h");
  if (!el) return;
  const cel = sommCellars(), st = sommStores();
  if (qh) qh.textContent = tickedNames().length ? `Search ${andWords(tickedNames())}` : "Search for a wine";
  el.innerHTML = !cel.length && !st.length ? "Tick a cellar or a store in step 1 first."
    : cel.length && st.length ? `Choosing from <strong>${esc(andWords(cel))}</strong>, with what <strong>${esc(theStore(st))}</strong> ${st.length > 1 ? "sell" : "sells"} of it: the <strong>At ${esc(theStore(st))}</strong> column says whether you can buy each wine there, and at what price. To browse the store's own list instead, choose it under <strong>Where</strong>.`
    : cel.length ? `Choosing from <strong>${esc(andWords(cel))}</strong>. Search for a wine, use a quick pick, or narrow the cellar down below.`
    : `Choosing from <strong>${esc(theStore(st))}</strong>. Search for a wine you know, or narrow the list down below.`;
}
const FIND0 = { where: "", colour: "", country: "", grape: "", price: "", band: "", score: "", rep: "", body: "", sweet: "", drink: "", age: "", atStore: "", preset: "" };
let findF = { ...FIND0 };
const styleOfW = (w, k) => { try { return wineStyle(w)[k].v; } catch { return null; } };
function findBase() {
  const cel = sommCellars(), st = sommStores(), seen = new Set();
  const all = sommPool({ stores: st }).filter((w) => { if (w.kind === "cellar") return true;
    const k = `${w.source}|${fold(w.name)}|${w.vintage || ""}|${w.price}|${w.size_ml || ""}`; return !seen.has(k) && seen.add(k); });
  if (!cel.length || !st.length || findF.where === "all") return all;
  return findF.where === "store" ? all.filter((w) => w.kind !== "cellar") : all.filter((w) => w.kind === "cellar");
}
function findPasses(w) {
  const f = findF, sc = realScore(w), cellar = w.kind === "cellar";
  if (f.preset && (!cellar || !MOODS[f.preset]?.test(w))) return false;
  if (f.colour && w.type !== f.colour) return false;
  if (f.country && w.country !== f.country) return false;
  if (f.grape && !sommKeys(w).includes(f.grape)) return false;
  if (f.price && !cellar && !((priceOf(w) ?? Infinity) <= +f.price)) return false;
  if (f.price && cellar && f.atStore && !atStoreOf(w)) return false;
  if (f.band && cellar && String(cellarBand(w)) !== f.band) return false;
  if (f.score && !(sc >= +f.score)) return false;
  if (f.rep && !cellar && !(((weIndex && weOf(w)?.[3]) || 0) >= +f.rep)) return false;
  if (f.body && styleOfW(w, "body") !== f.body) return false;
  if (f.sweet) { const v = sweetV(w); if (f.sweet === "sweet" ? !["medium-sweet", "sweet"].includes(v) : (v || "dry") !== f.sweet) return false; }
  if (f.drink && cellar) { const g = drinkStage(w);
    if (f.drink === "open" ? g === "wait" : f.drink === "first" ? !["first", "soon"].includes(g) : f.drink === "peak" ? !atPeak(w) : g !== "wait") return false; }
  if (f.age && !(w.vintage && THIS_YEAR - w.vintage >= +f.age)) return false;
  if (f.atStore && cellar && !(f.atStore === "same" ? ["exact"] : ["exact", "vintage"]).includes(atStoreOf(w)?.kind)) return false;
  if (f.atStore && !cellar) return false; // "only cellar wines I can buy there": the store's own list stays out
  return true;
}
function renderFindFilters() {
  const box = $("somm-filters");
  if (!box) return;
  const cel = sommCellars(), st = sommStores(), both = cel.length && st.length;
  if (!both) { findF.where = ""; findF.atStore = ""; }
  const pool = findBase().filter((w) => !findF.preset || (w.kind === "cellar" && MOODS[findF.preset]?.test(w))), hasStore = pool.some((w) => w.kind !== "cellar"), hasCellar = pool.some((w) => w.kind === "cellar");
  const sel = (k, label, opts) => `<label class="somm-filter"><span>${esc(label)}</span><select data-find="${k}">${opts.map(([v, l]) =>
    `<option value="${esc(v)}"${String(findF[k]) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const uniq = (get) => [...new Set(pool.map(get).filter((v) => v && v !== "Country not stated"))].sort((a, b) => String(a).localeCompare(String(b)));
  const grapes = new Map();
  for (const w of pool) for (const g of sommKeys(w)) grapes.set(g, (grapes.get(g) || 0) + 1);
  const gList = [...grapes].sort((a, b) => b[1] - a[1]).slice(0, 80).sort((a, b) => a[0].localeCompare(b[0]));
  const parts = [];
  if (both) { // one question: which wines, from the cellar, the store or both
    const which = findF.where === "store" ? "store" : findF.where === "all" ? "all" : findF.atStore || "cellar", c = andWords(cel), sh = theStore(st);
    const opts = [["cellar", `All of ${c}'s wines`], ["any", `${c}'s wines I can also buy at ${sh} (any vintage)`], ["same", `${c}'s wines I can also buy at ${sh} (same vintage)`],
      ...(findF.preset ? [] : [["store", `${capFirst(sh)}'s own wines`], ["all", `Both: ${c}'s and ${sh}'s`]])];
    parts.push(`<label class="somm-filter somm-which"><span>Which wines?</span><select data-find="which">${opts.map(([v, l]) => `<option value="${v}"${which === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`);
  }
  parts.push(sel("colour", "Colour", [["", "Any colour"], ...uniq((w) => w.type).map((v) => [v, v])]));
  parts.push(sel("country", "Country", [["", "Any country"], ...uniq((w) => w.country).map((v) => [v, v])]));
  parts.push(sel("grape", "Grape", [["", "Any grape"], ...gList.map(([g, n]) => [g, `${g} (${n})`])]));
  if (hasStore) parts.push(`<label class="somm-filter"><span>Store price up to $</span><input type="number" data-find="price" min="0" step="1" inputmode="numeric" value="${esc(findF.price)}" placeholder="any"></label>`);
  if (hasCellar) parts.push(sel("band", "Price band", [["", "Any band"], ...Object.entries(BAND_WORDS).map(([k, v]) => [k, capFirst(v)])]));
  parts.push(sel("score", "Score at least", [["", "Any"], ["88", "88"], ["90", "90"], ["92", "92"], ["95", "95"]]));
  if (hasStore) parts.push(sel("rep", "Producer's reputation at least", [["", "Any"], ["88", "88"], ["90", "90"], ["92", "92"]]));
  parts.push(sel("body", "Body", [["", "Any"], ["light", "Light"], ["medium", "Medium"], ["full", "Full"]]));
  parts.push(sel("sweet", "Sweetness", [["", "Any"], ["dry", "Dry"], ["off-dry", "Off-dry"], ["sweet", "Sweet"]]));
  if (hasCellar) parts.push(sel("drink", "Drink window", [["", "Any"], ["open", "Ready to open"], ["first", "Drink soon"], ["peak", "At its peak"], ["wait", "Not ready yet"]]));
  parts.push(sel("age", "Age", [["", "Any"], ["10", "10 years or older"], ["15", "15 years or older"], ["20", "20 years or older"]]));
  const on = Object.keys(FIND0).filter((k) => !["where", "atStore", "preset"].includes(k) && findF[k]).length;
  if ($("somm-narrow-h")) $("somm-narrow-h").textContent = findF.preset ? `Narrow down ${MOODS[findF.preset].label.replace(/^The /, "the ")}` : "Narrow it down";
  box.innerHTML = `<div class="somm-filters">${parts.join("")}</div>
    ${both && findF.atStore && findF.price ? `<p class="hint">The store price limit applies to the price at ${esc(theStore(st))}.</p>` : ""}
    ${on ? `<p><button type="button" class="btn btn-mini" data-somm="find-clear">Clear these choices</button></p>` : ""}
    ${hasStore ? `<p class="hint">Producer's reputation: the producer's average in Wine Enthusiast's reviews, not this bottle's score.</p>` : ""}`;
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.matches?.("#somm-filters [data-find]")) return;
  if (t.dataset.find === "which") {
    const v = t.value;
    findF.where = v === "store" || v === "all" ? v : "";
    findF.atStore = v === "any" || v === "same" ? v : "";
  } else findF[t.dataset.find] = t.type === "checkbox" ? t.checked : t.value;
  renderFindFilters();
  if (answerArgs?.kind === "find" && $("somm-cellar-answer")) runFind(false);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest?.('#somm [data-somm="find-clear"]')) return;
  findF = { ...FIND0, where: findF.where, atStore: findF.atStore, preset: findF.preset };
  renderFindFilters();
  if (answerArgs?.kind === "find" && $("somm-cellar-answer")) runFind(false);
});
async function runFind(jump = true) {
  if (sommStores().length) await loadWe();
  atLimit = { max: findF.atStore && findF.price ? +findF.price : null, same: findF.atStore === "same" };
  const rows = findBase().filter(findPasses).map((w) => ({ w, t: 0 }));
  const f = findF, bits = [f.colour, f.country, f.grape, f.price && `up to $${f.price}`, f.band && BAND_WORDS[f.band], f.score && `${f.score}+ points`,
    f.rep && `producer ${f.rep}+`, f.body && `${f.body}-bodied`, f.sweet, f.drink && { open: "ready to open", first: "drink soon", peak: "at its peak", wait: "not ready yet" }[f.drink],
    f.age && `${f.age}+ years`, f.atStore && `also at ${theStore(sommStores())}${f.atStore === "same" ? " (same vintage)" : ""}`].filter(Boolean);
  const pre = findF.preset ? MOODS[findF.preset] : null;
  const html = cellarAnswerHtml(rows, null, "", pre?.line || "", [pre?.label, bits.length ? capFirst(bits.join(", ")) : ""].filter(Boolean).join(": ") || "All the wines", "find");
  if (jump) showOut(html);
  else { $("somm-out").innerHTML = html; renderPairBar(); }
}

// ---- A cellar wine at the stores ticked ---------------------------------------------------------
// ✓ the same wine and vintage, ≈ the same wine in another vintage (cellarMatches' careful name
// match), else the producer's other wines there (Wine Enthusiast's producer match, same country).
let prodIdx = null, prodIdxKey = "";
function producerAtStores(p, st) {
  const key = `${st.join("|")}|${WINES.length}|${weIndex ? 1 : 0}`;
  if (prodIdxKey !== key) {
    prodIdx = new Map(); prodIdxKey = key;
    for (const x of WINES) if (st.includes(x.source)) { const q = weOf(x); if (q) (prodIdx.get(q) || prodIdx.set(q, []).get(q)).push(x); }
  }
  return prodIdx.get(p) || [];
}
// The store listings of this very wine: the name match, kept only when the reviews don't name two
// different producers (Bouchard's Meursault Perrières is not Château de Meursault's); and failing
// that, one of the producer's listings whose name is the same wine (Château d'Armailhac).
// A listing must name the wine's maker: the producer's own word ("Lagrange", "Fèvre"), or a word
// of the wine's name that isn't a place, grape or label word ("Melchor"). "Chablis Grand Cru Les
// Clos" names no one, so it can't be told apart from a dozen other growers' Les Clos.
const LABEL_WORDS = new Set(["grand", "cru", "premier", "les", "clos", "domaine", "chateau", "reserva", "reserve", "riserva", "vieilles", "vignes",
  "cuvee", "blanc", "rouge", "estate", "vineyard", "vineyards", "old", "vines", "selection", "especial", "special", "superieur", "superiore", "classico"]);
function namesProducer(w, x, mine) {
  const st = gemTokens(`${x.name} ${x.producer || ""}`);
  if (mine && gemWords(mine[0]).some((t) => st.includes(t))) return true;
  const wt = new Set(gemTokens(w.name));
  return st.some((t) => wt.has(t) && t.length > 3 && !GRAPE_WORDS.has(t) && !isPlaceWord(t) && !LABEL_WORDS.has(t));
}
function storeListings(w, st) {
  const mine = weIndex ? weOf(w) : null;
  const age = (n) => (fold(n).match(/\b(10|20|30|40)\s*(year|yr|ans|anos)/) || [])[1] || ""; // a 20-year tawny is not the 10-year
  let list = storeMatchesOf(w.id).filter((x) => st.includes(x.source) && (!mine || !weOf(x) || weOf(x) === mine) && age(x.name) === age(w.name) && namesProducer(w, x, mine));
  if (!list.length && mine) {
    const bare = w.name.replace(/\s(19|20)\d\d$/, "");
    list = producerAtStores(mine, st).filter((x) => typesAgree(x.type, w.type) && sameWineName(bare, x.name.replace(/\s(19|20)\d\d$/, "")));
  }
  return list;
}
// While a find list is narrowed by store price (or to the same vintage), the column shows the
// listing that fits: Clos des Papes at $182 isn't "at the LCBO for $50 or less".
let atLimit = { max: null, same: false };
function atStoreOf(w, lim = atLimit) {
  const st = sommStores();
  if (w.kind !== "cellar" || !st.length) return null;
  const list = storeListings(w, st).filter((x) => x.price != null && (lim.max == null || x.price <= lim.max));
  const same = (x) => (w.vintage ? +x.vintage === +w.vintage : !x.vintage); // NV with NV is the same wine
  const std = (x) => (x.size_ml == null || STANDARD_ML.has(x.size_ml) ? 0 : 1);
  const exact = list.filter(same).sort((a, b) => std(a) - std(b) || a.price - b.price)[0];
  if (exact) return { kind: "exact", s: exact, v: 0 };
  if (lim.same) return null;
  const other = list.slice().sort((a, b) => std(a) - std(b) || (b.vintage || 0) - (a.vintage || 0) || a.price - b.price)[0];
  if (other) return { kind: "vintage", s: other, v: 1 };
  const p = weIndex ? weOf(w) : null, n = p ? producerAtStores(p, st) : [];
  return n.length ? { kind: "producer", n, v: 2 } : null;
}
function atStoreHtml(w) {
  const r = atStoreOf(w), many = sommStores().length > 1;
  if (!r) return "";
  const where = (x) => (x.size_ml && !STANDARD_ML.has(x.size_ml) ? ` (${x.size_ml} ml)` : "") + (many ? ` ${esc(sourceLabel(x.source))}` : "");
  return r.kind === "exact" ? `<span class="at-store at-exact" title="The same wine and vintage">✓ ${money(r.s.price)}${where(r.s)}</span>`
    : r.kind === "vintage" ? `<span class="at-store at-vintage" title="The same wine, another vintage">≈ ${esc(String(r.s.vintage || "NV"))}, ${money(r.s.price)}${where(r.s)}</span>`
    : `<span class="at-store at-producer" title="Wines from the same producer">Producer: ${r.n.length} ${r.n.length === 1 ? "wine" : "wines"}</span>`;
}
// On a cellar wine's own page: the listings, or the nearest wines at the store.
async function fillAtStore(w) {
  const box = $("somm-at-store"), st = sommStores();
  if (!box || w.kind !== "cellar" || !st.length) return;
  await loadWe();
  if (wineNow?.w !== w || !$("somm-at-store")) return;
  const where = theStore(st), list = storeListings(w, st).sort((a, b) => (+b.vintage === +w.vintage) - (+a.vintage === +w.vintage) || (a.price ?? 1e9) - (b.price ?? 1e9));
  let body;
  if (list.length) body = `<ul class="somm-bottles">${list.slice(0, 4).map((x) => sommRow(x, `<div>${w.vintage && +x.vintage === +w.vintage ? "<strong>✓ The same wine and vintage</strong>" : `≈ The same wine, ${esc(String(x.vintage || "no"))} vintage`}</div>`)).join("")}</ul>`;
  else {
    const p = weIndex ? weOf(w) : null;
    let near = (p ? producerAtStores(p, st) : []).slice().sort(byBest).slice(0, 3).map((x) => ({ x, why: `The same producer (${p[0]})` }));
    if (!near.length) { const g = gemGrapes(w)[0], ar = gemArea(w);
      if (g && ar) near = WINES.filter((x) => st.includes(x.source) && x.type === w.type && gemGrapes(x).includes(g) && gemArea(x) === ar).sort(byBest).slice(0, 3).map((x) => ({ x, why: `${g} from ${ar}` })); }
    body = `<p>${esc(capFirst(where))} doesn't list this wine.${near.length ? " The nearest there:" : " Nothing close to it there either."}</p>${near.length ? `<ul class="somm-bottles">${near.map(({ x, why }) => sommRow(x, `<div>${esc(why)}</div>`)).join("")}</ul>` : ""}`;
  }
  box.innerHTML = `<div class="somm-card"><h3 class="somm-wine-h">🛒 At ${esc(where)}</h3>${body}</div>`;
}

// ---- One wine: the main course and a recipe, before any question --------------------------
const MAIN_FOODS = ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood", "Pasta and pizza", "Spicy food"];
function mainCoursesHtml(w, typed) {
  const keys = bookKeys(sommKeys(w), !typed && isSweetWine(w)), rate = (f) => foodRating(w, typed, f).t || 0;
  const top = (list, min) => list.map((f) => ({ f, t: rate(f) })).filter((x) => x.t >= min).sort((a, b) => b.t - a.t).slice(0, 3);
  let best = top(MAIN_FOODS, 2), title = "Main courses for this wine";
  if (!best.length) best = top(MAIN_FOODS, 1); // the wine's own food list, when the books give no stronger rating
  if (!best.length) { best = top(FOODS, 1); title = "Best with"; }
  if (!best.length) return "";
  const li = ({ f, t }) => { const { ds, why } = wineDishes(w, f, keys), dishes = ds.length ? ds.map((d) => d.dish).slice(0, 4).join(", ") : typed ? "" : pairDish(w, f);
    return `<li><span class="food-star tier-${t}">${STARS(t)}</span> ${foodIcon(f)}<strong>${esc(f)}</strong>${dishes ? `: ${esc(dishes)}` : ""}${why ? `. <span class="somm-why">${esc(capFirst(why.why))}${srcSpan(why.b, why.p)}</span>` : ""}</li>`; };
  recipesShown = new Set();
  const pick = recipePickHtml(w, best[0].f, 1, 0);
  return `<div class="somm-card somm-lead"><h3 class="somm-wine-h">${esc(title)}</h3><ul class="somm-foods">${best.map(li).join("")}</ul>
    ${pick ? `<h4>📖 A recipe to cook tonight (${esc(best[0].f.toLowerCase())})</h4>${pick.replace('<details class="somm-recipe"', '<details class="somm-recipe" open')}` : ""}
    ${typed ? "" : `<p><button type="button" class="btn btn-somm btn-big" data-somm="dinner-from-wine">🧀 Make a dinner of it →</button></p>`}</div>`;
}

// ---- Several wines: what they point to, in plain words ------------------------------------
function styleWord(w) {
  if (isSweetWine(w)) return "sweet wine";
  if (w.type === "Sparkling") return "sparkling wine";
  const b = styleOfW(w, "body"), colour = (w.type || "wine").toLowerCase();
  const bw = (w.type === "White" ? { light: "crisp", medium: "medium-bodied", full: "full-bodied" } : { light: "light", medium: "medium-bodied", full: "full-bodied" })[b];
  return `${bw ? `${bw} ` : ""}${colour}`;
}
const styleMany = (word, n) => (n === 1 ? word : word.endsWith("wine") ? `${word}s` : /(red|white|rosé)$/.test(word) ? `${word}s` : word);
function courseForGroup(ws, foods) {
  if (ws.every(isSweetWine)) return "dessert";
  const top = foods[0]?.f;
  if (top === "Cheese") return "cheese";
  if (ws.every((w) => w.type === "Sparkling" || (w.type === "White" && styleOfW(w, "body") === "light"))) return "starter";
  if (top && ["Fish", "Seafood"].includes(top) && ws.every((w) => w.type !== "Red")) return "starter";
  return "main";
}
function selectionReadHtml(wines) {
  // grouped by kind (reds, whites, sweet, sparkling); a group is named by its body only when all agree
  const kindOf = (w) => (isSweetWine(w) ? "sweet" : w.type === "Sparkling" ? "sparkling" : w.type || "wine");
  const byKind = new Map();
  for (const w of wines) (byKind.get(kindOf(w)) || byKind.set(kindOf(w), []).get(kindOf(w))).push(w);
  const groups = new Map([...byKind.values()].map((ws) => { const words = [...new Set(ws.map(styleWord))];
    return [words.length === 1 ? words[0] : (ws[0].type || "wine").toLowerCase(), ws]; }));
  const rate = (w, f) => foodRating(w, false, f).t || 0;
  const parts = [...groups].map(([word, ws]) => {
    const foods = FOODS.map((f) => ({ f, lo: Math.min(...ws.map((w) => rate(w, f))) })).filter((x) => x.lo > 1).sort((a, b) => b.lo - a.lo).slice(0, 2);
    const dish = foods[0] ? (wineDishes(ws[0], foods[0].f, bookKeys(sommKeys(ws[0]), isSweetWine(ws[0]))).ds.slice(0, 2).map((d) => d.dish).join(", ") || pairDish(ws[0], foods[0].f)) : "";
    return { word, ws, foods, dish, course: courseForGroup(ws, foods) };
  });
  // two groups on the main course: the reds keep it, the other moves to the starter
  if (parts.filter((g) => g.course === "main").length > 1) for (const g of parts) if (g.course === "main" && !g.ws.every((w) => w.type === "Red")) g.course = "starter";
  const tally = andWords(parts.map((g) => `${g.ws.length} ${styleMany(g.word, g.ws.length)}`));
  // the same wine in two or more vintages: open the one whose window closes first
  const bare = (w) => fold(w.name.replace(/\s(19|20)\d\d$/, "")), sameWine = new Map();
  for (const w of wines) (sameWine.get(bare(w)) || sameWine.set(bare(w), []).get(bare(w))).push(w);
  const vint = [...sameWine.values()].filter((ws) => ws.length > 1).map((ws) => {
    const o = ws.slice().sort((a, b) => (a.drink_to ?? 9999) - (b.drink_to ?? 9999) || (a.vintage ?? 0) - (b.vintage ?? 0)), first = o[0];
    const until = (w) => (w.drink_to ? (w === first ? `ready until ${w.drink_to}` : `the ${w.vintage || "NV"} keeps until ${w.drink_to}`) : "");
    const why = o.map(until).filter(Boolean).join("; ");
    return `<p>🍷 <strong>${ws.length === 2 ? "Two" : ws.length} vintages of the same wine:</strong> open the ${esc(String(first.vintage || "NV"))} first${why ? ` (${esc(why)})` : ""}.</p>`;
  }).join("");
  const who = (g) => (g.ws.length === 1 ? `The ${esc(g.ws[0].name)}` : `The ${esc(styleMany(g.word, 2))}`);
  const lines = parts.map((g) => `<li>${who(g)} ${g.foods.length ? `${g.ws.length === 1 ? "points" : "all point"} to <strong>${esc(andWords(g.foods.map((x) => x.f.toLowerCase())))}</strong>${g.dish ? ` (${esc(g.dish)})` : ""}.`
    : `${g.ws.length === 1 ? "has" : "have"} no food the books rate highly for ${g.ws.length === 1 ? "it" : "all of them"}.`}</li>`).join("");
  const courses = [...new Set(parts.map((g) => g.course))];
  const plan = parts.length > 1 ? `<p>👉 <strong>Suggested:</strong> ${andWords(parts.map((g) => `${g.ws.length === 1 ? `the ${esc(g.ws[0].name)}` : `the ${esc(styleMany(g.word, 2))}`} with ${{ starter: "a starter", main: "the main course", cheese: "the cheese", dessert: "dessert" }[g.course]}`))}.</p>` : "";
  return `<div class="somm-card somm-read"><h3 class="somm-wine-h">You've picked ${wines.length} wines: ${esc(tally)}</h3><ul>${lines}</ul>${vint}${plan}
    <p><button type="button" class="btn btn-somm btn-big" data-somm="dinner-from-pairs" data-courses="${esc((parts.length > 1 ? courses : ["main"]).join(","))}">🧀 Plan this dinner →</button></p></div>`;
}

// ---- Plan a dinner: the questions, and the plan ---------------------------------------------
let dinnerAnchors = [], dinnerOpts = null, dinnerFixed = null;
const AVOID_FOODS = { meat: ["Red meat", "Lamb", "Pork", "Chicken", "Fish", "Seafood"], fish: ["Fish", "Seafood"], pork: ["Pork"] };
const COURSE_WORDS = { starter: "a starter", main: "the main course", cheese: "the cheese", dessert: "dessert" };
function renderDinnerQ() {
  const box = $("somm-menu-anchor");
  if (!box) return;
  const picks = dinnerAnchors.length ? dinnerAnchors : pairWines();
  box.innerHTML = picks.length ? `<h4>Do you have a wine in mind?</h4>
      <div class="somm-foods-pick"><label class="somm-food"><input type="radio" name="somm-anchor" value="mine" checked> Yes: build it around ${picks.length === 1 ? "this wine" : `these ${picks.length} wines`}</label>
        <label class="somm-food"><input type="radio" name="somm-anchor" value=""> No, you choose the wines</label></div>
      <p>${picks.map((w) => `<span class="chip">${pickWords(w)}</span>`).join(" ")}</p>
      ${dinnerAnchors.length ? "" : `<p class="hint">These are the wines on your Pairings list. <button type="button" class="linklike" data-somm="clear-pairs">✕ Clear them</button> to start without them.</p>`}`
    : `<h4>Do you have a wine in mind?</h4><p>No wine picked yet, so I'll choose from ${esc(andWords(tickedNames()) || "what's ticked")}. Or <button type="button" class="linklike" data-somm="to-find">find a wine first</button> and press <strong>Make a dinner of it</strong>.</p>`;
  if ($("somm-special-cellar")) $("somm-special-cellar").hidden = !sommCellars().length;
  const fromBox = $("somm-from-q");
  if (fromBox) { const both = sommCellars().length && sommStores().length, c = andWords(sommCellars()), sh = theStore(sommStores());
    const was = document.querySelector("#somm [name=somm-from]:checked")?.value || "";
    fromBox.hidden = !both;
    fromBox.innerHTML = both ? `<h4>Where should the other wines come from?</h4><div class="somm-foods-pick">${[["", "Either: the best match"], ["cellar", c], ["store", `${capFirst(sh)} (to buy)`]].map(([v, l]) =>
      `<label class="somm-food"><input type="radio" name="somm-from" value="${v}"${was === v ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>` : ""; }
  if ($("somm-special-store")) $("somm-special-store").hidden = !sommStores().length;
}
function startDinner(wines, courses = null, fixed = null) {
  sommTab("menu");
  dinnerAnchors = wines.slice();
  dinnerFixed = fixed;
  if (courses?.length) for (const b of document.querySelectorAll("#somm [data-somm-course]")) b.checked = courses.includes(b.value);
  if (wines.length > 1 || fixed) { const r = document.querySelector('#somm [name=somm-nwines][value="each"]'); if (r) r.checked = true; }
  renderDinnerQ();
  $("somm-menu").scrollIntoView({ block: "start" });
}
function readDinner() {
  const v = (n) => document.querySelector(`#somm [name=${n}]:checked`)?.value ?? "";
  const picks = dinnerAnchors.length ? dinnerAnchors : pairWines();
  return { courses: [...document.querySelectorAll("#somm [data-somm-course]:checked")].map((b) => b.value), protein: v("somm-protein"),
    avoid: [...document.querySelectorAll("#somm [data-somm-avoid]:checked")].map((b) => b.value), mode: v("somm-nwines") || "one",
    special: v("somm-special"), maxPrice: sommNum("somm-menu-price"), country: $("somm-menu-country")?.value || "", guests: sommNum("somm-guests"),
    anchors: v("somm-anchor") === "mine" ? picks : [], stores: sommStores(), from: v("somm-from") || "", swap: {}, add: new Set(),
    fixed: v("somm-anchor") === "mine" ? dinnerFixed : null };
}
// "How special": cellar wines only (store wines go by the price a bottle).
function specialOk(w, special) {
  if (!special || w.kind !== "cellar") return true;
  const sc = realScore(w) ?? 0, band = cellarBand(w);
  return special === "treasure" ? sc >= 95 : special === "good" ? sc >= 90 : sc < 92 && (!band || band <= 2);
}
const courseFoodOf = (p) => (p.c === "cheese" ? "Cheese" : p.c === "dessert" ? "Dessert" : p.food);
const courseTier = (w, f) => (w && f && foodsOf(w).includes(f) ? Math.max(wineTier(w, f), ...bookKeys(w).map((k) => grapeFoodTier(k, f))) : 0);
function bestMainFood(w, banned) {
  return MAIN_FOODS.filter((f) => !banned.has(f) && f !== "Spicy food").sort((a, b) => courseTier(w, b) - courseTier(w, a))[0] || "Pasta and pizza";
}
function planDinner(o) {
  const banned = new Set(o.avoid.flatMap((a) => AVOID_FOODS[a] || []));
  const protein = banned.has(o.protein) ? "" : o.protein, order = Object.keys(COURSES);
  // the other wines: from the cellar, the store or either (o.from), when both are ticked
  const base = { country: o.country, protein, stores: o.from === "cellar" ? [] : o.stores, cellars: o.from === "store" ? [] : sommCellars(),
    maxPrice: o.maxPrice, banned, keep: (w) => specialOk(w, o.special), exclude: o.swap };
  const anchorIds = new Set(o.anchors.map((w) => w.id));
  const courses = o.courses.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const fromPool = (cs, skip, ceiling = null) => buildMenu({ ...base, courses: cs, nWines: cs.length, ceiling, exclude: Object.fromEntries(cs.map((c) => [c, new Set([...(o.swap[c] || []), ...skip])])) }).plan;
  let plan, pool = 0;
  const first = courses.includes("main") ? "main" : courses[0];
  if (o.mode === "one") {
    // one bottle: the chosen wine (or the best for the first course), on every course it suits
    const mine = o.anchors.filter((w) => !o.swap[first]?.has(w.id));
    let w = mine.length ? buildMenu({ ...base, courses: [first], pool: mine }).plan[0]?.w || mine[0] : null;
    if (!w) { const m = buildMenu({ ...base, courses: [first], nWines: 1 }); w = m.plan[0]?.w || null; pool = m.pool; }
    const mainFood = protein || (w ? bestMainFood(w, banned) : "");
    plan = courses.map((c) => {
      const food = c === "main" ? mainFood : c === "starter" ? (w ? (COURSE_FOODS.starter.filter((f) => !banned.has(f)).sort((a, b) => courseTier(w, b) - courseTier(w, a))[0]) : "") : "";
      const p = { c, food, w, note: "", anchor: !!w && anchorIds.has(w.id) };
      const fits = !w ? false : c === "dessert" ? isSweetWine(w) : c === first || courseTier(w, courseFoodOf(p)) >= 2;
      if (!fits) {
        p.w = null; p.anchor = false;
        p.note = !w ? `No wine suits this course in ${tickedWord()}.` : c === "dessert" ? "This wine won't suit a sweet course. Serve coffee, or add a sweet wine."
          : c === "cheese" ? "This wine isn't a natural match for cheese: serve the cheese with the last of it, or add a wine." : "Not a natural match for this course: open it with the main, or add a wine.";
        // another of the chosen wines that suits this course comes before "add a wine"
        const alt = o.anchors.find((x) => x !== w && (c === "dessert" ? isSweetWine(x) : !isSweetWine(x) || c === "cheese") && (c === "dessert" || courseTier(x, courseFoodOf(p)) >= 2));
        if (alt) { p.w = alt; p.anchor = true; p.note = "Your other chosen wine: it suits this course."; }
        else if (o.add.has(c)) { const q = fromPool([c], w ? [w.id] : [])[0]; if (q?.w) { p.w = q.w; p.food = q.food || p.food; p.note = "Added for this course."; } }
      } else if (c !== first) p.note = "The same bottle: it suits this course too.";
      return p;
    });
  } else {
    // a wine with each course: chosen wines on the courses they suit best, the rest from what's ticked
    plan = courses.map((c) => ({ c, w: null, food: "", note: "" }));
    if (o.anchors.length) {
      const mine = buildMenu({ ...base, courses, pool: o.anchors.filter((w) => !Object.values(o.swap).some((s) => s.has(w.id))) }).plan;
      for (const q of mine) if (q.w && !/Same bottle/.test(q.note || "")) { const p = plan.find((x) => x.c === q.c); Object.assign(p, { w: q.w, food: q.food, note: q.note, anchor: true }); }
    }
    const open = plan.filter((p) => !p.w).map((p) => p.c);
    if (open.length) {
      const got = fromPool(open, [...anchorIds], plan.find((p) => p.c === "main")?.w || null);
      for (const q of got) { const p = plan.find((x) => x.c === q.c); Object.assign(p, { w: q.w, food: q.food, note: q.note }); }
      pool = buildMenu({ ...base, courses: open, nWines: open.length }).pool;
    }
    if (o.mode === "auto") { // let the wine decide: a bottle already open goes on to the next course if it suits it
      const lead = plan.find((p) => p.c === first)?.w;
      for (const p of plan) if (p.c !== first && lead && p.w !== lead && !p.anchor && (p.c !== "dessert" || isSweetWine(lead)) && courseTier(lead, courseFoodOf(p)) >= 2) {
        p.w = lead; p.note = "The same bottle as the main course: it suits this too."; }
    }
    for (const p of plan) if (p.c === "main" && !p.food && p.w) p.food = protein || bestMainFood(p.w, banned);
  }
  // the wines chosen course by course on the several-wine page, unless swapped since
  if (o.fixed) for (const p of plan) if (p.c in o.fixed && !o.swap[p.c]) {
    const w = o.anchors.find((x) => x.id === o.fixed[p.c]) || null;
    if (w) { p.w = w; p.anchor = true; p.note = "Your choice for this course."; if (p.c === "main" && !protein) p.food = bestMainFood(w, banned); if (p.c === "starter" && !p.food) p.food = "Seafood"; }
    else if (!o.add.has(p.c)) { p.w = null; p.anchor = false; p.note = "No wine with this course, as you chose."; }
  }
  for (const p of plan) p.dinner = true;
  return { country: o.country, own: false, dinner: true, opts: o, plan, pool };
}
function dinnerHtml() {
  lastMenu = planDinner(dinnerOpts);
  return menuHtml(lastMenu);
}
function dinnerHeadHtml(m, wines) {
  const o = m.opts, n = m.plan.length;
  const built = o.anchors.length ? `, built around ${andWords(o.anchors.map((w) => w.name))}` : "";
  const from = m.pool ? ` Other wines chosen from ${m.pool.toLocaleString()} in ${esc(tickedWord())}${sommCellars().length ? " (cellar wines that are ready to open)" : ""}.` : "";
  let guests = "";
  if (o.guests) {
    const glasses = new Map();
    for (const p of m.plan) if (p.w) glasses.set(p.w, (glasses.get(p.w) || 0) + o.guests * (p.c === "main" ? 2 : 1));
    guests = `<br>For ${o.guests} ${o.guests === 1 ? "guest" : "guests"}: ${[...glasses].map(([w, g]) => `${Math.max(1, Math.ceil(g / 5))} ${Math.ceil(g / 5) > 1 ? "bottles" : "bottle"} of ${esc(w.name)}`).join("; ")} <span class="hint-inline">(about five glasses a bottle; two glasses each with the main)</span>.`;
  }
  const buy = wines.filter((w) => w.kind !== "cellar" && priceOf(w) != null);
  const shop = buy.length ? `<br>🛒 <strong>To buy:</strong> ${buy.map((w) => `${esc(w.name)}, ${money(priceOf(w))} at ${esc(sourceLabel(w.source))}`).join("; ")}.` : "";
  const said = [andWords(m.plan.map((p) => ({ starter: "starter", main: "main course", cheese: "cheese", dessert: "dessert" })[p.c])) + (n === 1 ? " only" : ""),
    o.protein ? o.protein.toLowerCase() : "let the wine decide", ...o.avoid.map((a) => ({ meat: "vegetarian", fish: "no fish or seafood", pork: "no pork" })[a]),
    { one: "one bottle for the whole meal", each: "a wine with each course", auto: "let the wine decide how many" }[o.mode],
    sommCellars().length && sommStores().length ? { "": "other wines from either", cellar: `other wines from ${andWords(sommCellars())}`, store: `other wines from ${theStore(sommStores())}` }[o.from || ""] : "",
    sommCellars().length ? { "": "any cellar wine", everyday: "an everyday bottle", good: "something good (90+)", treasure: "a treasure (95+)" }[o.special || ""] : "",
    o.maxPrice ? `store wines up to ${money(o.maxPrice)}` : "", o.country ? `${o.country} only` : ""].filter(Boolean);
  const unused = o.anchors.filter((w) => !wines.some((x) => x.id === w.id)).map((w) => {
    const why = isSweetWine(w) && !m.plan.some((p) => p.c === "dessert") ? ["it's a dessert wine and Dessert isn't ticked", "dinner-add-course", "dessert", "Add a dessert course"]
      : o.mode === "one" ? ["you asked for one bottle for the whole meal", "dinner-each", "", "Use a wine with each course"]
      : ["it suits none of the courses ticked better than the others", "", "", ""];
    return `<li><strong>${esc(w.name)}</strong> isn't used: ${esc(why[0])}.${why[1] ? ` <button type="button" class="btn btn-mini" data-somm="${why[1]}" data-course="${why[2]}">${esc(why[3])}</button>` : ""}</li>`;
  }).join("");
  return `<span class="somm-asked">You asked for: <strong>${esc(said.join(" · "))}</strong>${o.anchors.length ? `, built around your ${o.anchors.length === 1 ? "chosen wine" : `${o.anchors.length} chosen wines`}` : ""}.</span><br>
    <strong>Your dinner</strong>: ${n} ${n === 1 ? "course" : "courses"}, ${wines.length} ${wines.length === 1 ? "wine" : "wines"}.${from}${guests}${shop}${unused ? `<ul class="somm-unused">${unused}</ul>` : ""}`;
}

// ==== Shopping lists, printing and email for recipes (2026-11-19) ==============================
// A recipe's ingredients as a list to shop from: quantities as the book prints them, sub-headings
// merged, pantry staples set apart, the wine at the foot, and a tick box for what's already in.
const PANTRY_RE = /^(?:(?:kosher|sea|table|coarse|flaky|fine)\s+)?salt\b|^salt and\b|^(?:freshly\s+)?(?:cracked\s+|ground\s+)*(?:black\s+|white\s+)?pepper(?:corns)?\b(?!\s*flakes)|^(?:extra[- ]virgin\s+|light\s+)?olive oil\b|^(?:vegetable|canola|neutral|grapeseed|sunflower)\s+oil\b|^(?:unsalted\s+|salted\s+|cold\s+)?butter\b|^(?:cold\s+|warm\s+|hot\s+|boiling\s+)?water\b|^(?:granulated\s+|white\s+|superfine\s+)?sugar\b|^(?:all[- ]purpose\s+)?flour\b|^ice\b/i;
const QTY_RE = /^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?|[½¼¾⅓⅔])(\s*(?:to|-|–)\s*(?:\d+\/\d+|\d+(?:\.\d+)?))?\s*/;
const UNIT_RE = /^(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz|cloves?|grams?|g|kilograms?|kg|ml|litres?|liters?|pinch(?:es)?|cans?|sprigs?|bunch(?:es)?|slices?|stalks?|heads?)\b\.?\s*(?:of\s+)?/i;
const UNIT_ONE = { tbsp: "tablespoon", tsp: "teaspoon", lb: "pound", lbs: "pound", oz: "ounce", g: "gram", kg: "kilogram", liter: "litre" };
const fracNum = (t) => ({ "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 })[t] ?? t.trim().split(/\s+/).reduce((n, x) => n + (x.includes("/") ? +x.split("/")[0] / +x.split("/")[1] : +x), 0);
function ingParts(line) {
  const FR = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };
  let rest = line.replace(/(\d)?([½¼¾⅓⅔⅛⅜⅝⅞])/g, (m, d, f) => `${d ? `${d} ` : ""}${FR[f]}`) // "1½" as "1 1/2"
    .replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim(), q = null, unit = "";
  const m = rest.match(QTY_RE);
  if (m) { q = m[2] ? null : fracNum(m[1]); rest = rest.slice(m[0].length); } // a range ("2 to 3") isn't added up
  const u = rest.match(UNIT_RE);
  if (u) { const raw = u[1].toLowerCase(), w = /^(pinch|bunch)es$/.test(raw) ? raw.slice(0, -2) : raw.replace(/s$/, ""); unit = UNIT_ONE[raw] || UNIT_ONE[w] || w; rest = rest.slice(u[0].length); }
  return { q: m ? q : null, unit, name: rest.replace(/,.*$/, "").trim(), line, counted: !!m };
}
const isPantry = (line) => PANTRY_RE.test(ingParts(line).name || line);
const fmtQty = (q) => { const w = Math.floor(q + 1e-9), f = q - w;
  const fr = [[0, ""], [0.25, "1/4"], [1 / 3, "1/3"], [0.5, "1/2"], [2 / 3, "2/3"], [0.75, "3/4"], [1, "+1"]].reduce((b, x) => (Math.abs(x[0] - f) < Math.abs(b[0] - f) ? x : b));
  return fr[1] === "+1" ? String(w + 1) : [w || "", fr[1]].filter(Boolean).join(" ") || "0"; };
// Several recipes' ingredients as one list: the same thing in the same unit added up (garlic, 5 + 2 cloves).
function mergeIngredients(lines) {
  const out = new Map();
  for (const line of lines) {
    const x = ingParts(line), key = x.q != null && x.name ? `${x.unit}|${fold(x.name)}` : `line|${fold(line)}`, o = out.get(key);
    if (o && o.q != null && x.q != null) { o.q += x.q; o.n++; } else if (!o) out.set(key, { ...x, n: 1 });
  }
  return [...out.values()].map((o) => (o.n > 1 ? `${fmtQty(o.q)} ${o.unit ? `${o.unit}${o.q > 1 ? (/(ch|sh)$/.test(o.unit) ? "es" : "s") : ""} ` : ""}${o.name}` : o.line));
}
const ingLines = (r) => (RECIPES[recipeKey(r)]?.i || []).filter((l) => !/:\s*$/.test(l));
// The wine(s) a recipe sits with on the page: its own wine's recipes, a wine's section, or all the picks.
function winesFor(el) {
  const id = el.closest("[data-pick-wine]")?.dataset.pickWine;
  const one = id && (findWine(id) || (wineNow?.w.id === id ? wineNow.w : null));
  if (one) return [one];
  const sec = el.closest(".somm-pair-wine:not(.somm-pair-all)")?.querySelector("[data-somm-pop]")?.dataset.sommPop;
  if (sec && findWine(sec)) return [findWine(sec)];
  if (el.closest(".somm-meet, .somm-pair-all")) return pairWines();
  return wineNow && !wineNow.typed ? [wineNow.w] : [];
}
function wineLine(w) {
  if (w.kind === "cellar") { const at = atStoreWords(w); return `${w.name}, from ${w.source}${at ? ` (${at.replace(/&amp;/g, "&")})` : ""}`; }
  return `${w.name}${priceOf(w) != null ? `, buy at ${sourceLabel(w.source)} (${money(priceOf(w))})` : ""}`;
}
let shopSeq = 0;
function shopListHtml(lines, wines, title = "Shopping list") {
  const buy = lines.filter((l) => !isPantry(l)), have = lines.filter(isPantry), id = `shop${++shopSeq}`;
  const li = (l, on) => `<li><label><input type="checkbox" data-shop-have${on ? " checked" : ""}> <span>${esc(l)}</span></label></li>`;
  return `<div class="somm-shop" id="${id}"><h5>🛒 ${esc(title)}</h5><p class="hint">Tick what you already have: it's left off what you print or email.</p>
    <ul class="somm-shop-list">${buy.map((l) => li(l, false)).join("")}</ul>
    ${have.length ? `<p class="somm-shop-sub">You probably have</p><ul class="somm-shop-list somm-shop-have">${have.map((l) => li(l, false)).join("")}</ul>` : ""}
    ${wines.length ? `<p class="somm-shop-sub">The wine</p><ul class="somm-shop-list">${wines.map((w) => li(`🍷 ${wineLine(w)}`, false)).join("")}</ul>` : ""}</div>`;
}
// What's on a rendered list and not ticked, in its groups.
function shopRead(box) {
  const groups = [];
  let cur = { name: "To buy", items: [] };
  for (const el of box.querySelectorAll(".somm-shop-sub, .somm-shop-list li")) {
    if (el.classList.contains("somm-shop-sub")) { groups.push(cur); cur = { name: el.textContent, items: [] }; continue; }
    if (!el.querySelector("[data-shop-have]").checked) cur.items.push(el.querySelector("span").textContent);
  }
  groups.push(cur);
  return groups.filter((g) => g.items.length);
}
const shopText = (title, groups) => `${title.toUpperCase()}\n` + groups.map((g) => `${g.name === "To buy" ? "" : `\n${g.name}:\n`}${g.items.map((i) => `[ ] ${i}`).join("\n")}`).join("\n");
const shopSheet = (title, groups) => `<h1>🛒 ${esc(title)}</h1>` + groups.map((g) => `${g.name === "To buy" ? "" : `<h2>${esc(g.name)}</h2>`}<ul class="pa-shop">${g.items.map((i) => `<li>☐ ${esc(i)}</li>`).join("")}</ul>`).join("");
const recipeText = (r) => { const x = RECIPES[recipeKey(r)];
  return `${r[0]}\n${ref(r[1], r[2])}${x.s || x.t ? ` · ${[x.s, x.t].filter(Boolean).join(" · ")}` : ""}\n\nIngredients\n${x.i.map((l) => (/:\s*$/.test(l) ? `\n${l}` : `- ${l}`)).join("\n")}\n\nMethod\n${x.m.map((m, i) => `${i + 1}. ${m}`).join("\n")}\n\n(Ingredients as printed in ${ref(r[1], r[2])}; the method is in our own words. From Basil's Wine Finder.)`; };
const recipeSheet = (r) => { const x = RECIPES[recipeKey(r)];
  return `<h1>${esc(r[0])}</h1><p>${esc(ref(r[1], r[2]))}${r[6]?.length ? ` · with ${esc(r[6].join(", "))}` : ""}${x.s || x.t ? ` · ${esc([x.s, x.t].filter(Boolean).join(" · "))}` : ""}</p>
    ${r[7] ? `<p><strong>Why it suits the wine:</strong> ${esc(r[7])}</p>` : ""}
    <h2>Ingredients</h2><ul class="pa-ing">${x.i.map((l) => (/:\s*$/.test(l) ? `<li class="pa-ing-h">${esc(l)}</li>` : `<li>${esc(l)}</li>`)).join("")}</ul>
    <h2>Method</h2><ol>${x.m.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>
    <p class="pa-foot">Ingredients as printed in ${esc(ref(r[1], r[2]))}; the method is in our own words.</p>`; };
function printSheets(html) {
  $("print-area").innerHTML = `${html}<p class="pa-foot">Printed from Basil's Wine Finder, ${new Date().toLocaleDateString()}.</p>`;
  $("print-area").dataset.custom = "recipe";
  window.print();
  setTimeout(() => { delete $("print-area").dataset.custom; }, 2000);
}
// One recipe: the list opens under it; Print and Email send the recipe, the list or both.
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-recipe-shop], [data-recipe-out]");
  if (!t) return;
  const tools = t.closest("[data-recipe-tools]"), r = recipeByKey(tools.dataset.recipeTools), box = tools.querySelector(".somm-shop-box");
  if (!r || !RECIPES[recipeKey(r)]) return;
  const makeList = () => { if (!box.innerHTML) box.innerHTML = shopListHtml(ingLines(r), winesFor(tools)); };
  if (t.dataset.recipeShop != null) {
    box.innerHTML = box.innerHTML ? "" : shopListHtml(ingLines(r), winesFor(tools));
    t.setAttribute("aria-expanded", String(!!box.innerHTML));
    return;
  }
  const what = tools.querySelector("[data-recipe-what]").value, title = `Shopping list: ${r[0]}`;
  let groups = [];
  if (what !== "recipe") { const shown = !!box.innerHTML; makeList(); groups = shopRead(box.querySelector(".somm-shop")); if (!shown) box.innerHTML = ""; }
  if (t.dataset.recipeOut === "print") printSheets([what !== "recipe" ? shopSheet(title, groups) : "", what !== "list" ? recipeSheet(r) : ""].filter(Boolean).join(`<div class="pa-break"></div>`));
  else {
    const subject = what === "both" ? `${r[0]}: recipe and shopping list` : what === "list" ? title : `Recipe: ${r[0]}`;
    const body = [what !== "recipe" ? shopText("Shopping list", groups) : "", what !== "list" ? recipeText(r) : ""].filter(Boolean).join("\n\n----------\n\n");
    sendEmail(subject, body, (msg) => { tools.querySelector(".status").textContent = msg; });
  }
});
// The whole dinner: every course's recipe (the one showing on each card) in one list.
function dinnerRecipes() {
  return [...document.querySelectorAll("#somm-out .somm-course-card")].map((card) => {
    const d = card.querySelector(".somm-recipe-pick details.somm-recipe[data-recipe]");
    return d ? { course: card.querySelector("h4")?.childNodes[0]?.textContent.trim() || "", r: recipeByKey(d.dataset.recipe) } : null;
  }).filter((x) => x?.r && RECIPES[recipeKey(x.r)]);
}
function dinnerShopHtml() {
  const list = dinnerRecipes();
  if (!list.length) return `<div class="somm-card"><p>None of these courses has a recipe from the books to shop for.</p></div>`;
  const wines = [...new Set((lastMenu?.plan || []).map((p) => p.w).filter(Boolean))];
  return `<div class="somm-card somm-dinner-shop"><h3 class="somm-wine-h">🛒 Shopping list for the whole dinner</h3>
    <p>For ${list.map((x) => `<strong>${esc(x.course)}</strong>: ${esc(x.r[0])}`).join(" · ")}. The same ingredient in the same measure is added up.</p>
    ${shopListHtml(mergeIngredients(list.flatMap((x) => ingLines(x.r))), wines, "Shopping list")}
    <div class="somm-recipe-tools"><select data-dinner-what aria-label="What to print or email"><option value="both">Shopping list and recipes</option><option value="list">The shopping list</option><option value="recipe">The recipes</option></select>
      <button type="button" class="btn" data-dinner-out="print">🖨 Print</button> <button type="button" class="btn" data-dinner-out="email">✉️ Email</button> <span class="status" role="status"></span></div></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-dinner-out]");
  if (!t) return;
  const card = t.closest(".somm-dinner-shop"), what = card.querySelector("[data-dinner-what]").value, list = dinnerRecipes();
  const groups = shopRead(card.querySelector(".somm-shop")), title = "Shopping list for the dinner";
  if (t.dataset.dinnerOut === "print") printSheets([what !== "recipe" ? shopSheet(title, groups) : "", ...(what !== "list" ? list.map((x) => recipeSheet(x.r)) : [])].filter(Boolean).join(`<div class="pa-break"></div>`));
  else sendEmail(what === "recipe" ? "Our dinner: the recipes" : what === "list" ? "Our dinner: shopping list" : "Our dinner: shopping list and recipes",
    [what !== "recipe" ? shopText("Shopping list", groups) : "", ...(what !== "list" ? list.map((x) => `${x.course.toUpperCase()}\n${recipeText(x.r)}`) : [])].filter(Boolean).join("\n\n----------\n\n"),
    (msg) => { card.querySelector(".status").textContent = msg; });
});

// fill the panel's lists whenever the Sommelier page is shown
new MutationObserver(() => { if (!$("view-somm").hidden) openSomm(); })
  .observe($("view-somm"), { attributes: true, attributeFilter: ["hidden"] });
sommTab("", true);
