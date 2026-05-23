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
  if (action === 'getSlittingReport') {
    return jsonp_(callback, getSlittingReport_());
  }
  if (action === 'getBackingReport') {
    return jsonp_(callback, getBackingReport_());
  }
  if (action === 'getWeldingReport') {
    return jsonp_(callback, getWeldingReport_());
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
      const h = String(data[headerRow][c]).trim().replace(/\n/g, ' ');
      if (h) lengths.push(h);
    }

    const specs = {};
    for (let i = headerRow + 1; i < data.length; i++) {
      const name = String(data[i][5] || '').trim();
      if (!name) continue;
      const strands      = Number(data[i][6]) || 0;
      const coefficients = lengths.map((_, ci) => {
        const v = Number(data[i][7 + ci]) || 0;
        return Math.round(v * 10000) / 10000;
      });
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

  // 裁切：從「裁切參數」分頁讀取
  // 表頭：A=工序, B=規格, C=碼長, D=顏色
  if (system === 'process') {
    const sheet = ss.getSheetByName('裁切參數');
    if (!sheet) return { processes: [], specs: [], lengths: [], colors: [] };
    const data = sheet.getDataRange().getValues();
    const processes = [], specs = [], lengths = [], colors = [];
    for (let i = 1; i < data.length; i++) {
      const p = String(data[i][0] || '').trim();
      const s = String(data[i][1] || '').trim();
      const l = String(data[i][2] || '').trim();
      const c = String(data[i][3] || '').trim();
      if (p && !processes.includes(p)) processes.push(p);
      if (s && !specs.includes(s))     specs.push(s);
      if (l && !lengths.includes(l))   lengths.push(l);
      if (c && !colors.includes(c))    colors.push(c);
    }
    return { processes, specs, lengths, colors };
  }

  return {};
}

// ── 儲存記錄 ──────────────────────────────────────────────────────────────────

