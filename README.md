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

| 工作站 | 效率公式 | 目標 |
|--------|---------|------|
| 分條 | 效率捲／時 ÷ 6.3 | 6.3 捲／時 |
| 褙膠 | 效率卷／時 ÷ 55 | 55 卷／時 |
| 焊接 | 效率換算／時 ÷ 545 | 545 換算／時 |
| 切勾 | 月/日總數量（無效率目標） | — |
| 裁片 | 實際生產時數 ÷ 上班時數 | — |

### 假日判斷邏輯（前端）

- 有資料 → 正常顯示
- 無資料 + 禮拜天 → 紅底（假日）
- 無資料 + 今天之前的工作日 → 紅底（假日）
- 今天或未來無資料 → 灰色（—）

---

## 報表欄位抓取邏輯（Code.gs）

### 分條（`getSlittingReport_`）

讀取 Sheet：**`分條記錄`** + **`分條月報匯總`**（2026 年前歷史）

| 欄位 index | 欄位名稱 | 用途 |
|-----------|---------|------|
| 0 | 生產日期 | 分月/分日依據（yyyy/MM/dd） |
| 2 | 工號 | 判斷每日人頭數（empId 去重） |
| 4 | 上班時數 | 計算加權工時 P |
| 5 | 異常時數 | 計算加權工時 P |
| 6 | 生產異常帶時數 | 計算加權工時 P（× 0.2） |
| 9 | 捲數 | 庫存參考（J） |
| 10 | 係數 | 每捲換算係數 |
| 11 | 效率換算 | 效率捲數（O = 捲數 × 係數） |

加權工時公式：`P = 上班時數 − 異常時數 − 生產異常帶時數 × 0.2`

---

### 焊接（`getWeldingReport_`）

讀取 Sheet：**`焊接記錄`** + **`焊接月報匯總`**（2026 年前歷史）

| 欄位 index | 欄位名稱 | 用途 |
|-----------|---------|------|
| 0 | 生產日期 | 分月/分日依據 |
| 2 | 工號 | 人頭去重 |
| 4 | 上班時數 | 計算加權工時 P |
| 5 | 異常時數 | 計算加權工時 P |
| 10 | 效率換算 | 效率點數（C） |

加權工時公式：`P = 上班時數 − 異常時數`

效率%：`C ÷ P ÷ 545`

---

### 褙膠（`getBackingReport_`）

讀取 Sheet：**`褙膠記錄`** + **`褙膠月報匯總`**（2026 年前歷史）

| 欄位 index | 欄位名稱 | 用途 |
|-----------|---------|------|
| 0 | 生產日期 | 分月/分日依據 |
| 2 | 工號 | 人頭去重 |
| 13 | 效率卷數（N） | 直接讀 |
| 14 | 加權工時（O） | 直接讀 |

效率%：`N ÷ O ÷ 55`

---

### 切勾（`getCuttingReport_`）

讀取 Sheet：**`切勾記錄`**（目前尚待 cutting.html 上線後才有資料）

| 欄位 index | 欄位名稱 | 用途 |
|-----------|---------|------|
| 0 | 生產日期 | 分月/分日依據 |
| 1 | 切勾數量 | 月/日加總 |

> ⚠️ cutting.html 建立時，Sheet 欄位順序必須照此設計，否則要改 Code.gs。

---

### 裁片（`getProcessReport_`）

讀取 Sheet：**`裁切記錄`**（目前尚待 process.html 上線後才有資料）

| 欄位 index | 欄位名稱 | 用途 |
|-----------|---------|------|
| 0 | 生產日期 | 分月/分日依據 |
| 1 | 開始時間（HH:MM） | 計算生產時數 |
| 2 | 結束時間（HH:MM） | 計算生產時數 |
| 3 | 上班時數 | 計算工時利用率分母 |

工時利用率公式：`Σ(結束-開始) ÷ Σ上班時數`

> ⚠️ process.html 建立時，Sheet 欄位順序必須照此設計，否則要改 Code.gs。

---

## 待辦

- [x] 焊接效率目標設為 545（`const TARGET_WELD = 545`）
- [x] 切勾報表 Tab 加入 report.html
- [x] 裁片工時利用率 Tab 加入 report.html
- [ ] 建立 `cutting.html`（切勾填報頁面），Sheet 欄位照上表設計
- [ ] 建立 `process.html`（裁切填報頁面），Sheet 欄位照上表設計
- [ ] 焊接月報匯總 Sheet 建立並填入歷史資料
- [ ] 開機台數備註 加 D 欄（焊接機台數）
