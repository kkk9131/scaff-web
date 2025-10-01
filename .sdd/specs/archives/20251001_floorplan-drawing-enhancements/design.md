# 技術設計書

## アーキテクチャ概要
BuildingProvider が保持する建物モデルに屋根設定と立面図表示オプションを拡張し、Sidebar 内の新セクションと ElevationViews の描画ロジックを通じて反映する。既存のクライアントサイド構成（Next.js + React + Tailwind）に従い、状態更新は reducer で集中管理し、副作用はローカルストレージ同期のみに留める。canvas/geometry モジュールの純粋関数を拡張し、描画層と数値入力層が疎結合を保ったまま要件を満たすように統合する。

## 主要コンポーネント
### コンポーネント1：Sidebar > RoofSection（新規）
- 責務：階層ごとの屋根タイプ・勾配・最高高さ・軒の出を設定し、BuildingProvider に状態変更アクションを発行する。
- 入力：`useBuildingState()` から取得する building state（activeFloor、floors、modes 等）。
- 出力：`dispatch` 経由で `updateRoof`, `updateFloorHeight`, `updateEaveOffset`（新規） などのアクションを送出。
- 依存関係：BuildingProvider の context、Tailwind UI コンポーネント、既存の sidebar アコーディオン管理。

### コンポーネント2：ElevationViews（既存拡張）
- 責務：立面データ生成結果に基づき SVG を描画し、軒ライン・寸法線・ラベル表示トグルを反映する。
- 入力：`buildElevationData` の結果（floors, roofLabel 等）、新たに追加する表示設定（eave overlays, dimensionVisibleElevation 等）。
- 出力：SVG 要素と寸法情報のラベルレンダリング。
- 依存関係：`utils/geometry` の計算関数、Tailwind/React。

### コンポーネント3：BuildingProvider / buildingReducer（既存拡張）
- 責務：屋根設定・軒の出・寸法表示トグルなど新しいアクションを処理し、モデル整合性を保つ。
- 入力：UI からのディスパッチアクション、ローカルストレージからの復元データ。
- 出力：拡張された BuildingModel と lastError。
- 依存関係：`modules/templates`, `modules/floorplan`, `utils/persistence`。

### コンポーネント4：utils/geometry（既存拡張）
- 責務：各立面に対して軒ライン・寸法線データを計算し、壁との重なりを判定して描画情報を返す。
- 入力：BuildingModel（floors、eave offsets、roof config、dimensionVisibleElevation）。
- 出力：立面単位の座標群、寸法ラベル、軒ライン座標、表示フラグ。
- 依存関係：純粋な数値ライブラリ（Math）、既存の boundingBox/normalize ロジック。

## データモデル
### BuildingModel（拡張）
- `floors[].roof`: `{ type: 'flat' | 'mono' | 'gable' | 'hip'; slopeValue: number; ridgeHeight?: number }` とし、最高高さ（ridgeHeight）を追加。
- `floors[].dimensions[*].offset`: number（既存）を軒の出として再利用し、屋根セクションから更新可能にする。
- `modes.dimensionVisibleElevation`: boolean（新規）—立面寸法表示トグル。
- `floors[].roof.eaveSegments` は保持せず、geometry 計算時に `dimensions[].offset` を利用。

### RoofSection UI Draft State（新規）
- `selectedRoofType: RoofType`
- `slopeValue: number`
- `ridgeHeight: number`
- `eaveOffsets: Record<edgeId, number>`（既存寸法と共有）

### ElevationViewModel（utils/geometry 内部構造拡張）
- `eaveLines: Array<{ start: Point; end: Point; visible: boolean }>`
- `heightDimensions: Array<{ start: Point; end: Point; label: string }>`
- `eaveDimensions: Array<{ start: Point; end: Point; label: string }>`
- `showDimensions: boolean`（modes から供給）

## 処理フロー
1. RoofSection で屋根タイプや勾配、最高高さ、軒の出を入力すると BuildingProvider にアクションが dispatch され、対象階層の `floor.roof` と `floor.dimensions[].offset` が更新される。dimensionVisibleElevation トグルも加入。
2. BuildingProvider が reducer で値検証・保存を行い、`saveBuildingModel` を通じてローカルストレージへ同期。エラー時は lastError を設定。
3. ElevationViews が `buildElevationData` を再実行し、立面ごとに基準輪郭・軒ライン・寸法線を計算。壁との重なりを判定して軒ラインをトリミング。
4. ElevationViews が `dimensionVisibleElevation` を参照し、寸法線やラベルの描画を切り替え。SVG へ点線・ラベル等を配置し、UI に即時反映。

## エラーハンドリング
- 入力検証エラー：`updateRoof`・`updateEdgeOffset` アクションで負値や非数値が渡された場合は reducer が lastError を設定し UI に通知（既存パターンに倣う）。
- ロック階層：`toggleFloorLock` が true の階層では屋根/軒編集アクションを無視し、警告メッセージを表示。
- 計算エラー：`buildElevationData` が無効モデルを検出した場合、fallback モデルと警告メッセージを返す。

## 既存コードとの統合
- 変更が必要なファイル：
  - `src/context/BuildingProvider.tsx`：BuildingModel 型拡張、reducer アクション追加、modes への elevation 用フラグ追加
  - `src/components/Sidebar.tsx`：屋根セクションのアコーディオン追加
  - `src/components/sidebar/`（新規/既存）`TemplateSidebarSection.tsx` 周辺：セクション配列と並び調整
  - `src/components/ElevationViews.tsx`：SVG 描画への軒ライン、寸法表示追加
  - `src/utils/geometry.ts`：立面データ計算に軒ライン・寸法値を含める処理追加
  - `src/components/DimensionPanel.tsx`（必要に応じて）：軒オフセット入力が屋根セクションへ移動する場合の整理
  - `src/utils/persistence.ts`：新しい modes/roof プロパティを保存・復元対象に含める
- 新規作成ファイル：
  - `src/components/sidebar/RoofSidebarSection.tsx`：屋根設定 UI
  - `src/modules/canvas/ElevationDimensionRenderer.ts`（必要なら）：立面寸法計算を切り出す
  - `src/components/__tests__/RoofSidebarSection.test.tsx`：屋根セクションのUIテスト
  - `src/utils/__tests__/geometry.elevation.test.ts`：軒ライン計算のユニットテスト
