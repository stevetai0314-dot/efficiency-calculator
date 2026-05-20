# 效率換算工具

員工班產效率換算紀錄系統。前端部署在 GitHub Pages，後端是 Google Apps Script，資料存在 Google Sheets。

**線上網址：** https://stevetai0314-dot.github.io/efficiency-calculator/

---

## 架構

```
GitHub Pages (index.html)
    ↕ JSONP GET         ← 抓員工清單（繞 CORS）
    ↕ fetch POST no-cors ← 存班產紀錄（不讀回傳）
Google Apps Script (Code.gs)
    ↕
Google Sheets (1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k)
```

**CORS 策略：**
- 員工清單（讀）→ JSONP：`?action=getEmployees&callback=_jsonp_xxx`
- 班產紀錄（寫）→ `fetch` + `mode: 'no-cors'`，送出後不讀回應

---

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 全部前端（CSS + JS 全 inline，無外部依賴） |
| `Code.gs` | GAS 後端（貼進 Google Apps Script 編輯器用） |

---

## Google Sheets 結構

**Spreadsheet ID：** `1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k`

| Sheet 名稱 | 用途 | 欄位 |
|---|---|---|
| `參數` | 員工清單 | C欄=工號, D欄=員工姓名 |
| `記錄` | 班產紀錄（自動建立） | 見下方 |

**「記錄」sheet 欄位（12欄）：**

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 生產日期 | 儲存時間 | 工號 | 員工姓名 | 上班時數 | 異常時數 | 生產異常帶時數 | 規格 | 碼長 | 捲數 | 係數 | 效率換算 |

> 「記錄」sheet 第一次儲存時會自動建立（含標題列）。如果 sheet 已存在且是舊的 9 欄版本，需手動在 D 欄後插入 3 欄：上班時數、異常時數、生產異常帶時數。

---

## GAS 部署資訊

**GAS 網址（已部署）：**
```
https://script.google.com/macros/s/AKfycbyKEIcvpKEeTG2iOdyEkIP93ofx1oCl4qLvs3WPvYw930uV8UY--xzYYR8Bgi1cRcol/exec
```

**部署設定：**
- 執行身份：我（擁有者）
- 存取權限：所有人（包含匿名）
- 每次改完 `Code.gs` 要重新部署 → 管理部署 → 編輯 → 選「新版本」→ 部署

---

## 操作流程

```
選生產日期（整個 session 固定，儲存後不重置）
    ↓
選員工（工號或姓名，任意位置模糊搜尋）
    ↓
填上班時數 / 異常時數 / 生產異常帶時數（每員工填一次）
    ↓
逐行輸入：規格（autocomplete）→ Tab → 碼長（下拉）→ 捲數 → Tab → 自動新增下一行
    ↓
按「儲存紀錄」→ 寫入 Sheets → 清空員工 + 明細 → 跳回選員工
```

---

## 前端關鍵常數（index.html）

**`LENGTHS`**（10 種碼長，順序固定，對應係數表索引）：
```
25M/YD, 50M/YD, PSĐB 25M/YD, 100M/YD, PSĐB 50M/YD, PSĐB 100M/YD,
大捲軸 cuộn lớn, 二次分條 PS lần 2 - SKY, 225M + 1 sợi, 225M
```

**`SPECS`**：130+ 規格代號 → 係數陣列，靜態內嵌，不需網路。

**`GAS_URL`**：GAS 部署網址，改版後需同步更新此常數。

---

## Git / GitHub

- Repo：`stevetai0314-dot/efficiency-calculator`（Public）
- Branch：`master`
- GitHub Pages 來源：`master` branch 根目錄
- Git 身份：`stevetai0314@gmail.com` / `stevetai0314-dot`

---

## 新增規格的方式

在 `index.html` 的 `SPECS` 物件新增一筆：

```javascript
'新規格代號': [25M係數, 50M係數, PSDB25係數, 100M係數, PSDB50係數, PSDB100係數, 大捲軸係數, 二次分條係數, 225M+1係數, 225M係數],
```

陣列順序必須對應 `LENGTHS` 的順序（共 10 個值）。

---

## 已知設計決策

- **去正規化儲存**：上班時數 / 異常時數 / 生產異常帶時數 每員工填一次，存入時重複帶入每一筆產量行（方便 Sheets SUMIF / 樞紐分析直接用）
- **時間戳用 GAS 生成**：前端不可信，用 `Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss')` 確保時區正確
- **員工清單即時抓取**：每次開頁面都向 GAS 請求，確保人員異動即時反映
- **POST 無回傳確認**：no-cors 模式無法讀回應，前端樂觀顯示成功訊息，約 3 秒後實際寫入 Sheets
