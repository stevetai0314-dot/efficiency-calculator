# 效率換算工具

工廠各工作站效率報表系統，前端為 GAS Web App（Bootstrap 5），後端為 Google Apps Script，資料儲存於 Google Sheets。

---

## 重要 ID

| 項目 | 值 |
|------|----|
| Spreadsheet ID | `1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k` |
| GAS Script ID | `1aDAg10cVtRYyFx5Xef1lYJZraow_XC6fRltPEhZoLkfWfj04444JtTxB` |
| Deployment ID | `AKfycbyKEIcvpKEeTG2iOdyEkIP93ofx1oCl4qLvs3WPvYw930uV8UY--xzYYR8Bgi1cRcol` |
| GAS 執行網址 | `https://script.google.com/macros/s/AKfycbyKEIcvpKEeTG2iOdyEkIP93ofx1oCl4qLvs3WPvYw930uV8UY--xzYYR8Bgi1cRcol/exec` |
| Timezone | `Asia/Ho_Chi_Minh` |

---

## 換電腦開始工作

### 1. 安裝 clasp（防火牆要走 npm mirror）

```powershell
npm install -g @google/clasp --registry https://registry.npmmirror.com
```

### 2. 登入 Google

```powershell
clasp login
```

### 3. 開啟 Apps Script API（每個 Google 帳號只需做一次）

前往 https://script.google.com/home/usersettings 把 **Google Apps Script API** 切換為開啟。

### 4. 建立工作目錄

```powershell
New-Item -ItemType Directory -Force "C:\tmp\gas"
```

從 GitHub 下載最新檔案：

```powershell
gh api "repos/stevetai0314-dot/efficiency-calculator/contents/Code.gs" --header "Accept: application/vnd.github.raw" | Out-File "C:\tmp\gas\Code.gs" -Encoding utf8
gh api "repos/stevetai0314-dot/efficiency-calculator/contents/report.html" --header "Accept: application/vnd.github.raw" | Out-File "C:\tmp\gas\report.html" -Encoding utf8
```

### 5. 建立設定檔

**`C:\tmp\gas\.clasp.json`**：

```json
{
  "scriptId": "1aDAg10cVtRYyFx5Xef1lYJZraow_XC6fRltPEhZoLkfWfj04444JtTxB",
  "rootDir": "C:\\tmp\\gas"
}
```

**`C:\tmp\gas\appsscript.json`**：

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

---

## 改完程式碼如何部署

```powershell
cd C:\tmp\gas
clasp push --force; clasp deploy -i "AKfycbyKEIcvpKEeTG2iOdyEkIP93ofx1oCl4qLvs3WPvYw930uV8UY--xzYYR8Bgi1cRcol"
```

改完後也記得 push 到 GitHub：

```powershell
gh api repos/stevetai0314-dot/efficiency-calculator/contents/Code.gs ...（略）
```

---

## 檔案說明

| 檔案 | 說明 |
|------|------|
| `Code.gs` | GAS 後端。doGet 分派、讀取 Sheets、計算效率回傳 JSON |
| `report.html` | 效率報表前端，Bootstrap 5 + JSONP 呼叫 |

---

## Sheets 結構

### 參數類

| 分頁 | 用途 |
|------|------|
| `參數` | 員工清單（C=工號, D=姓名）、分條規格係數表（F欄起） |
| `焊接係數` | A=項目, B=規格, C=係數, D=點數 |
| `褙膠係數` | A=碼長, B=規格, C=係數 |
| `裁切參數` | A=工序, B=規格, C=碼長, D=顏色 |
| `開機台數備註` | A=日期, B=分條機台數, C=褙膠機台數, D=焊接機台數 |

### 記錄類

| 分頁 | 關鍵欄位 |
|------|---------|
| `分條記錄` | col 2=工號, 4=上班時數, 5=異常時數, 6=生產異常帶時數, 9=捲數, 11=效率換算 |
| `焊接記錄` | col 2=工號, 4=上班時數, 5=異常時數, 10=效率換算 |
| `褙膠記錄` | col 2=工號, 4=上班時數, 13=效率卷數(N), 14=加權工時(O) |
| `切勾記錄` | col 2=上班時數, 3=異常時數, 5=部門人數, 6=切勾數量 |
| `裁切記錄` | 多欄，含工序/規格/捲數/片長等 |

