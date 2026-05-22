# 效率換算工具

工廠員工班產效率換算紀錄系統，支援四個工作站。前端部署在 GitHub Pages，後端是 Google Apps Script，資料存在 Google Sheets。

---

## 頁面網址

| 頁面 | URL |
|---|---|
| 分條填報 | https://stevetai0314-dot.github.io/efficiency-calculator/ |
| 焊接填報 | https://stevetai0314-dot.github.io/efficiency-calculator/welding.html |
| 褙膠填報 | https://stevetai0314-dot.github.io/efficiency-calculator/backing.html |
| 切勾填報 | https://stevetai0314-dot.github.io/efficiency-calculator/cutting.html |
| 報表總表 | https://stevetai0314-dot.github.io/efficiency-calculator/report.html |

---

## 架構

```
GitHub Pages (HTML + JS)
    ↕ JSONP GET          ← 抓員工清單、係數表、報表資料（繞 CORS）
    ↕ fetch POST no-cors ← 存班產紀錄（不讀回傳）
Google Apps Script (Code.gs)
    ↕
Google Sheets
```

**GAS 網址：**
```
https://script.google.com/macros/s/AKfycbyKEIcvpKEeTG2iOdyEkIP93ofx1oCl4qLvs3WPvYw930uV8UY--xzYYR8Bgi1cRcol/exec
```

**Spreadsheet ID：** `1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k`

---

## Google Sheets 結構

| 分頁名稱 | 用途 | 說明 |
|---|---|---|
| `參數` | 員工清單 + 分條係數表 | C欄=工號, D欄=姓名；F欄起=規格係數表 |
| `焊接係數` | 焊接係數設定 | A=項目, B=規格分類, C=係數, D=點數（點數欄已不使用，前端手動輸入） |
| `褙膠係數` | 褙膠係數設定 | A=碼長, B=規格分類, C=係數 |
| `分條記錄` | 分條班產紀錄（自動建立） | 見下方欄位說明 |
| `焊接記錄` | 焊接班產紀錄（自動建立） | 見下方欄位說明 |
| `褙膠記錄` | 褙膠班產紀錄（自動建立） | 見下方欄位說明 |
| `切勾記錄` | 切勾班產紀錄（自動建立） | 見下方欄位說明 |

### 分條記錄欄位

| 生產日期 | 儲存時間 | 工號 | 員工姓名 | 上班時數 | 異常時數 | 生產異常帶時數 | 規格 | 碼長 | 捲數 | 係數 | 效率換算 | 異常原因 | 新人扣時% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### 焊接記錄欄位

| 生產日期 | 儲存時間 | 工號 | 員工姓名 | 上班時數 | 異常時數 | 項目 | 規格分類 | 係數 | 點數 | 效率點數 | 異常原因 | 新人扣時% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

### 褙膠記錄欄位

| 生產日期 | 儲存時間 | 工號 | 員工姓名 | 上班時數 | 異常時數 | 碼長 | 規格分類 | 係數 | 卷數 | 效率換算 | 異常原因 | 新人扣時% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

### 切勾記錄欄位

| 生產日期 | 儲存時間 | 上班時數 | 異常時數 | 異常原因 | 部門人數 | 切勾數量 |
|---|---|---|---|---|---|---|

---

## 各系統效率計算邏輯

| 系統 | 計算方式 |
|---|---|
| 分條 | 捲數 × 係數（係數依規格 + 碼長查表） |
| 焊接 | **人工輸入點數** × 係數（選項目 + 規格分類後自動帶係數，點數手動輸入） |
| 褙膠 | 卷數 × 係數（碼長 + 規格分類查表） |
| 切勾 | 直接記錄切勾數量（不計算效率，無員工欄位） |

---

## 填報流程

### 分條 / 焊接 / 褙膠

```
選生產日期
    ↓
選員工（工號或姓名，模糊搜尋）
    ↓
填上班時數 / 異常時數（+ 原因說明）/ 生產異常帶時數 / 新人扣時%
    ↓
逐行輸入產量
    焊接：選項目 → 選規格分類 → 自動帶係數 → 手動輸入點數 → Enter 跳下一行
    分條/褙膠：選規格 → 填數量 → Tab 跳下一行
    ↓
儲存紀錄 → 寫入 Sheets → 清空 → 跳回選員工
```

### 切勾

```
填生產日期 / 上班時數 / 異常時數 / 異常原因 / 部門人數 / 切勾數量
    ↓
儲存紀錄 → 寫入 Sheets → 清空欄位
```

---

## GAS 部署

**每次修改 Code.gs 後需重新部署：**

1. 開 Google Sheet → 擴充功能 → Apps Script
2. 貼上最新 Code.gs 全部內容 → Ctrl+S
3. 右上角「部署」→「管理部署」→ 選現有部署 → 編輯 → 版本選「建立新版本」→「部署」

**部署設定：**
- 執行身份：我（擁有者）
- 存取權限：所有人（包含匿名）

---

## 前端設定

| 常數 | 位置 | 說明 |
|---|---|---|
| `GAS_URL` | 各 HTML 頂部 | GAS 部署網址（部署 ID 更換時需同步改） |

**係數資料來源：動態從 GAS 載入**（不再硬寫在 HTML 裡）。員工清單、係數表每次開頁面重新抓取。

---

## 報表總表

`report.html` 三個 Tab（分條 / 焊接 / 褙膠），各 Tab 顯示：
- **年度月報長條圖**（Chart.js 4.x），當月柱子顏色加深
- **當月日報表格**：每日效率合計 + 出勤人數

資料來源：GAS `?action=getReport&system=slitting|welding|backing`，時區 `Asia/Ho_Chi_Minh`（越南）。

---

## 設計決策

- **去正規化儲存**：工時欄位每員工填一次，存入時每筆產量行都帶入，方便 Sheets SUMIF / 樞紐分析直接用
- **時間戳 GAS 生成**：用 `Utilities.formatDate(new Date(), 'Asia/Taipei', ...)` 確保時區可控
- **POST 無回傳確認**：no-cors 模式無法讀回應，前端樂觀顯示成功，約 3 秒後實際寫入
- **新欄位加在末尾**：異常原因 / 新人扣時% 加在效率換算後面，避免改動 GAS getReport 的欄位索引
- **係數 0 視為空值**：部分規格特定碼長無係數，GAS 存 0，前端顯示「—」
- **焊接點數手動輸入**：係數表 D 欄（點數）保留但前端不使用，點數改由使用者當天實際輸入

---

## Git / GitHub

- Repo：`stevetai0314-dot/efficiency-calculator`（Public）
- Branch：`master`（GitHub Pages 來源）
- 主題：Bootswatch Flatly（Bootstrap 5）
