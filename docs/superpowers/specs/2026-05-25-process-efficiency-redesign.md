# 裁片效率值重設計

**日期：** 2026-05-25  
**狀態：** 待實作

## 問題

`getProcessReport` 目前以「開始/結束時間差 ÷ 上班時數」計算工時利用率，無法反映真實的裁切生產效率。Sheets 中已有公式欄 X（有效時數）和 Z（裁切工時），應直接使用這兩欄計算效率。

## 目標

每日效率 = 同日所有記錄的 X 欄加總 ÷ 同日所有記錄的 Z 欄加總  
月效率 = 整月所有記錄的 X 欄加總 ÷ 整月所有記錄的 Z 欄加總

無目標值基準，暫時不套用三色標示。

## 後端（Code.gs）

### getProcessReport 修改

**讀取欄位：**
- 欄 0（index 0）：生產日期
- 欄 X（index 23）：有效時數（Sheets 公式欄）
- 欄 Z（index 25）：裁切工時（Sheets 公式欄）

**日報計算：**
1. 將所有資料列依日期分組
2. 每個日期：sumX = 所有 X 欄值加總，sumZ = 所有 Z 欄值加總
3. 日效率 = sumX / sumZ
4. 若 sumZ = 0，效率回傳 `null`（前端顯示 `"-"`）

**月報計算：**
1. 取目前月份的所有記錄
2. monthSumX = 全月 X 欄加總，monthSumZ = 全月 Z 欄加總
3. 月效率 = monthSumX / monthSumZ
4. 若 monthSumZ = 0，效率回傳 `null`

**回傳格式（不變）：**
```json
{
  "monthly": [{ "month": "2026-05", "utilization": 0.853, "totalEffHours": 12.5, "totalCutHours": 14.6 }],
  "daily":   [{ "date": "2026-05-25", "utilization": 0.871 }]
}
```
> `utilization` 為小數（如 0.853），前端自行乘 100 顯示為百分比。

## 前端（report.html）

### 裁片分頁修改

- 移除舊的工時利用率顯示邏輯（start/end time 計算）
- 日報與月報的效率欄改顯示新 `utilization` 值，格式：`85.3%`
- `null` 值顯示為 `-`
- 不加三色標示（eff-high / eff-mid / eff-low class）

## 範圍外

- 其他工站（分條、褙膠、焊接、切勾）不受影響
- 三色效率門檻暫不設定，待後續需求確認
