const SS_ID = '1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k';

// GET：JSONP 回傳員工清單
// 例：?action=getEmployees&callback=_cb123
function doGet(e) {
  const action   = e.parameter.action   || '';
  const callback = e.parameter.callback || '';

  if (action === 'getEmployees') {
    const data = JSON.stringify(getEmployees_());
    const body = callback ? `${callback}(${data})` : data;
    return ContentService
      .createTextOutput(body)
      .setMimeType(callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON);
  }

  // 其他 GET 一律回傳 HTML（GAS 本地開啟用）
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('效率換算工具')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// POST：no-cors 送入，不需回傳有意義的內容
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'saveRecords') {
      saveRecords_(payload.records, payload.date);
    }
  } catch (err) {
    // no-cors 模式下前端不讀回應，這裡靜默失敗即可
  }
  return ContentService
    .createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}

function getEmployees_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('參數');
  const data  = sheet.getDataRange().getValues();
  const out   = [];
  for (let i = 0; i < data.length; i++) {
    const id   = String(data[i][2] || '').trim(); // C 欄
    const name = String(data[i][3] || '').trim(); // D 欄
    if (id && name) out.push({ id, name });
  }
  return out;
}

function saveRecords_(records, date) {
  const sheet = getOrCreateRecordSheet_();
  const now   = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const rows  = records.map(r => [
    date, now, r.empId, r.empName, r.spec, r.length, r.rolls, r.coeff, r.efficiency
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }
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