function saveRecords_(records, date, system) {
  const sheetName = system === 'welding' ? '焊接記錄'
                  : system === 'backing' ? '褙膠記錄'
                  : system === 'cutting' ? '切勾記錄'
                  : system === 'process' ? '裁切記錄'
                  : '分條記錄';
  const sheet = getOrCreateSheet_(sheetName, system);
  const now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

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
      date, now,
      r.workHours, r.abnormalHours, r.abnormalReason || '',
      r.deptCount, r.cutCount
    ]);
  } else if (system === 'process') {
    rows = records.map(r => [
      date, now, r.empId, r.empName,
      r.process, r.startTime, r.endTime,
      r.orderNo, r.customer,
      r.spec, r.color, r.length,
      r.rolls, r.sheetLen, r.sheetCnt, r.strips, r.cuts,
      r.abnormalHoursTotal, r.abnormalReason || ''
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
                 '項目','規格分類','係數','點數','效率換算',
                 '異常原因','新人扣時%'];
    } else if (system === 'backing') {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '碼長','規格分類','係數','卷數','效率換算',
                 '異常原因','新人扣時%'];
    } else if (system === 'cutting') {
      headers = ['生產日期','儲存時間','上班時數','異常時數','異常原因','部門人數','切勾數量'];
    } else if (system === 'process') {
      headers = ['生產日期','儲存時間','工號','員工姓名',
                 '工序','開始時間','結束時間','訂單號','客戶名稱',
                 '規格','顏色','碼長','捲數','片長','片數','條數','刀數',
                 '異常時數合計','異常原因'];
    } else {
      headers = ['生產日期','儲存時間','工號','員工姓名','上班時數','異常時數',
                 '生產異常帶時數','規格','碼長','捲數','係數','效率換算',
                 '異常原因','新人扣時%'];
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    if (system !== 'cutting') {
      sheet.getRange('C:C').setNumberFormat('@');
    }
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

    // 日期格式：yyyy/MM/dd 或 yyyy-MM-dd
    const parts = dateStr.split(/[\/\-]/);
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

// ── 分條詳細報表（月報 + 日報）────────────────────────────────────────────────

function getSlittingReport_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const tz = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 歷史月報匯總（A=年,B=月,C=捲數,D=效率捲數,E=加權工時）
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

  // 分條記錄明細
  // 欄位索引：0=生產日期,2=工號,4=上班時數,5=異常時數,6=生產異常帶時數,9=捲數,11=效率換算
  const monthlyDet = {}; // month -> {rolls, effRolls, weightedHours, empDays:{}}
  const dailyDet   = {}; // 'MM/dd' -> {rolls, effRolls, weightedHours, empSet:{}}

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

      const P          = workH - abnH - prodAbnH * 0.2;
      const empDayKey  = `${empId}|${dateStr}`;

      if (!monthlyDet[month]) monthlyDet[month] = { rolls: 0, effRolls: 0, weightedHours: 0, empDays: {} };
      if (!monthlyDet[month].empDays[empDayKey]) {
        monthlyDet[month].empDays[empDayKey] = true;
        monthlyDet[month].weightedHours += P;
      }
      monthlyDet[month].rolls    += rolls;
      monthlyDet[month].effRolls += effRolls;

      if (month === currentMonth) {
        const dayKey = `${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
        if (!dailyDet[dayKey]) dailyDet[dayKey] = { rolls: 0, effRolls: 0, weightedHours: 0, empSet: {} };
        if (!dailyDet[dayKey].empSet[empId]) {
          dailyDet[dayKey].empSet[empId] = true;
          dailyDet[dayKey].weightedHours += P;
        }
        dailyDet[dayKey].rolls    += rolls;
        dailyDet[dayKey].effRolls += effRolls;
      }
    }
  }

  // 建立月報陣列（1 到 currentMonth）
  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      monthly.push({
        month: m,
        rolls: Math.round(det.rolls * 10) / 10,
        effRolls: Math.round(det.effRolls * 100) / 100,
        weightedHours: Math.round(det.weightedHours * 100) / 100,
        hasData: true, isHistorical: false
      });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.rolls || hist.effRolls || hist.weightedHours)) {
        monthly.push({
          month: m,
          rolls: Math.round(hist.rolls * 10) / 10,
          effRolls: Math.round(hist.effRolls * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true
        });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  // 建立日報陣列（當月有資料的日期）
  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return {
      date: dayKey,
      day: Number(dayKey.split('/')[1]),
      headcount: Object.keys(dd.empSet).length,
      rolls: Math.round(dd.rolls * 10) / 10,
      effRolls: Math.round(dd.effRolls * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100
    };
  }).sort((a, b) => a.day - b.day);

  // 機台數量（分條日報備注：A=日期, B=機台數量，只讀當月）
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

  // 焊接記錄：col 2=工號, col 4=上班時數, col 5=異常時數, col 10=效率換算
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

  // 建立月報陣列
  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      monthly.push({
        month: m,
        effScore: Math.round(det.effScore * 100) / 100,
        weightedHours: Math.round(det.weightedHours * 100) / 100,
        hasData: true, isHistorical: false
      });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.effScore || hist.weightedHours)) {
        monthly.push({
          month: m,
          effScore: Math.round(hist.effScore * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true
        });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  // 建立日報陣列
  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return {
      date: dayKey,
      day: Number(dayKey.split('/')[1]),
      effScore: Math.round(dd.effScore * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100
    };
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

// ── 褙膠詳細報表（月報 + 日報）────────────────────────────────────────────────

function getBackingReport_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const tz = 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const currentYear  = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, tz, 'MM'));

  // 歷史月報匯總（A=年,B=月,C=卷數,D=效率卷數,E=加權工時）
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

  // 褙膠記錄：col 13(N)=效率卷數, col 14(O)=加權生產時數
  // col 4(E)=上班時數（作為 skip 判斷用）
  const monthlyDet = {};
  const dailyDet   = {};

  const recSheet = ss.getSheetByName('褙膠記錄');
  if (recSheet) {
    const rows = recSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const rawDate    = rows[i][0];
      const dateStr    = rawDate instanceof Date
        ? Utilities.formatDate(rawDate, tz, 'yyyy/MM/dd')
        : String(rawDate || '').trim();
      const empId      = String(rows[i][2] || '').trim();
      const workH      = Number(rows[i][4]) || 0;
      const effRolls   = Number(rows[i][13]) || 0;
      const weightedH  = Number(rows[i][14]) || 0;

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

  // 建立月報陣列
  const monthly = [];
  for (let m = 1; m <= currentMonth; m++) {
    const det = monthlyDet[m];
    if (det) {
      monthly.push({
        month: m,
        effRolls: Math.round(det.effRolls * 100) / 100,
        weightedHours: Math.round(det.weightedHours * 100) / 100,
        hasData: true, isHistorical: false
      });
    } else {
      const hist = histMap[`${currentYear}-${m}`];
      if (hist && (hist.effRolls || hist.weightedHours)) {
        monthly.push({
          month: m,
          effRolls: Math.round(hist.effRolls * 100) / 100,
          weightedHours: Math.round(hist.weightedHours * 100) / 100,
          hasData: true, isHistorical: true
        });
      } else {
        monthly.push({ month: m, hasData: false, isHistorical: false });
      }
    }
  }

  // 建立日報陣列
  const daily = Object.keys(dailyDet).map(dayKey => {
    const dd = dailyDet[dayKey];
    return {
      date: dayKey,
      day: Number(dayKey.split('/')[1]),
      effRolls: Math.round(dd.effRolls * 100) / 100,
      weightedHours: Math.round(dd.weightedHours * 100) / 100
    };
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
