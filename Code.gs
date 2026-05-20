const SS_ID = '1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k';

function doGet(e) {
  const action   = e.parameter.action   || '';
  const callback = e.parameter.callback || '';
  const system   = e.parameter.system   || 'slitting';

  if (action === 'getEmployees') {
    return jsonp_(callback, getEmployees_());
  }
  if (action === 'getSpecs') {
    return jsonp_(callback, getSpecs_(system));
  }
  if (action === 'getReport') {
    return jsonp_(callback, getReport_(system));
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('效率換算工具')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'saveRecords') {
      saveRecords_(payload.records, payload.date, payload.system || 'slitting');
    }
  } catch (err) {}
  return ContentService.createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonp_(callback, data) {
  const json = JSON.stringify(data);
  const body = callback ? `${callback}(${json})` : json;
  return ContentService.createTextOutput(body)
    .setMimeType(callback
      ? ContentService.MimeType.JAVASCRIPT
      : ContentService.MimeType.JSON);
}

// ── 員工清單 ──────────────────────────────────────────────────────────────────

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

// ── 係數表 ────────────────────────────────────────────────────────────────────

function getSpecs_(system) {
  const ss = SpreadsheetApp.openById(SS_ID);

  // 分條：從「參數」分頁 F 欄起讀取規格係數表
  // 表頭列：F=規格, G=條數, H~=各碼長係數
  if (system === 'slitting') {
    const sheet = ss.getSheetByName('參數');
    const data  = sheet.getDataRange().getValues();

    // 尋找表頭列（F欄值為「規格」的那列）
    let headerRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][5]).trim() === '規格') { headerRow = i; break; }
    }
    if (headerRow === -1) return { specs: {}, lengths: [] };

    // H 欄（index 7）起為各碼長欄位名稱
    const lengths = [];
    for (let c = 7; c < data[headerRow].length; c++) {
      const h = String(data[headerRow][c]).trim();
      if (h) lengths.push(h);
    }

    const specs = {};
    for (let i = headerRow + 1; i < data.length; i++) {
      const name = String(data[i][5] || '').trim();
      if (!name) continue;
      const strands      = Number(data[i][6]) || 0;
      const coefficients = lengths.map((_, ci) => Number(data[i][7 + ci]) || 0);
      specs[name] = { strands, coefficients };
    }
    return { specs, lengths };
  }

  // 焊接：從「焊接係數」分頁讀取
  // 表頭：A=項目, B=規格分類, C=係數, D=點數
  if (system === 'welding') {
    const sheet = ss.getSheetByName('焊接係數');
    const data  = sheet.getDataRange().getValues();
    const items = {};
    for (let i = 1; i < data.length; i++) {
      const item  = String(data[i][0] || '').trim();
      const spec  = String(data[i][1] || '').trim();
      const coeff = Number(data[i][2]) || 0;
      const pts   = Number(data[i][3]) || 0;
      if (!item || !spec) continue;
      if (!items[item]) items[item] = {};
      items[item][spec] = { coefficient: coeff, points: pts };
    }
    return { items };
  }

  // 褙膠：從「褙膠係數」分頁讀取
  // 表頭：A=碼長, B=規格分類, C=係數
  if (system === 'backing') {
    const sheet = ss.getSheetByName('褙膠係數');
    const data  = sheet.getDataRange().getValues();
    const items = {};
    for (let i = 1; i < data.length; i++) {
      const category = String(data[i][0] || '').trim();
      const spec     = String(data[i][1] || '').trim();
      const coeff    = Number(data[i][2]) || 0;
      if (!category || !spec) continue;
      if (!items[category]) items[category] = {};
      items[category][spec] = { coefficient: coeff };
    }
    return { items };
  }

  return {};
}

// ── 儲存記錄 ──────────────────────────────────────────────────────────────────

function saveRecords_(records, date, system) {
  const sheetName = system === 'welding' ? '焊接記錄'
                  : system === 'backing' ? '褙膠記錄'
                  : '分條記錄';
  const sheet = getOrCreateSheet_(sheetName, system);
  const now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

  let rows;
  if (system === 'welding') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours,
      r.item, r.spec, r.coeff, r.points, r.efficiency
    ]);
  } else if (system === 'backing') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours,
      r.category, r.spec, r.coeff, r.rolls, r.efficiency
    ]);
  } else {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours, r.prodAbnormalHours,
      r.spec, r.length, r.rolls, r.coeff, r.efficiency
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
         .setValues(rows);
  }
}

function getOrCreateSheet_(name, system) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    let headers;
    if (system === 'welding') {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '項目','規格分類','係數','點數','效率換算'];
    } else if (system === 'backing') {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '碼長','規格分類','係數','卷數','效率換算'];
    } else {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '生產異常帶時數','規格','碼長','捲數','係數','效率換算'];
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

// ── 報表資料 ──────────────────────────────────────────────────────────────────

function getReport_(system) {
  const sheetName = system === 'welding' ? '焊接記錄'
                  : system === 'backing' ? '褙膠記錄'
                  : '分條記錄';
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { monthly: [], daily: [], currentMonth: 0, currentYear: 0 };

  const tz           = 'Asia/Ho_Chi_Minh';
  const now          = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 效率欄位索引（0-based）：分條=11（12欄），焊接/褙膠=10（11欄）
  const effIdx = system === 'slitting' ? 11 : 10;

  const data    = sheet.getDataRange().getValues();
  const monthly = {};
  const daily   = {};

  for (let i = 1; i < data.length; i++) {
    const dateStr = String(data[i][0] || '').trim();
    const empId   = String(data[i][2] || '').trim();
    const eff     = Number(data[i][effIdx]) || 0;
    if (!dateStr || eff === 0) continue;

    // 日期格式：yyyy/MM/dd
    const parts = dateStr.split('/');
    if (parts.length < 3) continue;
    const year  = Number(parts[0]);
    const month = Number(parts[1]);
    const day   = Number(parts[2]);
    if (year !== currentYear) continue;

    // 月合計
    if (!monthly[month]) monthly[month] = 0;
    monthly[month] += eff;

    // 當月日合計
    if (month === currentMonth) {
      const key = `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
      if (!daily[key]) daily[key] = { total: 0, empSet: [] };
      daily[key].total += eff;
      if (!daily[key].empSet.includes(empId)) daily[key].empSet.push(empId);
    }
  }

  const monthlyArr = Object.keys(monthly)
    .map(m => ({ month: Number(m), total: Math.round(monthly[m] * 100) / 100 }))
    .sort((a, b) => a.month - b.month);

  const dailyArr = Object.keys(daily)
    .map(d => ({
      date:      d,
      total:     Math.round(daily[d].total * 100) / 100,
      headcount: daily[d].empSet.length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { monthly: monthlyArr, daily: dailyArr, currentMonth, currentYear };
}
