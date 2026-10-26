// Wine Finder inbox (Google Apps Script, attached to a Google Sheet).
//
// Family members' saved Claude research arrives here from the Wine Finder page, with
// no key and no email. Only the website keeper, holding ADMIN_KEY (kept in this
// script's properties, never in the website's code), can list what is waiting and
// mark it published or ignored.
//
// Setup: paste this into Extensions > Apps Script of a new sheet, run makeAdminKey
// once, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).

const SHEET = 'Inbox';
const HEAD = ['Received', 'From', 'Wine code', 'Wine', 'Claude points', 'Vintage', 'Own points', 'Write-up', 'Details', 'Status'];
const STATUS_COL = 10;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

const out_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
// Text a sheet would otherwise read as a formula (=, +, -, @) is stored as plain text.
const text_ = (s, n) => { s = String(s == null ? '' : s).slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; };
const json_ = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

function doGet() {
  return out_({ ok: true, app: 'wine-finder-inbox' });
}

function doPost(e) {
  const req = json_(e && e.postData && e.postData.contents);
  if (!req) return out_({ ok: false, error: 'bad request' });
  if (req.action === 'lcbo') return lcbo_(req); // read-only, needs no lock
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (req.action === 'submit') return submit_(req);
    const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!key || req.key !== key) return out_({ ok: false, error: 'not allowed' });
    if (req.action === 'list') return list_();
    if (req.action === 'mark') return mark_(req);
    return out_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

// {action:"submit", from:"Jon", items:[{id, name, claude:{points,vintage,note}, mine:{points,note}, writeup}]}
function submit_(req) {
  const items = Array.isArray(req.items) ? req.items.slice(0, 30) : [];
  const sh = sheet_();
  const now = new Date();
  let n = 0;
  for (const it of items) {
    if (!it || !/^[a-z]+-[\w.-]{1,120}$/.test(String(it.id || ''))) continue;
    const c = it.claude || {}, m = it.mine || {};
    sh.appendRow([now, text_(req.from, 30), it.id, text_(it.name, 150),
      c.points == null ? '' : c.points, text_(c.vintage, 4), m.points == null ? '' : m.points,
      text_(it.writeup, 45000), text_(JSON.stringify({ claude: it.claude || null, mine: it.mine || null }), 2000), 'waiting']);
    n++;
  }
  if (n) notify_(req.from, items);
  return out_({ ok: true, received: n });
}

// A short email to the keeper (this script's owner) whenever research arrives.
function notify_(from, items) {
  try {
    const lines = items.filter(function (it) { return it && it.id; }).map(function (it) {
      const c = it.claude || {}, m = it.mine || {};
      return '- ' + String(it.name || it.id).slice(0, 150) +
        (c.points != null ? ' (Claude ' + c.points + (c.vintage ? ', ' + c.vintage : '') + ')' : '') +
        (m.points != null ? ', own rating ' + m.points : '') + (it.writeup ? ', with write-up' : '');
    });
    const who = String(from || 'Someone').slice(0, 30);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      'Wine Finder: ' + who + ' researched ' + (lines.length === 1 ? String(items[0].name || 'a wine').slice(0, 80) : lines.length + ' wines'),
      who + " saved Claude research in Basil's Wine Finder:\n\n" + lines.join('\n') +
      '\n\nOpen your Wine Finder, go to My wines, and publish it from the Family inbox:\nhttps://mikemeddings.github.io/wine-finder/');
  } catch (e) {
    // the row is saved either way; a missing email isn't worth failing over
  }
}

function list_() {
  const rows = sheet_().getDataRange().getValues();
  const items = [];
  rows.forEach((r, i) => {
    if (i && r[STATUS_COL - 1] === 'waiting') {
      items.push({ row: i + 1, received: r[0], from: r[1], id: r[2], name: r[3], writeup: r[7], details: json_(r[8]) });
    }
  });
  return out_({ ok: true, items });
}

function mark_(req) {
  const sh = sheet_();
  const row = Number(req.row);
  if (!(row >= 2 && row <= sh.getLastRow()) || ['published', 'ignored'].indexOf(req.status) < 0) {
    return out_({ ok: false, error: 'bad row or status' });
  }
  sh.getRange(row, STATUS_COL).setValue(req.status);
  return out_({ ok: true });
}

// ---- The private LCBO list ----------------------------------------------------------
// A family-only snapshot of the LCBO wine list, kept in the keeper's Google Drive and
// handed to a browser that sends the right unlock code. Neither the code nor the list
// is ever in the website's code or on GitHub. Script properties (Project Settings >
// Script properties): LCBO_CODE (the unlock code), LCBO_FILE_ID (the Drive file's id),
// LCBO_AS_OF (optional, e.g. "July 2026").

// Capitals, accents, spaces and punctuation don't matter: "chateauneuf du pape" = "Châteauneuf-du-Pape".
const codeNorm_ = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// {action:"lcbo", code:"…", who:"Dad"} -> {ok:true, asOf, csv} or {ok:false, error}
function lcbo_(req) {
  const p = PropertiesService.getScriptProperties();
  const code = codeNorm_(p.getProperty('LCBO_CODE')), fileId = p.getProperty('LCBO_FILE_ID');
  if (!code || !fileId) return out_({ ok: false, error: 'not set up' });
  if (codeNorm_(req.code) !== code) {
    Utilities.sleep(2000); // makes guessing pointlessly slow; family won't notice
    return out_({ ok: false, error: 'wrong code' });
  }
  const csv = DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
  notifyLcbo_(req.who);
  return out_({ ok: true, asOf: p.getProperty('LCBO_AS_OF') || 'July 2026', csv });
}

// One email to the keeper per browser that unlocks the list.
function notifyLcbo_(who) {
  try {
    const name = String(who || 'Someone').slice(0, 30);
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Wine Finder: ' + name + ' unlocked the LCBO list',
      name + " unlocked the LCBO list in Basil's Wine Finder on " + new Date().toString() + '.\n\n' +
      'Each browser downloads it once, so this is one new browser.');
  } catch (e) {
    // the list was sent either way
  }
}

// Run once from the editor after adding the script properties: Google asks to allow
// reading Drive, then the log says whether the code and the file are set (never the code itself).
function checkLcboSetup() {
  const p = PropertiesService.getScriptProperties();
  Logger.log('Unlock code: ' + (p.getProperty('LCBO_CODE') ? 'set' : 'MISSING (add LCBO_CODE)'));
  const id = p.getProperty('LCBO_FILE_ID');
  if (!id) { Logger.log('Drive file: MISSING (add LCBO_FILE_ID)'); return; }
  const f = DriveApp.getFileById(id), text = f.getBlob().getDataAsString('UTF-8');
  Logger.log('Drive file: "' + f.getName() + '", ' + (f.getSize() / 1e6).toFixed(1) + ' MB, about ' +
    (text.split('\n').length - 1) + ' lines. List date shown on the page: ' + (p.getProperty('LCBO_AS_OF') || 'July 2026'));
}

// Run once from the editor: makes the keeper's key and shows it in the execution log.
function makeAdminKey() {
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', key);
  Logger.log('Your inbox key. Paste it into the Wine Finder on your own computer only: ' + key);
}

// Run once from the editor after updating the script: Google asks to allow sending
// email, then a test email arrives. (Deploying alone doesn't ask.)
function testEmail() {
  notify_('Test', [{ id: 'typed-test-wine', name: 'Test wine (from testEmail)', claude: { points: 90, vintage: 2020 } }]);
  Logger.log('Test email sent to ' + Session.getEffectiveUser().getEmail());
}
