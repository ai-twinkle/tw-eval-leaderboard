## 標題

簡短、命令式的摘要（例如："fix(robots): handle None in sensor parser"）。請參閱 [CONTRIBUTING.md](../CONTRIBUTING.md) 以了解 PR 慣例。

## 類型 / 範圍

- **類型**: (Bug | Feature | Docs | Performance | Test | CI | Chore)
- **範圍**: (選填 — 受影響的模組或套件名稱)

## 摘要 / 動機

- 一段描述變更內容和原因的文字。
- 為什麼需要此變更，以及任何權衡或設計註記。

## 相關議題

- 修復 / 關閉: # (如果有的話)
- 相關: # (如果有的話)

## 變更內容

- 簡短、具體的變更項目符號列表（檔案/行為）。
- 如果引入重大變更，請簡短註記遷移步驟。

## 如何測試（或如何在本機運行）

- 新增測試：列出新測試或測試檔案。
- 手動檢查 / 資料集運行已執行。
- 給審查者的指示

範例：

- 運行相關測試：

  ```bash
  npm run build
  ```

- 使用快速範例或 CLI 重現（如果適用）：

  ```bash
  npm run dev
  ```

## 檢查清單（合併前必須）

- [ ] 運行 Linting/formatting (`npm run lint && npm run format`)
- [ ] 專案建置成功 (`npm run build`)
- [ ] 文件已更新
- [ ] CI 通過

## 審查者註記

- 審查者應關注的任何事項（效能、邊緣情況、特定檔案）或一般註記。
- 社群中的任何人皆可自由審查此 PR。
