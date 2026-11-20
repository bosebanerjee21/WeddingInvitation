/**
 * RSVP receiver for the wedding site — saves each RSVP as a row in a Google Sheet.
 * Setup steps are in README.md ("RSVP setup").
 *
 * The endpoint is intentionally public (guests aren't signed in), so it is write-only:
 * it can append a row, but never returns any sheet data.
 */

// Target spreadsheet + tab (from the sheet link .../d/<SHEET_ID>/edit#gid=<SHEET_GID>)
const SHEET_ID = '1AT_S2yqkLioWmDB-2KjbB4R_rvf8i_HwhOPMuhNNpTc';
const SHEET_GID = 1875938154;
const SHEET_NAME = 'RSVPs'; // used only if the tab above can't be found
// Everyone here gets an e-mail for every new RSVP (comma-separated)
const NOTIFY_EMAIL = 'debojit.banerjee546@gmail.com,aratrikstudy@gmail.com';
const MAX_LEN = 1000;

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return ok_(); // honeypot field filled → bot, silently ignore

  const row = [
    new Date(),
    clean_(p.name),
    clean_(p.attendance),
    clean_(p.count),
    clean_(p.message),
  ];
  if (!row[1] || !row[2]) return ok_(); // name and attendance are required

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheets().find(sh => sh.getSheetId() === SHEET_GID)
      || ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received', 'Name', 'Attendance', 'Guests', 'Message']);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(NOTIFY_EMAIL, `New RSVP: ${row[1]}`,
      `Name: ${row[1]}\nAttendance: ${row[2]}\nGuests: ${row[3]}\nMessage: ${row[4] || '-'}\n\n` +
      `All RSVPs: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`);
  }
  return ok_();
}

// Trim, cap length, and neutralise spreadsheet formulas (=, +, -, @) so a guest can't inject one.
function clean_(v) {
  const s = String(v || '').trim().slice(0, MAX_LEN);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
