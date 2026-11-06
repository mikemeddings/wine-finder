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
      <p><button type="button" class="btn" data-somm-print="${esc(recipeKey(r))}">🖨 Print the recipe</button></p></div></details>`;
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
  const s = familyScore(w);
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
    const ds = dishesFor(grapes, f, 5);
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
  const ds = dishesFor(keys, f, 8).filter((d) => !offDry(d.dish)).slice(0, 3);
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
function cellarAnswerHtml(rows, food, what = "", moodLine = "", title = "") {
  answerArgs = { rows, food, what, moodLine, title };
  answerOpts = { colour: "", country: "", col: "drink", dir: 1, daring: false };
  return `<div id="somm-cellar-answer">${answerBodyHtml()}</div>`;
}
function answerControlsHtml() {
  const { rows, food } = answerArgs, { colour, country, daring } = answerOpts;
  const list = (k) => [...new Set(rows.map((x) => x.w[k]).filter((v) => v && v !== "Country not stated"))].sort();
  const opt = (v, label, on) => `<option value="${esc(v)}"${v === on ? " selected" : ""}>${esc(label)}</option>`;
  return `<div class="somm-row somm-narrow">
    <select data-somm-narrow="colour" aria-label="Colour">${opt("", "Any colour", colour)}${list("type").map((v) => opt(v, v, colour)).join("")}</select>
    <select data-somm-narrow="country" aria-label="Country">${opt("", "Any country", country)}${list("country").map((v) => opt(v, v, country)).join("")}</select>
    ${food ? "" : `<label class="somm-check"><input type="checkbox" data-somm-narrow="daring"${daring ? " checked" : ""}> ⚡ Only wines with an adventurous pairing</label>`}</div>`;
}
const TABLE_WORDS = { name: "name", type: "colour", country: "country", vintage: "vintage", score: "score", match: "best match", drink: "what to drink first", daring: "adventurous first" };
const matchText = (x) => (x.bold ? "⚡" : x.t ? STARS(x.t) : "");
// Banner, then a table to scan and sort by hand. A wine's name opens it.
function answerBodyHtml() {
  const { food, what, moodLine, title } = answerArgs, { colour, country, col, dir, daring } = answerOpts;
  const names = sommCellars().join(" and "), order = Object.keys(STAGES);
  const isDaring = (x) => (food ? !!x.bold : advIdeasOf(x.w).length > 0);
  const rows = answerArgs.rows.filter((x) => (!colour || x.w.type === colour) && (!country || x.w.country === country) && (!daring || isDaring(x)));
  const value = (x) => { const w = x.w; return { name: w.name, type: w.type, country: w.country, vintage: w.vintage ?? 9999, score: -(bestScore(w) ?? 0), match: x.bold ? 0.5 : -(x.t || 0),
    drink: order.indexOf(drinkStage(w)) * 10000 + (w.drink_to ?? 9999), daring: isDaring(x) ? 0 : 1 }[col]; };
  const list = rows.slice().sort((a, b) => { const p = value(a), q = value(b);
    return ((typeof p === "string" ? p.localeCompare(q) : p - q) * dir) || (b.t || 0) - (a.t || 0) || (bestScore(b.w) ?? 0) - (bestScore(a.w) ?? 0); });
  const n = list.length, daringN = food ? rows.filter((x) => x.bold).length : 0;
  const urgent = rows.filter((x) => ["first", "soon"].includes(drinkStage(x.w))).length;
  const mode = food ? { classic: "Classic matches", bold: "Classic and adventurous", only: "Adventurous only" }[document.querySelector("#somm [name=somm-daring]:checked")?.value] : "";
  const head = [food ? capFirst(what.replace(/^for /, "")) : title, mode, names].filter(Boolean).join(" · ");
  const count = !n ? "Nothing fits these choices." : `${n} ${n === 1 ? "wine" : "wines"}${daringN && daringN < n ? `: ${n - daringN} classic, ${daringN} adventurous` : daringN ? ", all adventurous" : ""}.${food ? urgent ? ` ${urgent} should be drunk soon.` : " None is urgent." : ""}`;
  const cols = [["name", "Wine"], ["type", "Colour"], ["country", "Country"], ["vintage", "Vintage"], ["score", "Score"], ...(food ? [["match", "Match"]] : []), ["drink", "Drink"], ["daring", "⚡"]];
  const sorted = col === "drink" && dir > 0 ? `what to drink first${food ? ", then best match, then best rated" : ""}. Start at the top of the list` : `${TABLE_WORDS[col]}${dir < 0 ? ", reversed" : ""}`;
  return `<div class="somm-selection"><p class="somm-sel-head">${esc(head)}</p><p class="somm-sel-count">${esc(count)}</p>
      <p>${moodLine ? `${esc(capFirst(`These wines ${moodLine}`))} ` : ""}Sorted by <strong>${esc(sorted)}</strong>. Click a heading to sort by it, or a wine to see ${food ? "more" : "what goes with it"}.</p>
      <p class="hint">Drinking dates are the cellar owner's own.</p>
      ${answerArgs.rows.length > 1 ? answerControlsHtml() : ""}</div>
    ${n ? `<div class="somm-table-wrap"><table class="somm-table"><thead><tr>${cols.map(([k, label]) => `<th scope="col"><button type="button" class="linklike" data-somm-col="${k}" aria-pressed="${col === k}">${esc(label)}${col === k ? (dir > 0 ? " ▲" : " ▼") : ""}</button></th>`).join("")}</tr></thead>
      <tbody>${list.map((x) => { const w = x.w; return `<tr><td><button type="button" class="linklike" data-somm-wine="${esc(w.id)}">${esc(w.name)}</button></td><td>${esc(w.type || "")}</td><td>${esc(w.country || "")}</td><td>${esc(String(w.vintage ?? "NV"))}</td>
        <td>${bestScore(w) != null ? `<strong>${Math.round(bestScore(w))}</strong>` : ""}</td>${food ? `<td class="somm-match">${matchText(x)}</td>` : ""}<td>${drinkTag(w)}</td><td>${isDaring(x) ? "⚡" : ""}</td></tr>`; }).join("")}</tbody></table></div>` : ""}`;
}
document.addEventListener("change", (e) => {
  if (!e.target.matches?.("#somm-cellar-answer [data-somm-narrow]")) return;
  answerOpts[e.target.dataset.sommNarrow] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  $("somm-cellar-answer").innerHTML = answerBodyHtml();
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
// "Pick from the cellar" is there only with a cellar ticked; each button counts the cellars ticked.
function renderMoods() {
  const box = $("somm-moods"), tab = $("somm-tab-pick");
  if (!box || !tab) return;
  renderCellarPick();
  for (const id of ["somm-cook-next", "somm-daring"]) if ($(id)) $(id).hidden = !sommCellars().length; // adventurous matches are for the cellars
  if ($("somm-cook-filters")) { // with a cellar ticked, colour and country sit with the answer
    $("somm-cook-filters").hidden = !!sommCellars().length;
    if (sommCellars().length) $("somm-cook-country").selectedIndex = $("somm-cook-colour").selectedIndex = 0;
  }
  tab.hidden = !sommCellars().length;
  if (tab.hidden) { if (tab.getAttribute("aria-selected") === "true") sommTab("wine"); return; }
  const pool = sommPool({ stores: [] });
  box.innerHTML = Object.entries(MOODS).map(([k, m]) =>
    `<button type="button" class="btn btn-mood" data-somm-mood="${k}">${m.icon} ${esc(m.label)} <span class="tap-n">${pool.filter(m.test).length}</span></button>`).join(" ") +
    ` <button type="button" class="btn btn-mood" data-somm="surprise">🎲 Surprise me</button>`;
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
  $("somm-choosing").innerHTML = text ? `Choosing from <strong>${esc(text)}</strong>. <button type="button" class="linklike" data-somm="to-step1">Change this</button>` : "";
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
  runCook();
});
function runFridge() {
  const text = $("somm-fridge").value.trim();
  if (!wineNow) return;
  for (const b of document.querySelectorAll("#somm [data-wine-food]")) b.setAttribute("aria-pressed", "false");
  showWineFood(fridgeHtml(wineNow.w, text), text ? `the fridge: ${text}` : "");
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "somm-fridge") { e.preventDefault(); loadSomm().then(runFridge); } });
function startAgain() {
  wineNow = null;
  if ($("somm-cellar-pick")) $("somm-cellar-pick").value = "";
  for (const el of document.querySelectorAll("#somm [name=somm-food]:checked")) el.checked = false;
  for (const id of ["somm-q", "somm-dish", "somm-price", "somm-cook-price", "somm-menu-price"]) if ($(id)) $(id).value = "";
  for (const id of ["somm-country", "somm-colour", "somm-cook-country", "somm-cook-colour", "somm-menu-country", "somm-protein"]) if ($(id)) $(id).selectedIndex = 0;
  document.querySelector("#somm [name=somm-daring][value=classic]").checked = true;
  if ($("somm-hits")) $("somm-hits").innerHTML = "";
  sommTab("wine");
  $("somm-h").scrollIntoView({ block: "start" });
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
function foodRating(w, typed, f) {
  const keys = bookKeys(sommKeys(w), !typed && isSweetWine(w));
  if (typed) { const t = Math.max(0, ...keys.map((k) => grapeFoodTier(k, f))); return t > 1 ? { t } : keys.length ? { stretch: true } : {}; }
  if (foodsOf(w).includes(f)) return { t: Math.max(1, wineTier(w, f)) };
  return advIdeasOf(w).some((r) => r.food === f) ? { bold: true } : { stretch: true };
}
const ratingText = (r) => (r.t ? STARS(r.t) : r.bold ? "⚡" : r.stretch ? "a stretch" : "");
function wineStartHtml(w, typed = false, fromList = false) {
  wineNow = { w, typed };
  const order = (x) => { const r = foodRating(w, typed, x); return r.t ? 4 - r.t : r.bold ? 4 : 5; };
  const tiles = FOODS.slice().sort((a, b) => order(a) - order(b)).map((f) =>
    `<button type="button" class="somm-food" data-wine-food="${esc(f)}" aria-pressed="false">${esc(f)} <span class="tile-rate">${ratingText(foodRating(w, typed, f))}</span></button>`).join("");
  return `<div id="somm-wine-answer">
    <p class="somm-trail"><strong>${esc(w.name)}</strong> <span id="somm-trail-food"></span>
      <button type="button" class="btn btn-mini" data-somm="other-food" id="somm-other-food" hidden>Choose another food</button>
      ${fromList ? `<button type="button" class="btn btn-mini" data-somm="back-list">Back to the list</button>` : `<button type="button" class="btn btn-mini" data-somm="other-wine">Choose another wine</button>`}</p>
    ${typed ? "" : `<p>${typePill(w.type)} ${esc([w.country, w.vintage].filter(Boolean).join(" · "))} · ${bottleWhere(w)}${familyScore(w) ? ` · <strong>${familyScore(w)}</strong> points` : ""}</p><div class="hit-buttons">${shoppingButton(w)}${researchButton(w)}</div>`}
    <div class="somm-way"><h4>What have you got?</h4>
      <p class="hint">★ a classic match · ⚡ an adventurous one. Tap what you're cooking.</p>
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
  return `<div class="somm-card"><h3 class="somm-wine-h">This wine with ${esc(f.toLowerCase())}</h3>
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
  const answer = sommCellars().length ? cellarAnswerHtml(own, food, `for ${dish || food.toLowerCase()}`) : "";
  return `${answer}<div class="somm-card"><h3 class="somm-wine-h">${esc(dish ? capFirst(dish) : food)}: what the books pour</h3>
      <ul class="somm-foods">${gList || "<li>The books name no wine for this.</li>"}</ul>
      ${avoid.size ? `<p><strong>⚠️ Avoid:</strong> ${esc([...avoid].join(", "))}.</p>` : ""}
      ${dish ? `<p>${recipeButton(dish, ranked[0]?.[0] || "")}</p>` : ""}
      ${recipesHtml(recs, 6, `Recipes from the books for ${food.toLowerCase()}`)}</div>${local}
    ${stores.length ? `<div class="somm-card"><h3 class="somm-wine-h">Bottles you can buy (${bottles.length})</h3>
      <p class="hint">${esc(storeWord)}${country ? `, from ${esc(country)}` : ""}${colour ? `, ${esc(colour.toLowerCase())}` : ""}${maxPrice != null ? `, up to ${money(maxPrice)}` : ""}. Best match first, then best rated.</p>
      ${bottles.length ? `<ul class="somm-bottles">${bottles.slice(0, 12).map(({ w, t }) => sommRow(w, `<div><span class="food-star tier-${t}">${STARS(t)}</span> ${esc(sommKeys(w).join(", "))}</div>`)).join("")}</ul>` : "<p>No bottles match. Try more stores, another country or a higher price.</p>"}
      ${bottles.length > 12 ? `<button type="button" class="btn" data-somm-find="${esc(food)}">See all ${bottles.length} in Find wines</button>` : ""}</div>` : ""}`;
}

// ---- Route 3: Plan a dinner --------------------------------------------------------------
let lastMenu = null;
// A country's wines in the stores, or (own) the bottles handed in from the Comparison List.
function buildMenu({ country, nWines, courses, protein, stores, maxPrice, pool: given = null }) {
  const own = !!given;
  const canOpen = (w) => w.kind !== "cellar" || openable(w);
  const pool = given || sommPool({ stores, country, maxPrice }).filter(canOpen);
  if (own) nWines = Math.max(1, pool.length);
  const used = new Set(), plan = [];
  const urge = (w) => (w.kind === "cellar" ? { first: 8, soon: 4 }[drinkStage(w)] || 0 : 0);
  const pick = (cands, score) => cands.filter((w) => !used.has(w.id)).map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s + urge(b.w) - a.s - urge(a.w) || byBest(a.w, b.w))[0]?.w || null;
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
        const away = sommPool({ stores, maxPrice }).filter((x) => canOpen(x) && realDessert(x) && x.country !== country);
        const classic = (x) => sommKeys(x).some((k) => ["Port", "Tokaji", "Ice wine", "Sauternes", "Late-harvest white", "Muscat / Moscato", "Madeira"].includes(k));
        w = pick(away, (x) => 1 + (classic(x) ? 3 : 0) + (x.type === "Dessert" ? 1 : 0) + (bestScore(x) ?? 0) / 100);
        note = w && country ? `${country} has no dessert wine in ${tickedWord()}, so this one is from ${w.country}.` : w ? "" : `No dessert wine in ${tickedWord()}.`;
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
  if (!p.w) return `<div class="somm-card somm-course-card"><h4>${COURSES[p.c]}</h4><p>${esc(p.note || `No ${country ? `${country} ` : ""}wine suits this course in ${tickedWord()}.`)}</p></div>`;
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
  const pick = recipePickHtml(p.w, p.c === "dessert" ? "Dessert" : p.c === "cheese" ? "Cheese" : p.food, 1, null, p.c);
  const br = p.c === "main" || p.c === "starter" ? bridgesFor(grapes) : [];
  const avoid = avoidsFor(grapes).filter((d) => p.c === "main" || p.c === "starter" ? d[0] === p.food || !["Cheese", "Dessert"].includes(d[0]) : d[0] === (p.c === "cheese" ? "Cheese" : "Dessert")).slice(0, 2);
  const tips = tipsFor(grapes, 2);
  return `<div class="somm-card somm-course-card${p.w.type ? ` wine-${esc(p.w.type)}` : ""}"><h4>${COURSES[p.c]}${p.food && p.c !== "cheese" && p.c !== "dessert" ? `: ${esc(p.food.toLowerCase())}` : ""} <span class="food-star tier-${t}">${STARS(t)}</span></h4>
    <ul class="somm-bottles">${sommRow(p.w, keys.length ? `<div>${esc(keys.join(", "))}</div>` : "")}</ul>
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
  const head = m.own ? `<strong>A menu from your Comparison List</strong>: ${wines.length} of the ${m.pool} ${m.pool === 1 ? "wine" : "wines"} ticked, each on the course it suits best.`
    : `<strong>${m.country ? `A ${esc(m.country)} menu` : "Your menu"}</strong>, ${wines.length} ${wines.length === 1 ? "wine" : "wines"}, chosen from ${m.pool.toLocaleString()} ${esc(m.country)} bottles in ${tickedWord()}.`;
  return `<p class="somm-summary">${head}</p>
    ${n ? `<p>${esc(n.intro)} ${CLAUDE_TAG}</p>` : ""}
    ${reg?.foods?.length ? `<p><strong>Local food the books tie to these wines:</strong> ${esc(reg.foods.join(", "))}.</p>` : ""}
    ${m.plan.map((p) => courseHtml(p, m.country)).join("")}
    ${bookMenus ? `<div class="somm-card"><h4>📖 Menus in the books with the same grapes, for ideas</h4><ul>${bookMenus}</ul></div>` : ""}
    <div class="somm-ask"><button type="button" class="btn btn-primary" data-somm="ask-menu">Ask Claude to polish this menu</button>
      <button type="button" class="btn" data-somm="print-out" data-print-title="Your dinner menu">🖨 Print this menu</button>
      <button type="button" class="btn" data-somm="menu-all">⚖️ Add all ${wines.length} wines to the Comparison List</button>
      <p id="somm-ask-msg" class="status" role="status"></p></div>`;
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
  $("somm-step3").hidden = true;
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
// Straight there, in the page's own scroll: the answer can be well below the fold.
const jumpTo = (el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 10);
const showOut = (html) => { $("somm-out").innerHTML = html; $("somm-step3").hidden = false; jumpTo($("somm-step3")); };

