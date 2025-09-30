# 実装タスクリスト

## セクション1：データモデル実装
- [x] 1.1 必要な型定義・データ構造を作成する
  - FloorPlanState/Edge/Vertex/TemplateDefinition/EaveOverlayの型定義
  - validatePolygon・offsetPolygon前提のバリデーションルール実装
- [x] 1.2 データ永続化層を実装する
  - FloorPlanStoreの状態更新ロジックをリデューサへ反映
  - 直角・グリッド・軒の出モードの状態保持（暫定的にローカルストアのみ）

## セクション2：ビジネスロジック実装
- [x] 2.1 TemplateSelectorPanelのコア処理を実装する
  - テンプレート選択時にupdateFromTemplateで頂点・辺を再構成
  - 自己交差チェックと失敗時の通知実装
- [x] 2.2 PolygonEditorCanvasの処理を実装する
  - 頂点追加・削除・移動と直角/グリッドスナップの適用
  - 軒の出表示用のKonva点線レイヤー描画ロジック
- [x] 2.3 エラーハンドリングを実装する
  - テンプレート適用・軒の出計算・階層ロック時の操作拒否処理

## セクション3：インターフェース実装
- [x] 3.1 UIコンポーネントを作成する
  - TemplateSelectorPanel/EdgePropertiesSidebar/DrawingSupportToolbarのUI構築
- [x] 3.2 入力バリデーションを実装する
  - 軒の出オフセット入力の0mm以上チェックとエラー表示
  - 階層ロックON時のUI制御
- [x] 3.3 出力フォーマットを実装する
  - サイドバー寸法表示とキャンバスハイライトの同期表示
  - 点線描画のスタイル統一とThree.js側への差分通知

## セクション4：統合とテスト
- [x] 4.1 コンポーネントを統合する
  - FloorPlanEditorで新規コンポーネントとストアアクションを接続
  - 既存寸法同期ロジックとの連携確認
- [x] 4.2 基本的な動作テストを実装する
  - FloorPlanStoreリデューサのユニットテスト
  - geometry/eaveOffsetユーティリティの計算テスト
- [x] 4.3 要件の受入基準を満たすことを確認する
  - テンプレート切替/頂点編集/軒の出/モード切替が要件条件を満たすことを手動または自動で確認
