# 設計書: MyTask

## 1. システムアーキテクチャ

MyTaskはGoogle Apps Script (GAS)をバックエンドおよびWebホスティング環境として利用し、Googleスプレッドシートをデータベース(永続化層)として動作するSPA（Single Page Application）風のWebアプリケーションです。

```mermaid
graph TD
    User((ユーザー))
    subgraph Browser["ブラウザ (Frontend HTML/JS/CSS)"]
        UI[index.html]
        CSS[css.html (スタイリング)]
        Main[js-main.html (状態管理・初期化)]
        View[js-kanban-view.html (描画・D&D)]
        Editor[js-rich-text-editor.html (WYSIWYG)]
        Modal[js-task-modal.html (フォームUI)]
        Utils[js-ui-utils.html (共通処理)]
    end
    subgraph GAS["Google Apps Script (Backend)"]
        Code[Code.js (Webアプリ初期化/ルーティング)]
        TS[TaskService.js (CRUD・ビジネスロジック)]
        RT[RichTextLib.js (RichText↔︎HTML変換)]
        Config[AppConfig.js (定数定義)]
    end
    subgraph GoogleServices["Google サービス"]
        SS[(Google スプレッドシート)]
        TasksAPI[Google Tasks API]
    end

    User <--> Browser
    UI --- CSS
    UI --- Main
    UI --- View
    UI --- Editor
    UI --- Modal
    UI --- Utils
    Main -- "google.script.run" --> Code
    Code --> TS
    TS --> RT
    TS --> Config
    TS <--> SS
    TS <--> TasksAPI
```

## 2. データモデル (Google Sheets構成)

データベースとして機能するスプレッドシートは以下の構成を取ります。

### 2.1. TaskList (タスクデータシート)
| 列 | カラム | 特記事項・データ型 |
|:---|:---|:---|
| A | ID | システムによる一意の数値識別子（自動採番機能による） |
| B | 表示順 | 同一ステータス内における重み付け（カンバンの並び順、数値型） |
| C | タスクグループ | カテゴリ名。UI上でハッシュ値に応じた色でバッジ表示される。 |
| D | タスクタイトル | タスクの題名（プレーンテキスト） |
| E | タスク内容 | 詳細内容。内部的にはプレーンテキストにスタイル情報を付与した `RichTextValue` オブジェクトとして保持する。 |
| F | タスク期限 | 完了予定日（Date型またはISO文字リストフォーマット）。UIで期限切れ判定に利用。 |
| G | タスク優先度 | 「高」「中」「低」の文字列。これに基づきUI側でCSSクラスが付与される。 |
| H | ステータス | 「未着手」「実施中」「保留」「完了」の文字列。表示カラムの判定に使用。 |
| I | ラベル | タスク特有の絵文字アイコン状態（「★」「⭐」「⚠️」「💥」「🩷」）。デフォルトや未設定は空文字や「★」として解釈される。 |

### 2.2. AccessControl (アクセス管理シート)
| 列 | カラム | 特記事項・データ型 |
|:---|:---|:---|
| A | メールアドレス | アプリへのアクセスを許可するGoogleアカウントのメールアドレス。シートが存在しない場合は制御をバイパスする。 |

## 3. システムコンポーネント詳細・主要ロジック

### 3.1. Frontendレイヤー
フロントエンドは保守性を考慮し、機能ごとにHTMLファイルを分割・インクルード(`<?!= include('xxx'); ?>`)するアーキテクチャを採用しています。

- **状態管理 (`state`)**: `js-main.html` にて、取得したタスク一覧、フィルタ設定、ソート設定、表示トグル状態などのグローバルな画面状態（state）を一元管理します。非同期通信によるGoogle APIコールの起点となります。
- **カンバンビュー制御 (`js-kanban-view.html`)**:
  - `renderBoard()` にて、Stateを元にフィルタリングとソートを実行し、4つのステータスカラムへタスクカードDOMを分散配置します。
  - URLの自動変換（`getUrlIcon`）および、カードの完了・差し戻し操作時のCSSアニメーション処理を担います。
  - カスタム要素のクリックイベントのハンドリング（ラベル遷移トグル・完了チェックトグル）を行います。
  - `Sortable.js`を用い、ドラッグ＆ドロップ終了時のDOM順序から新しい「ステータス」と「表示順」を算出し、非同期にGASへ送信し（`updateOrderAndStatus`）永続化します。
- **リッチテキストエディタ (`js-rich-text-editor.html`)**:
  - `contenteditable` 属性を付与したDIVに依存し、`document.execCommand` を用いてスタイル編集を行います。
  - テキスト入力からのDOMツリーを自力で巡回（`walk`関数）して、テキスト本体とスタイル情報(bold, italic, color, underline, strikethrough等)およびブロック要素に応じた改行定義を反映した `runs` 配列データ構造を生成、バックエンドに渡します。
- **共通UIコンポーネント管理**: `js-ui-utils.html` によりカラーハッシュ変換やカラムリサイズ操作を提供します。\u0020

### 3.2. Backend (GAS) レイヤー
- **`Code.js`**: Webアプリケーションのエントリポイント。`doGet` 関数においてセッションメールアドレスより `checkAccess` を呼び出し認証を行い、適切であればHTMLテンプレートを結合し配信します。
- **`RichTextLib.js` (核心部)**: Google Sheets特有の書式付きテキスト形式とHTMLの架け橋。
  - `htmlToRichText`: Google Tasksなどから来る生HTMLなどを解析（タグごとの正規表現抽出と簡易スタック）し、スプレッドシートの `RichTextValueBuilder` を用いて `RichTextValue` へと変換します。
  - `buildRichTextFromData`: フロントエンドの `RichTextEditor.js` 専用。最適化された `runs` 配列から精密な `RichTextValue` を組み立てインデックスのズレない装飾保存を行います。
  - `richTextToHtml`: シートから取得した `RichTextValue` から `Runs` (同一書式の塊) を取り出し、`span` や `b` 等のピュアなHTML文字列へ復元しクライアントへ提供します。
- **`TaskService.js`**: データベース層（Sheet）との直接的なI/Oとビジネスロジック。
  - 全データのロード (`getData`)、タスク追加・更新 (`saveTask`)、削除コマンド等のCRUD操作を担当します。
  - 順序の一括更新 (`updateOrderAndStatus`) はトランザクション的動きをシミュレートし、UI描画後に発生したID群を一括書き込みします。
  - Google Tasksからの自動インポート機能 (`importFromGoogleTasks`) は Tasks API に直結し、既存タスクとのタイトル重複監視を行いながら未完了タスクを取得・統合します。
- **`AppConfig.js`**: アプリ内で使用されるSpreadsheet ID、各カラムインデックスやマッピング値などを定数(`CONFIG`)として保持します。