### 月報匯總類（歷史資料）

| 分頁 | 欄位格式 | 說明 |
|------|---------|------|
| `分條月報匯總` | A=年, B=月, C=捲數, D=效率捲數, E=加權工時 | 2026 年以前的月份 |
| `褙膠月報匯總` | A=年, B=月, C=卷數, D=效率卷數, E=加權工時 | 2026 年以前的月份 |
| `焊接月報匯總` | A=年, B=月, C=效率換算, D=加權工時 | 2026 年以前的月份 |

---

## 效率計算公式

| 工作站 | 效率公式 | 目標 | P（加權工時）計算 |
|--------|---------|------|-----------------|
| 分條 | O ÷ P ÷ 6.3 | 6.3 捲／時 | 上班時數 − 異常時數 − 生產異常帶時數 × 0.2，per empId+日期去重 |
| 褙膠 | N ÷ O ÷ 55 | 55 卷／時 | 直接讀褙膠記錄 col 14（O），per empId+日期去重 |
| 焊接 | C ÷ P ÷ 目標 | **TBD** | 上班時數 − 異常時數，per empId+日期去重 |

### 假日判斷邏輯（前端）

- 有資料 → 正常顯示
- 無資料 + 禮拜天 → 紅底（假日）
- 無資料 + 今天之前的工作日 → 紅底（假日）
- 今天或未來無資料 → 灰色（—）

---

## 裁切記錄欄位結構（A–Y）

| 欄 | Index | 來源 | 說明 |
|----|-------|------|------|
| A | 0 | GAS | 生產日期 |
| B | 1 | GAS | 儲存時間 |
| C | 2 | GAS | 工號 |
| D | 3 | GAS | 員工姓名 |
| E | 4 | GAS | 工序 |
| F | 5 | GAS | 開始時間 |
| G | 6 | GAS | 結束時間 |
| H | 7 | GAS | 訂單號 |
| I | 8 | GAS | 客戶名稱 |
| J | 9 | GAS | 規格 |
| K | 10 | GAS | 顏色 |
| L | 11 | GAS | 碼長 |
| M | 12 | GAS | 捲數 |
| N | 13 | GAS | 片長 |
| O | 14 | GAS | 片數 |
| P | 15 | GAS | 條數 |
| Q | 16 | GAS | 刀數 |
| R | 17 | GAS | 異常時數合計 |
| S | 18 | GAS | 異常原因 |
| T | 19 | GAS | 當日工作時數 |
| U | 20 | Sheet 公式 | 目標刀數/MIN（XLOOKUP 裁沖係數） |
| V | 21 | Sheet 公式 | 目標刀數/HR |
| W | 22 | Sheet 公式 | 品項有效時數 |
| X | 23 | Sheet 公式 | 當日有效時數（SUMIFS） |
| Y | 24 | Sheet 公式 | 效率（當日有效時數 ÷ 加權工時） |

### 裁切效率計算邏輯（GAS 報表用）

去重單位：`工號 + 日期`

```
加權工時 = col T(19) − col R(17)
有效時數 = col X(23)
當日效率 = Σ有效時數 / Σ加權工時
月份效率 = Σ有效時數 / Σ加權工時（同月所有天）
```

---

## 待辦

- [ ] **裁切報表**：更新 `getProcessReport_` 讀 col 0/2/17/19/23，依 empId+日期去重，算效率 = Σ有效時數/Σ加權工時
- [ ] **裁切報表**：`report.html` 新增裁切 tab（月報+日報，暫無目標值）
- [ ] 焊接效率目標（TBD）確認後改 `report.html` 裡的 `const TARGET_WELD = 0`
- [ ] 焊接月報匯總 Sheet 填入歷史資料
- [ ] 切勾效率報表（切勾記錄 Sheet 尚未建立）
