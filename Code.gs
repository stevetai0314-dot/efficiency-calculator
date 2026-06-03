const SS_ID = '1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k';

function doGet(e) {
  const action   = e.parameter.action   || '';
  const callback = e.parameter.callback || '';
  const system   = e.parameter.system   || 'slitting';

  if (action === 'getEmployees')     return jsonp_(callback, getEmployees_());
  if (action === 'getSpecs')         return jsonp_(callback, getSpecs_(system));
  if (action === 'getSlittingReport') return jsonp_(callback, getSlittingReport_());
  if (action === 'getBackingReport') return jsonp_(callback, getBackingReport_());
  if (action === 'getWeldingReport') return jsonp_(callback, getWeldingReport_());
  if (action === 'getCuttingReport') return jsonp_(callback, getCuttingReport_());
  if (action === 'getProcessReport') return jsonp_(callback, getProcessReport_());

  return HtmlService.createHtmlOutputFromFile('report')
    .setTitle('效率報表總表')
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

// ── 鎖定 / 解鎖 ───────────────────────────────────────────────────────────────

const PROTECTED_SHEETS = ['分條記錄', '焊接記錄', '褙膠記錄', '裁切記錄', '切勾記錄'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('工具')
    .addItem('🔒 鎖定記錄分頁', 'lockSheets')
    .addItem('🔓 解鎖記錄分頁', 'unlockSheets')
    .addToUi();
}

function lockSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const me = Session.getEffectiveUser();
  PROTECTED_SHEETS.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length > 0) return;
    const prot = sheet.protect();
    prot.addEditor(me);
    const others = prot.getEditors().filter(u => u.getEmail() !== me.getEmail());
    if (others.length) prot.removeEditors(others);
  });
  SpreadsheetApp.getUi().alert('已鎖定所有記錄分頁。');
}

function unlockSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('解鎖密碼', '請輸入密碼：', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  if (response.getResponseText().trim() !== 'ZZ') {
    ui.alert('密碼錯誤。');
    return;
  }
  const ss = SpreadsheetApp.openById(SS_ID);
  PROTECTED_SHEETS.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  });
  ui.alert('已解鎖所有記錄分頁。');
}

// ── 員工清單 ──────────────────────────────────────────────────────────────────

function getEmployees_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('參數');
  const data  = sheet.getDataRange().getValues();
  const out   = [];
  for (let i = 0; i < data.length; i++) {
    const id   = String(data[i][2] || '').trim();
    const name = String(data[i][3] || '').trim();
    if (id && name) out.push({ id, name });
  }
  return out;
}

// ── 係數表 ────────────────────────────────────────────────────────────────────

function getSpecs_(system) {
  const ss = SpreadsheetApp.openById(SS_ID);

  if (system === 'slitting') {
    const sheet = ss.getSheetByName('參數');
    const data  = sheet.getDataRange().getValues();
    let headerRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][5]).trim() === '規格') { headerRow = i; break; }
    }
    if (headerRow === -1) return { specs: {}, lengths: [] };
    const lengths = [];
    for (let c = 7; c < data[headerRow].length; c++) {
      const h = String(data[headerRow][c]).trim().replace(/\n/g, ' ');
      if (h) lengths.push(h);
    }
    const specs = {};
    for (let i = headerRow + 1; i < data.length; i++) {
      const name = String(data[i][5] || '').trim();
      if (!name) continue;
      const strands      = Number(data[i][6]) || 0;
      const coefficients = lengths.map((_, ci) => Math.round((Number(data[i][7 + ci]) || 0) * 10000) / 10000);
      specs[name] = { strands, coefficients };
    }
    return { specs, lengths };
  }

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

  if (system === 'process') {
    const sheet = ss.getSheetByName('裁切參數');
    const data  = sheet.getDataRange().getValues();
    const processes = [], specs = [], lengths = [], colors = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim()) processes.push(String(data[i][0]).trim());
      if (String(data[i][1] || '').trim()) specs.push(String(data[i][1]).trim());
      if (String(data[i][2] || '').trim()) lengths.push(String(data[i][2]).trim());
      if (String(data[i][3] || '').trim()) colors.push(String(data[i][3]).trim());
    }
    return { processes, specs, lengths, colors };
  }

  return {};
}

