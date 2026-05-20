const SS_ID = '1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('效率換算工具')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  if (payload.action === 'getEmployees') return respond(getEmployees_());
  if (payload.action === 'saveRecords')  return respond(saveRecords_(payload.records, payload.date));
  return respond({ error: 'unknown action' });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GAS 不支援 OPTIONS，但部署為「所有人」時 simple POST（text/plain body）不需 preflight
// 若瀏覽器仍報 CORS，將 doGet 改為同時處理 GET callback（JSONP 備用方案）
function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.JSON);
}

function getEmployees_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheets()[1]; // Sheet 2
  const data = sheet.getDataRange().getValues();
  const employees = [];
  for (let i = 0; i < data.length; i++) {
    const id   = String(data[i][2] || '').trim(); // C 欄
    const name = String(data[i][3] || '').trim(); // D 欄
    if (id && name) employees.push({ id, name });
  }
  return employees;
}

function saveRecords_(records, date) {
  const sheet = getOrCreateRecordSheet_();
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const rows = records.map(r => [
    date, now, r.empId, r.empName, r.spec, r.length, r.rolls, r.coeff, r.efficiency
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }
  return { saved: rows.length };
}

function getOrCreateRecordSheet_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName('記錄');
  if (!sheet) {
    sheet = ss.insertSheet('記錄');
    sheet.getRange(1, 1, 1, 9).setValues([[
      '生產日期', '儲存時間', '工號', '員工姓名', '規格', '碼長', '捲數', '係數', '效率換算'
    ]]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  }
  return sheet;
}
