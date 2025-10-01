# 実装タスクリスト

## セクション1：データモデル実装
- [x] 1.1 BuildingModel拡張とバリデーション調整を実装する
  - `floors[].roof` に `ridgeHeight` を追加し、`modes.dimensionVisibleElevation` フラグを導入
  - buildingReducer / validateBuildingModel で新プロパティを検証し、屋根・軒更新アクションを追加
- [x] 1.2 永続化層をアップデートする
  - `saveBuildingModel` / `loadBuildingModel` で新しい roof/modes プロパティをシリアライズ・リストア
  - 互換性を保ちつつ既存ストレージを正規化する

## セクション2：ビジネスロジック実装
- [x] 2.1 RoofSectionハンドラのコア処理を実装する
  - 屋根タイプ・勾配・最高高さ・軒の出入力を `dispatch` へ接続（design.md 処理フロー1に対応）
  - 階層ロック時の制御とエラーメッセージ表示を組み込む
- [x] 2.2 Elevationデータ計算を拡張する
  - `buildElevationData` に軒ライン・高さ寸法・勾配ラベル計算を実装し、壁重なり判定を加える（処理フロー3-4対応）
  - 新しい表示フラグを反映してデータモデルを返す
- [x] 2.3 エラーハンドリングを補強する
  - reducer 内で不正入力時に `lastError` を設定し、UI が表示できるようにする（設計書エラーハンドリング参照）

## セクション3：インターフェース実装
- [x] 3.1 屋根設定UIコンポーネントを作成する
  - `RoofSidebarSection` を新規作成し、Sidebar に統合（コンポーネント1）
  - Tailwind でフォームUIと開閉制御を実装する
- [x] 3.2 Elevationビューを更新する
  - 軒ラインの点線描画、寸法線・ラベルの表示トグルを追加（コンポーネント2 + 処理フロー4）
  - 既存のSVGレイアウトに合わせたスタイル調整
- [x] 3.3 入力バリデーションとフィードバックを実装する
  - 屋根フォームの数値入力でエラー表示を行い、reducerのエラーと整合させる
  - 寸法表示トグルUIを追加し、状態反映を確認する

## セクション4：統合とテスト
- [x] 4.1 コンポーネントと状態を統合する
  - Sidebar, BuildingProvider, ElevationViews の接続を確認し、保存・復元まで動作させる
  - 必要に応じて DimensionPanel 等との役割整理
- [x] 4.2 テストを実装する
  - `RoofSidebarSection` のUIテスト、`buildElevationData` のユニットテスト、view 表示トグルのテストを追加
  - 既存テストの調整（スナップショット/期待値更新）
- [x] 4.3 受入基準を確認する
  - 要件定義書のチェックリストに沿って手動/自動で検証し、結果を記録する
