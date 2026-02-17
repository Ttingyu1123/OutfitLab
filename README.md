# OutfitLab

React + Vite 專案，支援本機開發與 GitHub Actions 自動部署到 GitHub Pages。

## 環境需求

- Node.js 20+
- npm 10+

## 本機開發

1. 安裝套件
```bash
npm install
```

2. 設定環境變數（本機）

建立 `.env.local`：
```bash
GEMINI_API_KEY=your_key_here
```

3. 啟動開發伺服器
```bash
npm run dev
```

4. 型別檢查與建置
```bash
npm run typecheck
npm run build
```

## GitHub Actions 自動部署

已新增 workflow：`.github/workflows/deploy-pages.yml`

部署觸發條件：
- push 到 `main`
- 手動執行 (`workflow_dispatch`)

部署目標：GitHub Pages

### 你需要在 GitHub Repo 設定

1. 進入 `Settings > Pages`
2. `Source` 選擇 `GitHub Actions`
3. 推送到 `main` 後，Actions 會自動建置並部署

## .gitignore 規則

已加入常見忽略項目，避免提交不必要或敏感資料：
- `node_modules/`, `dist/`, `coverage/`, 暫存資料夾
- `.env`, `.env.*`（保留 `!.env.example`）
- 編輯器/系統暫存檔（如 `.DS_Store`, `Thumbs.db`）

注意：若敏感檔案曾被追蹤，請先移除追蹤再提交：
```bash
git rm --cached .env.local
```

## BYOK (Gemini API Key)

This project now uses a client-side BYOK flow.

1. Open the app with `npm run dev`.
2. Paste your Gemini API key in the API Key modal (`AIza...`).
3. The key is stored only in browser `localStorage` (`gemini_api_key`).
4. If model calls return `401/403`, the app clears the stored key and asks you to reconnect.
5. You can click `Test key` in the modal to validate the key before saving.
6. After entering the app, use the key icon next to the Home icon (top-right) to view key status and manage the key.

Notes:
- Do not commit API keys into `.env`, source code, or server logs.
- All Gemini model calls now receive `apiKey` from UI state, not from `process.env`.
