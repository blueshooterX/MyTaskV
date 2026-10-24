# Project Context: MyTask

## 1. 概要
- **名称**: MyTask
- **目的**: 個人利用向けの軽量なカンバンタスク管理ツール
- **プラットフォーム**: Google Apps Script (GAS) Web App
- **データベース**: Google スプレッドシート

## 2. 技術スタック
- **Backend**: Google Apps Script (Javascript V8)
- **Frontend**: HTML5, Vanilla CSS, Javascript (ES6+)
- **Libraries**: 
    - Sortable.js (ドラッグ＆ドロップ)
    - Material Icons (アイコン)
    - Google Fonts (Inter, Outfit)

## 3. 主要コンポーネントと責務
- **[AppConfig.js](file:///d:/Documents/01.Dev/antigravity/20.clasp/MyTask/AppConfig.js)**: 設定（SS ID、シート名、列インデックス、バージョン等）。
- **[TaskService.js](file:///d:/Documents/01.Dev/antigravity/20.clasp/MyTask/TaskService.js)**: スプレッドシートとのCRUD処理。Google Tasks からのインポート。
- **[RichTextLib.js](file:///d:/Documents/01.Dev/antigravity/20.clasp/MyTask/RichTextLib.js)**: エディタ(HTML)とセル(RichTextValue)の相互変換。
- **[js-kanban-view.html](file:///d:/Documents/01.Dev/antigravity/20.clasp/MyTask/js-kanban-view.html)**: カンバンボードの描画ロジック。
- **[js-rich-text-editor.html](file:///d:/Documents/01.Dev/antigravity/20.clasp/MyTask/js-rich-text-editor.html)**: カスタムリッチテキストエディタの制御。

## 4. 開発・デプロイ
- `clasp` による開発。
- `bundler.js` を使用して、複数ファイルを `dist/Code.gs` と `dist/index.html` に結合し、GAS環境へデプロイする構成。

## 5. 生成AI (kiro) への申し送り事項
- スプレッドシートのセルの装飾を維持するため、保存時の HTML -> RichTextValue 変換が非常に繊細です。`RichTextLib.js` の改修時には、文字インデックスのズレに最新の注意を払ってください。
- フロントエンドは React などのフレームワークを使用しない Vanilla 近い構成です。
- UIの名称（ステータスや優先度）は日本語ですが、内部的には `AppConfig.js` の `MAPPING` を介して英語キーで扱っています。