// ── 儲存記錄 ──────────────────────────────────────────────────────────────────

function saveRecords_(records, date, system) {
  const sheetName = system === 'welding' ? '焊接記錄'
                  : system === 'backing' ? '褙膠記錄'
                  : system === 'process' ? '裁切記錄'
                  : system === 'cutting' ? '切勾記錄'
                  : '分條記錄';
  const sheet = getOrCreateSheet_(sheetName, system);
  const now   = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy/MM/dd HH:mm:ss');

  let rows;
  if (system === 'welding') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours,
      r.item, r.spec, r.coeff, r.points, r.efficiency,
      r.abnormalReason || '', r.newbieDeduct || ''
    ]);
  } else if (system === 'backing') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours,
      r.category, r.spec, r.coeff, r.rolls, r.efficiency,
      r.abnormalReason || '', r.newbieDeduct || ''
    ]);
  } else if (system === 'cutting') {
    rows = records.map(r => [
      date, r.cutCount || 0, r.workHours || 0, r.deptCount || 0,
      r.abnormalHours || 0, r.abnormalReason || ''
    ]);
  } else if (system === 'process') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.process, r.startTime, r.endTime, r.orderNo || '', r.customer || '',
      r.spec || '', r.color || '', r.length || '', r.rolls || 0,
      r.sheetLen || 0, r.sheetCnt || 0, r.strips || 1, r.cuts || 0,
      r.abnormalHoursTotal || 0, r.abnormalReason || '',
      r.workHours || 0
    ]);
  } else {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.workHours, r.abnormalHours, r.prodAbnormalHours,
      r.spec, r.length, r.rolls, r.coeff, r.efficiency,
      r.abnormalReason || '', r.newbieDeduct || ''
    ]);
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
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
                 '項目','規格分類','係數','點數','效率換算','異常原因','新人扣時%'];
    } else if (system === 'backing') {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '碼長','規格分類','係數','卷數','效率換算','異常原因','新人扣時%'];
    } else if (system === 'cutting') {
      headers = ['日期','切勾數量','工作時數','機器數','異常時數','異常原因'];
    } else if (system === 'process') {
      headers = ['生產日期','儲存時間','工號','員工姓名',
                 '工序','開始時間','結束時間','訂單號','客戶名稱',
                 '規格','顏色','碼長','捲數','片長','片數','條數','刀數',
                 '異常時數合計','異常原因','當日工作時數'];
    } else {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '生產異常帶時數','規格','碼長','捲數','係數','效率換算','異常原因','新人扣時%'];
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange('C:C').setNumberFormat('@');
  }
  return sheet;
}

// ── 分條詳細報表（月報 + 日報）────────────────────────────────────────────────

