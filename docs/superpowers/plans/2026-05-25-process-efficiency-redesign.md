# 裁片效率值重設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將裁片效率計算從「工時利用率（開始/結束時間差÷上班時數）」改為「有效時數（X欄）÷裁切工時（Z欄）」，日報與月報均採新算法。

**Architecture:** Code.gs 的 `getProcessReport_()` 改讀 Sheets 的 X欄（index 23）和 Z欄（index 25），依日期分組加總，回傳新格式。report.html 的 `renderProcessReport` 配合新欄位名稱顯示，移除三色標示。

**Tech Stack:** Google Apps Script (ES2019)、Bootstrap 5、原生 JavaScript

---

### Task 1：修改 Code.gs — getProcessReport_()

**Files:**
- Modify: `Code.gs`（找到 `getProcessReport_` 函數，約 50 行）

- [ ] **Step 1：確認目前函數位置**

在 `Code.gs` 中搜尋 `function getProcessReport_`，確認函數起始行。

- [ ] **Step 2：替換整個 getProcessReport_ 函數**

將整個 `getProcessReport_()` 函數替換為以下程式碼：

```javascript
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
    const dateStr  = String(data[i][0] || '').trim();
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
    return { date: d, utilization };
  });

  return { monthly: monthlyArr, daily: dailyArr };
}
```

- [ ] **Step 3：在 Apps Script 編輯器中手動驗證**

在 Apps Script 編輯器執行以下測試函數（新增後執行，再刪除）：

```javascript
function testProcessReport() {
  const result = getProcessReport_();
  Logger.log(JSON.stringify(result.monthly.slice(0, 2)));
  Logger.log(JSON.stringify(result.daily.slice(0, 3)));
  // 驗證：monthly 每筆有 month, utilization, totalEffHours, totalCutHours
  // 驗證：daily 每筆有 date, utilization
  // 驗證：cutHours=0 的日期 utilization 為 null
}
```

預期 Log 輸出類似：
```
[{"month":"2026-05","utilization":85.3,"totalEffHours":42.5,"totalCutHours":49.8}]
[{"date":"2026-05-25","utilization":87.2}]
```

- [ ] **Step 4：Commit**

```bash
git add Code.gs
git commit -m "feat: rewrite getProcessReport_ to use X/Z columns for efficiency"
```

---

### Task 2：修改 report.html — 裁片分頁 HTML 表頭

**Files:**
- Modify: `report.html`（找到 `id="tab-process"` 區塊內的 `<thead>`）

- [ ] **Step 1：找到月報表頭並替換**

找到以下原始表頭：

```html
          <thead class="table-dark text-center">
            <tr>
              <th style="width:80px">月份</th>
              <th>總上班時數</th>
              <th>總生產時數</th>
              <th>工時利用率</th>
            </tr>
          </thead>
```

替換為：

```html
          <thead class="table-dark text-center">
            <tr>
              <th style="width:80px">月份</th>
              <th>有效時數</th>
              <th>裁切工時</th>
              <th>效率</th>
            </tr>
          </thead>
```

- [ ] **Step 2：Commit**

```bash
git add report.html
git commit -m "feat: update process report table headers to match new efficiency columns"
```

---

### Task 3：修改 report.html — renderProcessReport 函數

**Files:**
- Modify: `report.html`（找到 `function renderProcessReport` 函數）

- [ ] **Step 1：找到並替換整個 renderProcessReport 函數**

找到原始函數：

```javascript
function renderProcessReport(data) {
  const { monthly, daily } = data;
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  document.getElementById('process-year-label').textContent = 
    `${currentYear} 年裁片工時利用率月報`;
  document.getElementById('process-daily-title').textContent =
    `▼ ${currentYear}年 ${currentMonth}月 日報`;

  function utilCls(u) {
    return u >= 100 ? 'eff-high' : u >= 90 ? 'eff-mid' : 'eff-low';
  }

  if (!monthly.length) {
    document.getElementById('process-monthly-body').innerHTML =
      '<tr><td colspan="4" class="text-center text-muted py-3">尚無資料</td></tr>';
  } else {
    document.getElementById('process-monthly-body').innerHTML = monthly.map(m =>
      `<tr class="text-center">
        <td class="fw-semibold">${m.month}</td>
        <td class="text-end">${fmt2(m.totalWorkHours)}</td>
        <td class="text-end">${fmt2(m.totalProdHours)}</td>
        <td class="${utilCls(m.utilization)}">${m.utilization.toFixed(1)}%</td>
      </tr>`
    ).join('');
  }

  if (!daily.length) {
    document.getElementById('process-daily-body').innerHTML =
      '<tr><td colspan="2" class="text-center text-muted py-3">本月尚無資料</td></tr>';
  } else {
    document.getElementById('process-daily-body').innerHTML = daily.map(d =>
      `<tr class="text-center">
        <td class="fw-semibold">${d.date.slice(5)}</td>
        <td class="${utilCls(d.utilization)}">${d.utilization.toFixed(1)}%</td>
      </tr>`
    ).join('');
  }
}
```

替換為：

```javascript
function renderProcessReport(data) {
  const { monthly, daily } = data;
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  document.getElementById('process-year-label').textContent =
    `${currentYear} 年裁片效率月報`;
  document.getElementById('process-daily-title').textContent =
    `▼ ${currentYear}年 ${currentMonth}月 日報`;

  function fmtUtil(u) {
    return u === null ? '-' : u.toFixed(1) + '%';
  }

  if (!monthly.length) {
    document.getElementById('process-monthly-body').innerHTML =
      '<tr><td colspan="4" class="text-center text-muted py-3">尚無資料</td></tr>';
  } else {
    document.getElementById('process-monthly-body').innerHTML = monthly.map(m =>
      `<tr class="text-center">
        <td class="fw-semibold">${m.month}</td>
        <td class="text-end">${fmt2(m.totalEffHours)}</td>
        <td class="text-end">${fmt2(m.totalCutHours)}</td>
        <td class="td-num">${fmtUtil(m.utilization)}</td>
      </tr>`
    ).join('');
  }

  if (!daily.length) {
    document.getElementById('process-daily-body').innerHTML =
      '<tr><td colspan="2" class="text-center text-muted py-3">本月尚無資料</td></tr>';
  } else {
    document.getElementById('process-daily-body').innerHTML = daily.map(d =>
      `<tr class="text-center">
        <td class="fw-semibold">${d.date.slice(5)}</td>
        <td class="td-num">${fmtUtil(d.utilization)}</td>
      </tr>`
    ).join('');
  }
}
```

- [ ] **Step 2：驗證頁面正確顯示**

在瀏覽器開啟 GitHub Pages 網址，切換到「裁片」分頁，確認：
- 月報表頭顯示「有效時數」、「裁切工時」、「效率」
- 效率欄顯示如 `85.3%`，Z=0 的列顯示 `-`
- 無綠/橙/紅顏色標示
- 標題顯示「XXXX 年裁片效率月報」

- [ ] **Step 3：Commit**

```bash
git add report.html
git commit -m "feat: update renderProcessReport to use new efficiency calculation"
```

---

### Task 4：推送至 GitHub

- [ ] **Push**

```bash
git push origin master
```

- [ ] **確認 GitHub Pages 部署完成**

等待約 1 分鐘後重新整理頁面，確認裁片分頁顯示正確。
