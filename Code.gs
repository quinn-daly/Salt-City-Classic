const TAB = "Comments";

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return reply({ ok: true });
  const name = clean(p.name, 40);
  const text = clean(p.comment, 1000);
  const post = String(p.post || "").replace(/[^0-9]/g, "").slice(0, 6);
  const id = String(p.id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || Utilities.getUuid().slice(0, 8);
  const parent = String(p.reply || "").replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  if (!name || !text || !post) return reply({ ok: false });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const when = Utilities.formatDate(new Date(), "America/New_York", "MMM d, h:mm a");
    SpreadsheetApp.getActive().getSheetByName(TAB).appendRow([when, id, post, parent, name, text, false]);
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function clean(v, max) {
  const s = String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
