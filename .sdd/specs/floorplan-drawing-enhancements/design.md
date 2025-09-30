# 技術設計書

## アーキテクチャ概要
Next.js + React + TypeScriptで構築するフロントエンドPoCに、平面図編集用の状態管理コンテキストとKonvaキャンバスの描画ロジックを拡張して機能を統合する。テンプレート選択や補助線制御は既存の`FloorplanContext`（想定）にアクションを追加し、コンポーネントツリー内のサイドバーとキャンバスレンダラが共通の状態を参照する。描画ロジックはKonvaレイヤーを階層ごとに分離し、Three.jsなど他ビューとの同期は既存のビルドステップ（`useSyncedModel`フック等を想定）へイベントを発火して維持する。

## 主要コンポーネント
### コンポーネント1：TemplateSidebarSection
- 責務：サイドバー内に折りたたみ可能なテンプレート一覧を表示し、選択に応じて建物形状をFloorplanContextへ反映する。
- 入力：現在の階層ID、テンプレート定義一覧、セクション開閉状態。
- 出力：テンプレート適用アクション（`applyTemplate(templateId, floorId)`）。
- 依存関係：`FloorplanContext`のdispatcher、`useDisclosure`などのUIヘルパー、`TemplateCatalog`データモジュール。

### コンポーネント2：TemplateCatalog
- 責務：L字型・凹型・凸型テンプレートの頂点座標やメタ情報を提供する純粋関数モジュール。
- 入力：テンプレートID、基準寸法（オプション）、現在の階層のスケール設定。
- 出力：キャンバスへ適用可能な`FloorplanShape`（頂点配列、軒の出設定）。
- 依存関係：プロジェクト共通の`geometry`ユーティリティ（スケーリング、座標回転）。

### コンポーネント3：EaveLineRenderer
- 責務：各階層の軒の出ラインを階層カラーで描画し、角を辺の延長交点まで補正する描画ユーティリティ。
- 入力：階層カラー、外形ポリゴン、軒の出オフセット値。
- 出力：Konvaの`Line`ノード設定（座標、スタイル）。
- 依存関係：`computeExtendedCorners`などの幾何計算ヘルパー、Konva Layer。

### コンポーネント4：CanvasConstraintController
- 責務：直角モードやグリッドスナップを制御し、ドラッグ操作時に整列済みの座標を返すカスタムフック。
- 入力：直角モードON/OFF、グリッド間隔（100mm固定値）、現在編集中の頂点座標。
- 出力：補正済みの座標、Konvaイベントハンドラ。
- 依存関係：`FloorplanContext`の状態、`useKonvaEventHandlers`、`GridLayer`描画コンポーネント。

## データモデル
### FloorplanTemplate
- `id`: string、テンプレート識別子（e.g. `l-shape`）。
- `label`: string、UI表示用名称。
- `baseVertices`: `Point[]`、標準寸法でのポリゴン頂点（mm単位）。
- `defaultEave`: number、標準軒の出距離（mm）。
- `metadata`: `{ minWidth: number; minDepth: number; }`、寸法バリデーション。

### FloorplanShape
- `floorId`: string、適用先階層。
- `vertices`: `Point[]`、キャンバス表示用にスケールされた座標。
- `eave`: `EaveConfig`、軒の出ライン描画用設定。

### ConstraintState
- `rightAngleMode`: boolean、直角制約の有効状態。
- `gridEnabled`: boolean、グリッド表示・スナップの有効状態。
- `gridSpacing`: number、常に100を保持。

### Point
- `x`: number、キャンバスX座標。
- `y`: number、キャンバスY座標。

## 処理フロー
1. ユーザーがサイドバーのテンプレートセクションを開くと、`TemplateSidebarSection`が`TemplateCatalog`から一覧を取得し表示する。
2. テンプレート選択時に`applyTemplate`アクションを通じて選択中階層の`FloorplanShape`を再生成し、FloorplanContextへコミットする。
3. コンテキスト更新を受けて`EaveLineRenderer`が該当階層の軒の出ラインを再計算し、階層テーマカラーでKonva Layerへ描画する。
4. キャンバス上で頂点を編集する際は`CanvasConstraintController`がドラッグイベントを補正し、右角モード時はベクトルを直交化、グリッド有効時は100mm刻みへスナップする。
5. 編集結果はFloorplanContextへ反映され、3Dビューや図面出力モジュールに既存の同期イベントをトリガーする。

## エラーハンドリング
- テンプレート適用失敗：テンプレートデータが取得できない場合はトーストで「テンプレートを読み込めませんでした」と通知し、状態をロールバックする。
- 幾何計算エラー：軒ラインの交点計算でポリゴンが不正な場合はデフォルトの頂点終端を使用し、開発者コンソールに警告を出す。
- スナップ制御例外：Konvaイベントが未定義座標を返した場合はスナップをスキップし、ユーザー入力をそのまま適用する。

## 既存コードとの統合
- 変更が必要なファイル：
  - `src/context/FloorplanContext.ts`: テンプレート適用・制約状態のアクションとリデューサーを追加。
  - `src/components/sidebar/FloorSettingsPanel.tsx`: 新しい`TemplateSidebarSection`を差し込む。
  - `src/components/canvas/FloorplanCanvas.tsx`: `EaveLineRenderer`と`CanvasConstraintController`を利用して描画・インタラクションを更新。
- 新規作成ファイル：
  - `src/components/sidebar/TemplateSidebarSection.tsx`: テンプレート選択UIコンポーネント。
  - `src/modules/templates/TemplateCatalog.ts`: テンプレート定義と供給関数。
  - `src/modules/canvas/EaveLineRenderer.ts`: 軒の出ライン描画ユーティリティ。
  - `src/modules/canvas/CanvasConstraintController.ts`: 直角モード／グリッドスナップの制御ロジック。