function getSlittingReport_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const tz = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 歷史月報匯總（A=年, B=月, C=捲數, D=效率捲數, E=加權工時）
  const histMap = {};
  const histSheet = ss.getSheetByName('分條月報匯總');
  if (histSheet) {
    const hd = histSheet.getDataRange().getValues();
    for (let i = 1; i < hd.length; i++) {
      const y = Number(hd[i][0]), m = Number(hd[i][1]);
      if (!y || !m) continue;
      histMap[`${y}-${m}`] = {
        rolls: Number(hd[i][2]) || 0,
        effRolls: Number(hd[i][3]) || 0,
        weightedHours: Number(hd[i][4]) || 0
      };
    }
  }

  // col 0=生產日期, 2=工號, 4=上班時數, 5=異常時數, 6=生產異常帶時數, 9=捲數, 11=效率換算
  const monthlyDet = {};
  const dailyDet   = {};

  const recSheet = ss.getSheetByName('分條記錄');
  if (recSheet) {
    const rows = recSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rawDate  = rows[i][0];
      const dateStr  = rawDate instanceof Date
        ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
        : String(rawDate || '').trim();
      const empId    = String(rows[i][2] || '').trim();
      const workH    = Number(rows[i][4]) || 0;
      const abnH     = Number(rows[i][5]) || 0;
      const prodAbnH = Number(rows[i][6]) || 0;
      const rolls    = Number(rows[i][9]) || 0;
      const effRolls = Number(rows[i][11]) || 0;

      if (!dateStr || !workH) continue;

      const parts = dateStr.split(/[\/\-]/);
      if (parts.length < 3) continue;
      const year  = Number(parts[0]);
      const month = Number(parts[1]);
      const day   = Number(parts[2]);
      if (year !== currentYear) continue;

      const P         = workH - abnH - prodAbnH * 0.2;
      const empDayKey = `${empId}|${dateStr}`;
      const dayKey    = `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;

      // 月報累計（含每日小計用於平均）
      if (!monthlyDet[month]) monthlyDet[month] = { rolls: 0, effRolls: 0, weightedHours: 0, empDays: {}, dayHours: {} };
      if (!monthlyDet[month].empDays[empDayKey]) {
        monthlyDet[month].empDays[empDayKey] = true;
        monthlyDet[month].weightedHours += P;
        monthlyDet[month].dayHours[dayKey] = (monthlyDet[month].dayHours[dayKey] || 0) + P;
      }
      monthlyDet[month].rolls    += rolls;
      monthlyDet[month].effRolls += effRolls;

      // 日報累計（全年所有月份）
      if (!dailyDet[dayKey]) dailyDet[dayKey] = { rolls: 0, effRolls: 0, weightedHours: 0, empSet: {}, month, day };
      if (!dailyDet[dayKey].empSet[empId]) {
        dailyDet[dayKey].empSet[empId] = true;
        dailyDet[dayKey].weightedHours += P;
      }
      dailyDet[dayKey].rolls    += rolls;
      dailyDet[dayKey].effRolls += effRolls;
    }
  }

  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      const totalH     = det.weightedHours;
      const activeDays = Object.values(det.dayHours).filter(h => h > 0).length;
      const avgH       = activeDays > 0 ? Math.round(totalH / activeDays * 100) / 100 : 0;
      monthly.push({ month: m,
        rolls: Math.round(det.rolls * 10) / 10,
        effRolls: Math.round(det.effRolls * 100) / 100,
        weightedHours: Math.round(totalH * 100) / 100,
        avgWeightedHours: avgH,
        hasData: true, isHistorical: false });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.rolls || hist.effRolls || hist.weightedHours)) {
        monthly.push({ month: m,
          rolls: Math.round(hist.rolls * 10) / 10,
          effRolls: Math.round(hist.effRolls * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          avgWeightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return { date: dayKey, day: dd.day, month: dd.month,
      rolls: Math.round(dd.rolls * 10) / 10,
      effRolls: Math.round(dd.effRolls * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100 };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // 機台數量（全年所有月份）
  const machineCounts = {};
  const machineSheet = ss.getSheetByName('開機台數備註');
  if (machineSheet) {
    const md = machineSheet.getDataRange().getValues();
    for (let i = 1; i < md.length; i++) {
      const rawD = md[i][0];
      const dStr = rawD instanceof Date
        ? Utilities.formatDate(rawD, tz, 'yyyy/MM/dd')
        : String(rawD || '').trim();
      const cnt = Number(md[i][1]) || 0;
      if (!dStr || !cnt) continue;
      const p = dStr.split(/[\/\-]/);
      if (p.length < 3) continue;
      const my = Number(p[0]), mm = Number(p[1]), md2 = Number(p[2]);
      if (my !== currentYear) continue;
      machineCounts[`${String(mm).padStart(2,'0')}/${String(md2).padStart(2,'0')}`] = cnt;
    }
  }

  return { monthly, daily, machineCounts, currentMonth, currentYear };
}

// ── 褙膠詳細報表（月報 + 日報）────────────────────────────────────────────────

function getBackingReport_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const tz = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 歷史月報匯總（A=年, B=月, C=卷數, D=效率卷數, E=加權工時）
  const histMap = {};
  const histSheet = ss.getSheetByName('褙膠月報匯總');
  if (histSheet) {
    const hd = histSheet.getDataRange().getValues();
    for (let i = 1; i < hd.length; i++) {
      const y = Number(hd[i][0]), m = Number(hd[i][1]);
      if (!y || !m) continue;
      histMap[`${y}-${m}`] = {
        effRolls: Number(hd[i][3]) || 0,
        weightedHours: Number(hd[i][4]) || 0
      };
    }
  }

  // 褙膠記錄：col 2=工號, 4=上班時數, 13=效率卷數(N), 14=加權工時(O)
  const monthlyDet = {};
  const dailyDet   = {};

  const recSheet = ss.getSheetByName('褙膠記錄');
  if (recSheet) {
    const rows = recSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rawDate   = rows[i][0];
      const dateStr   = rawDate instanceof Date
        ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
        : String(rawDate || '').trim();
      const empId     = String(rows[i][2] || '').trim();
      const workH     = Number(rows[i][4]) || 0;
      const effRolls  = Number(rows[i][13]) || 0;
      const weightedH = Number(rows[i][14]) || 0;

      if (!dateStr || !workH) continue;

      const parts = dateStr.split(/[\/\-]/);
      if (parts.length < 3) continue;
      const year  = Number(parts[0]);
      const month = Number(parts[1]);
      const day   = Number(parts[2]);
      if (year !== currentYear) continue;

      const empDayKey = `${empId}|${dateStr}`;

      if (!monthlyDet[month]) monthlyDet[month] = { effRolls: 0, weightedHours: 0, empDays: {} };
      if (!monthlyDet[month].empDays[empDayKey]) {
        monthlyDet[month].empDays[empDayKey] = true;
        monthlyDet[month].weightedHours += weightedH;
      }
      monthlyDet[month].effRolls += effRolls;

      if (month === currentMonth) {
        const dayKey = `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
        if (!dailyDet[dayKey]) dailyDet[dayKey] = { effRolls: 0, weightedHours: 0, empSet: {} };
        if (!dailyDet[dayKey].empSet[empId]) {
          dailyDet[dayKey].empSet[empId] = true;
          dailyDet[dayKey].weightedHours += weightedH;
        }
        dailyDet[dayKey].effRolls += effRolls;
      }
    }
  }

  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      monthly.push({ month: m,
        effRolls: Math.round(det.effRolls * 100) / 100,
        weightedHours: Math.round(det.weightedHours * 100) / 100,
        hasData: true, isHistorical: false });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.effRolls || hist.weightedHours)) {
        monthly.push({ month: m,
          effRolls: Math.round(hist.effRolls * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return { date: dayKey, day: Number(dayKey.split('/')[1]),
      effRolls: Math.round(dd.effRolls * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100 };
  }).sort((a, b) => a.day - b.day);

  // 機台數量（開機台數備註 C欄，index 2）
  const machineCounts = {};
  const machineSheet = ss.getSheetByName('開機台數備註');
  if (machineSheet) {
    const md = machineSheet.getDataRange().getValues();
    for (let i = 1; i < md.length; i++) {
      const rawD = md[i][0];
      const dStr = rawD instanceof Date
        ? Utilities.formatDate(rawD, tz, 'yyyy/MM/dd')
        : String(rawD || '').trim();
      const cnt = Number(md[i][2]) || 0;
      if (!dStr || !cnt) continue;
      const p = dStr.split(/[\/\-]/);
      if (p.length < 3) continue;
      const my = Number(p[0]), mm = Number(p[1]), md2 = Number(p[2]);
      if (my !== currentYear || mm !== currentMonth) continue;
      machineCounts[`${String(mm).padStart(2,'0')}/${String(md2).padStart(2,'0')}`] = cnt;
    }
  }

  return { monthly, daily, machineCounts, currentMonth, currentYear };
}

// ── 焊接詳細報表（月報 + 日報）────────────────────────────────────────────────

function getWeldingReport_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const tz = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 歷史月報匯總（A=年, B=月, C=效率換算, D=加權工時）
  const histMap = {};
  const histSheet = ss.getSheetByName('焊接月報匯總');
  if (histSheet) {
    const hd = histSheet.getDataRange().getValues();
    for (let i = 1; i < hd.length; i++) {
      const y = Number(hd[i][0]), m = Number(hd[i][1]);
      if (!y || !m) continue;
      histMap[`${y}-${m}`] = {
        effScore: Number(hd[i][2]) || 0,
        weightedHours: Number(hd[i][3]) || 0
      };
    }
  }

  // 焊接記錄：col 2=工號, 4=上班時數, 5=異常時數, 10=效率換算
  const monthlyDet = {};
  const dailyDet   = {};

  const recSheet = ss.getSheetByName('焊接記錄');
  if (recSheet) {
    const rows = recSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rawDate  = rows[i][0];
      const dateStr  = rawDate instanceof Date
        ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
        : String(rawDate || '').trim();
      const empId    = String(rows[i][2] || '').trim();
      const workH    = Number(rows[i][4]) || 0;
      const abnH     = Number(rows[i][5]) || 0;
      const effScore = Number(rows[i][10]) || 0;

      if (!dateStr || !workH) continue;

      const parts = dateStr.split(/[\/\-]/);
      if (parts.length < 3) continue;
      const year  = Number(parts[0]);
      const month = Number(parts[1]);
      const day   = Number(parts[2]);
      if (year !== currentYear) continue;

      const P         = workH - abnH;
      const empDayKey = `${empId}|${dateStr}`;

      if (!monthlyDet[month]) monthlyDet[month] = { effScore: 0, weightedHours: 0, empDays: {} };
      if (!monthlyDet[month].empDays[empDayKey]) {
        monthlyDet[month].empDays[empDayKey] = true;
        monthlyDet[month].weightedHours += P;
      }
      monthlyDet[month].effScore += effScore;

      if (month === currentMonth) {
        const dayKey = `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
        if (!dailyDet[dayKey]) dailyDet[dayKey] = { effScore: 0, weightedHours: 0, empSet: {} };
        if (!dailyDet[dayKey].empSet[empId]) {
          dailyDet[dayKey].empSet[empId] = true;
          dailyDet[dayKey].weightedHours += P;
        }
        dailyDet[dayKey].effScore += effScore;
      }
    }
  }

  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      monthly.push({ month: m,
        effScore: Math.round(det.effScore * 100) / 100,
        weightedHours: Math.round(det.weightedHours * 100) / 100,
        hasData: true, isHistorical: false });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.effScore || hist.weightedHours)) {
        monthly.push({ month: m,
          effScore: Math.round(hist.effScore * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return { date: dayKey, day: Number(dayKey.split('/')[1]),
      effScore: Math.round(dd.effScore * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100 };
  }).sort((a, b) => a.day - b.day);

  // 機台數量（開機台數備註 D欄，index 3）
  const machineCounts = {};
  const machineSheet = ss.getSheetByName('開機台數備註');
  if (machineSheet) {
    const md = machineSheet.getDataRange().getValues();
    for (let i = 1; i < md.length; i++) {
      const rawD = md[i][0];
      const dStr = rawD instanceof Date
        ? Utilities.formatDate(rawD, tz, 'yyyy/MM/dd')
        : String(rawD || '').trim();
      const cnt = Number(md[i][3]) || 0;
      if (!dStr || !cnt) continue;
      const p = dStr.split(/[\/\-]/);
      if (p.length < 3) continue;
      const my = Number(p[0]), mm = Number(p[1]), md2 = Number(p[2]);
      if (my !== currentYear || mm !== currentMonth) continue;
      machineCounts[`${String(mm).padStart(2,'0')}/${String(md2).padStart(2,'0')}`] = cnt;
    }
  }

  return { monthly, daily, machineCounts, currentMonth, currentYear };
}

// ── 切勾報表 ──────────────────────────────────────────────────────────────────

function getCuttingReport_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('切勾記錄');
  if (!sheet) return { monthly: [], daily: [], currentMonthTotal: 0, currentMonth: 0, currentYear: 0 };

  const tz           = 'Asia/Ho_Chi_Minh';
  const now          = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  const data   = sheet.getDataRange().getValues();
  const byDate = {};

  for (let i = 1; i < data.length; i++) {
    const rawDate = data[i][0];
    const dateStr = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
      : String(rawDate || '').trim();
    const count    = Number(data[i][1]) || 0;
    const workH    = Number(data[i][2]) || 0;
    const machines = Number(data[i][3]) || 0;
    if (!dateStr || !count) continue;

    const parts = dateStr.split(/[\/\-]/);
    if (parts.length < 3) continue;
    const year  = Number(parts[0]);
    const month = Number(parts[1]);
    const day   = Number(parts[2]);
    if (year !== currentYear) continue;

    if (!byDate[dateStr]) byDate[dateStr] = { count: 0, workH: 0, machines: 0, year, month, day };
    byDate[dateStr].count    += count;
    byDate[dateStr].workH    += workH;
    byDate[dateStr].machines += machines;
  }

  // 月報：工時/機器數取平均（排除0）
  const monthlyMap = {};
  for (const d of Object.values(byDate)) {
    const monthKey = `${d.year}-${String(d.month).padStart(2,'0')}`;
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { count: 0, workH: 0, workDays: 0, machines: 0, machineDays: 0 };
    monthlyMap[monthKey].count += d.count;
    if (d.workH > 0)    { monthlyMap[monthKey].workH += d.workH; monthlyMap[monthKey].workDays++; }
    if (d.machines > 0) { monthlyMap[monthKey].machines += d.machines; monthlyMap[monthKey].machineDays++; }
  }

  const monthlyArr = Object.keys(monthlyMap).sort().map(m => ({
    month: m,
    totalCount: monthlyMap[m].count,
    avgWorkH: monthlyMap[m].workDays > 0
      ? Math.round(monthlyMap[m].workH / monthlyMap[m].workDays * 100) / 100 : 0,
    avgMachines: monthlyMap[m].machineDays > 0
      ? Math.round(monthlyMap[m].machines / monthlyMap[m].machineDays * 10) / 10 : 0,
  }));

  const dailyArr = Object.values(byDate)
    .sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    })
    .map(d => ({
      date: `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`,
      count: d.count,
      workH: Math.round(d.workH * 100) / 100,
      machines: d.machines,
      year: d.year, month: d.month, day: d.day
    }));

  const currentMonthKey   = `${currentYear}-${String(currentMonth).padStart(2,'0')}`;
  const currentMonthTotal = monthlyMap[currentMonthKey] ? monthlyMap[currentMonthKey].count : 0;

  return { monthly: monthlyArr, daily: dailyArr, currentMonthTotal, currentMonth, currentYear };
}

// ── 裁切報表 ──────────────────────────────────────────────────────────────────

function getProcessReport_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('裁切記錄');
  if (!sheet) return { monthly: [], daily: [] };

  const tz           = 'Asia/Ho_Chi_Minh';
  const now          = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // col 0=生產日期, 23=有效時數(X欄), 25=裁切工時(Z欄)
  const data    = sheet.getDataRange().getValues();
  const monthly = {};
  const daily   = {};

  for (let i = 1; i < data.length; i++) {
    const rawDate  = data[i][0];
    const dateStr  = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
      : String(rawDate || '').trim();
    const effHours = Number(data[i][23]) || 0;
    const cutHours = Number(data[i][25]) || 0;
    if (!dateStr) continue;

    const parts = dateStr.split(/[\/\-]/);
    if (parts.length < 3) continue;
    const year  = Number(parts[0]);
    const month = Number(parts[1]);
    const day   = Number(parts[2]);
    if (year !== currentYear) continue;

    const monthKey = `${year}-${String(month).padStart(2,'0')}`;
    if (!monthly[monthKey]) monthly[monthKey] = { effHours: 0, cutHours: 0 };
    monthly[monthKey].effHours += effHours;
    monthly[monthKey].cutHours += cutHours;

    if (month === currentMonth) {
      const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      if (!daily[dateKey]) daily[dateKey] = { effHours: 0, cutHours: 0 };
      daily[dateKey].effHours += effHours;
      daily[dateKey].cutHours += cutHours;
    }
  }

  const monthlyArr = Object.keys(monthly).sort().map(m => {
    const { effHours, cutHours } = monthly[m];
    const utilization = cutHours > 0 ? Math.round(effHours / cutHours * 1000) / 10 : null;
    return { month: m, utilization,
      totalEffHours: Math.round(effHours * 100) / 100,
      totalCutHours: Math.round(cutHours * 100) / 100 };
  });

  const dailyArr = Object.keys(daily).sort().map(d => {
    const { effHours, cutHours } = daily[d];
    const utilization = cutHours > 0 ? Math.round(effHours / cutHours * 1000) / 10 : null;
    return { date: d, utilization,
      totalEffHours: Math.round(effHours * 100) / 100,
      totalCutHours: Math.round(cutHours * 100) / 100 };
  });

  return { monthly: monthlyArr, daily: dailyArr };
}