const renderSommHits = debounce(() => {
  const q = $("somm-q").value.trim(), out = $("somm-hits");
  if (q.length < 3) { out.innerHTML = ""; return; }
  const words = fold(q).split(/\s+/).filter(Boolean);
  const hits = [...cellarFindWines().filter((w) => words.every((t) => w._s.includes(t))), ...listHits(q)].slice(0, 6);
  out.innerHTML = (hits.length ? `<p>Found on our lists: tap one to pair it.</p><ul class="somm-hit-list">${hits.map((w) =>
    `<li><button type="button" class="btn somm-hit" data-somm-wine="${esc(w.id)}">${esc(w.name)}${w.vintage && !w.name.includes(String(w.vintage)) ? ` ${esc(String(w.vintage))}` : ""} · ${w.kind === "cellar" ? "" : `${priceHtml(w)} · `}${esc(sourceLabel(w.source))}</button></li>`).join("")}</ul>` : "") +
    (hits.some((w) => fold(w.name) === fold(q)) ? "" : `<button type="button" class="btn btn-somm" data-somm="pair-typed">Pair “${esc(q)}” as typed</button>`);
}, 300);

document.addEventListener("click", async (e) => {
  const t = e.target.closest("#somm [data-somm], #somm [data-somm-tab], #somm [data-somm-wine], #somm [data-somm-find], [data-somm-recipe], #somm [data-somm-mood], #somm [data-wine-food], #somm [data-somm-col]");
  if (!t) return;
  await loadSomm();
  if (t.dataset.sommMood) return showOut(moodHtml(t.dataset.sommMood));
  if (t.dataset.sommTab) {
    sommTab(t.dataset.sommTab);
    if (t.dataset.sommTab === "wine") $("somm-q").focus(); // the tab may be open already: show where to start
    return;
  }
  if (t.dataset.sommWine) {
    const w = findWine(t.dataset.sommWine), fromList = !!t.closest("#somm-cellar-answer"), food = fromList && answerArgs?.food;
    if (!w) return;
    showOut(wineStartHtml(w, false, fromList));
    fillStory(w);
    if (food) {
      document.querySelector(`#somm [data-wine-food="${food}"]`)?.setAttribute("aria-pressed", "true");
      $("somm-wine-food").innerHTML = wineFoodHtml(w, false, food);
      $("somm-trail-food").textContent = `› ${food}`;
      $("somm-other-food").hidden = false;
    }
    return;
  }
  if (t.dataset.sommCol) {
    answerOpts.dir = answerOpts.col === t.dataset.sommCol ? -answerOpts.dir : 1;
    answerOpts.col = t.dataset.sommCol;
    $("somm-cellar-answer").innerHTML = answerBodyHtml();
    return;
  }
  if (t.dataset.wineFood && wineNow) {
    for (const b of document.querySelectorAll("#somm [data-wine-food]")) b.setAttribute("aria-pressed", String(b === t));
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
  else if (a === "to-step1") $("somm-stores").scrollIntoView({ block: "center" });
  else if (a === "print-out") printOut(t.dataset.printTitle);
  else if (a === "fridge") runFridge();
  else if (a === "other-food") {
    for (const b of document.querySelectorAll("#somm [data-wine-food]")) b.setAttribute("aria-pressed", "false");
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
    runCook();
  } else if (a === "menu") {
    const country = $("somm-menu-country").value;
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
document.addEventListener("change", (e) => { if (e.target.matches?.("#somm [data-somm-store], #somm [data-somm-cellar]")) { fillCountrySelects(); renderMoods(); renderUsing(); } });
document.addEventListener("input", (e) => { if (e.target.id === "somm-q") renderSommHits(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "somm-q") { e.preventDefault(); document.querySelector('#somm [data-somm="pair-typed"]')?.click(); }
});
// fill the panel's lists whenever the Sommelier page is shown
new MutationObserver(() => { if (!$("view-somm").hidden) openSomm(); })
  .observe($("view-somm"), { attributes: true, attributeFilter: ["hidden"] });
sommTab(storeGet("wf.sommTab", "wine"));
