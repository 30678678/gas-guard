# gas-guard

用一個指令完成 GAS 專案的建立、AI 規則注入、和批量管理。

## 背景

我在飯店當 IT，用 Google Apps Script 寫了不少內部自動化（日報、報修、跨部門需求之類的）。後來開始用 Cursor 和 Cline 這些 AI 助手寫 code，發現一個問題：每個專案都要手動設定 `.cursorrules`、調 `.clasp.json`、建 `src/` 資料夾、補 `.gitignore`⋯⋯ 重複做很煩，而且容易漏。

所以寫了這個工具，把這些事情自動化。

## 功能

**建立 / 同步專案**
- `clasp create` 或 `clasp clone` + 自動建立 `src/` 目錄結構 + 設定 `.clasp.json` 的 `rootDir` + Git 初始化，一次搞定

**AI 規則注入**
- 同時寫入 `.cursorrules` 和 `.clinerules`，讓不同 AI 助手都吃同一套規則
- 可以注入單一專案，也可以掃描整個目錄批量注入
- 內建三套模板，也可以自己寫 Markdown 規則

**稽核儀表板**
- 列出目錄下所有 GAS 專案，顯示哪些有設規則、哪些沒有
- 可以預覽每個專案目前的規則內容
- 一鍵幫沒設規則的專案補上

**其他**
- 啟動時檢查 `clasp` 和 `git` 有沒有裝好，缺什麼告訴你
- `.gitignore` 自動補上 `creds.json`、`.clasp.json` 等不該進 repo 的東西

## 三套內建模板

| 模板 | 什麼時候用 | 重點 |
|---|---|---|
| **Hybrid** | 一般開發 | 要求 AI 先規劃再寫 code，注意成本 |
| **Architect** | 比較重要的功能 | 要求 AI 主動挑戰需求、找風險 |
| **Cost Saver** | 省錢 | 強制用便宜的模型，禁止讀不相關的檔案 |

三套都有一個共同規則：**AI 不能直接開始寫 code，必須先提交計畫等你確認。** 這是因為讓 AI 先想清楚再動手，比事後改一堆 bug 划算。

## 使用

需要先裝好 Node.js、Git。

```bash
git clone https://github.com/dawish39/gas-guard.git
cd gas-guard
node gas-init.js
```

啟動後是互動式選單：

```
🚀 GAS 專案治理工具 | Professional Edition (SOP 6.1)
====================================================
📝 目前 AI 規則來源: ⚖️  全能混合模式 (Hybrid - 推薦)
====================================================

❓ 請選擇功能:
  [1] 🆕 建立新專案
  [2] 📡 同步雲端專案
  [3] 💉 單一專案注入
  [4] 🔍 批量掃描並注入
  [5] 🛡️ 專案稽核儀表板
  [6] ⚙️ 設定規則來源
  [q] 離開
```

## 自訂規則

兩種方式：

1. 在 `templates/` 資料夾放 `.md` 檔案，啟動時會自動載入。第一行 `# 標題` 會當作選單顯示名稱。
2. 在工具裡選「匯出模板」，會生成 `my-rules.md`，改完再載入。

沒有 `templates/` 資料夾也能跑，會用內建模板。

## 檔案結構

```
gas-guard/
├── gas-init.js          # 主程式
├── templates/           # 規則模板
│   ├── hybrid.md
│   ├── architect.md
│   └── cost_saver.md
└── README.md
```

## License

MIT
