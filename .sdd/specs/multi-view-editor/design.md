# 技術設計書

## アーキテクチャ概要
Next.js (React + TypeScript) のアプリケーション内に、建物モデルを中心としたクライアントサイドアーキテクチャを構築する。React Context/Reducerで建物状態を一元管理し、Konvaベースの平面ビュー、SVG/Canvasベースの立面ビュー、Three.jsベースの3Dビューが同じ状態を購読して同期描画する。

## 主要コンポーネント
### コンポーネント1：`BuildingProvider`
- 責務：建物の階層・頂点・屋根設定などを保持するグローバルストアと更新ロジックを提供
- 入力：初期テンプレート選択イベント、サイドパネルの入力値、ビューからの頂点操作イベント
- 出力：建物モデル（階層、頂点座標、寸法、屋根設定）の最新状態をContext経由で下位コンポーネントへ提供
- 依存関係：React Context API、各種アクションハンドラ（`useBuildingActions`）

### コンポーネント2：`PlanViewCanvas`
- 責務：Konva.jsを利用して平面図ポリゴンを描画し、頂点編集UIを提供。建築図面ではなく線画（塗りなし）で輪郭を表現する。
- 入力：`BuildingProvider`からの階層選択状態・ポリゴン座標・描画設定（階層色、線種）
- 出力：頂点ドラッグ、追加、削除イベントをアクションとしてディスパッチ
- 依存関係：Konva.js、`useBuildingActions`

### コンポーネント3：`DimensionPanel`
- 責務：各辺寸法・境界距離・階層設定（高さ・屋根）などをフォームとして提供し、双方向同期を実現
- 入力：建物モデルの数値情報、選択中の階層
- 出力：寸法更新、階層追加・削除・複製、屋根タイプ変更などのアクション
- 依存関係：`BuildingProvider`、フォームバリデーションユーティリティ

### コンポーネント4：`ElevationViews`
- 責務：平面データから北・南・東・西の立面図を生成し寸法線と勾配表記を描画。図面は輪郭線のみで構成し塗りつぶしを行わない。
- 入力：建物モデル（特に階層高さ、屋根設定、ポリゴン投影）
- 出力：SVG/Canvas描画結果、必要に応じて警告（寸法計算失敗など）
- 依存関係：Edgeプロジェクションユーティリティ、寸法線生成ヘルパー

### コンポーネント5：`ThreeDView`
- 責務：Three.jsで建物の押し出しメッシュと屋根形状を描画し、視点操作を提供。線画風のエッジ抽出を用いて輪郭線のみを表示し、面の塗りつぶしは行わない。
- 入力：建物モデル（階層・高さ・屋根タイプ・勾配）
- 出力：3Dシーンのレンダリング、操作イベント（ズーム、パン）は内部で処理
- 依存関係：Three.js、`@react-three/fiber`、屋根メッシュ生成ユーティリティ

## データモデル
### BuildingModel
- `floors`: FloorModel[] — 階層ごとの設定を保持
- `activeFloorId`: string — 編集中の階層識別子
- `template`: TemplateType — 現在適用中のテンプレ形状

### FloorModel
- `id`: string — 階層ID
- `name`: string — 表示名
- `polygon`: Point[] — 頂点座標（{x: number, y: number}）の配列
- `dimensions`: EdgeDimension[] — 辺ごとの寸法・境界距離
- `height`: number — 階の高さ（mm）
- `roof`: RoofConfig — 屋根タイプと勾配情報
- `style`: FloorStyle — 線色などの描画設定

### EdgeDimension
- `edgeId`: string — 対象辺の識別子
- `length`: number — 辺長（mm）
- `offset`: number — 境界距離

### RoofConfig
- `type`: "flat" | "mono" | "gable" | "hip"
- `slopeValue`: number — 10/○形式での○（0.5刻み）

## 処理フロー
1. ユーザーがテンプレートを選択すると`BuildingProvider`が初期モデルを生成し、`PlanViewCanvas`が描画
2. 頂点操作または寸法入力が発生すると、アクションが`BuildingProvider`にディスパッチされ、ポリゴンと寸法が再計算される
3. モデル更新により`ElevationViews`と`ThreeDView`が再レンダリングされ、寸法線・屋根勾配・3Dメッシュが同期
4. 階層追加・複製で新しい`FloorModel`が生成され、スタイルと屋根設定を引き継ぐ
5. 必要に応じて出力機能が建物モデルを取得しSVG/PDF生成をトリガー

## エラーハンドリング
- 自己交差ポリゴン検出：頂点編集時にバリデーションし、エラー表示と操作取り消しで対処
- 寸法値の不整合：サイドパネル入力で数値範囲チェックを行い、無効値は保存せずエラーメッセージ表示
- 立面生成失敗：投影計算で異常が発生した場合は警告を表示し、再計算を促す
- 3Dメッシュ生成エラー：屋根タイプや勾配が無効な場合、fallbackでフラット屋根を描画しユーザーに通知

## 既存コードとの統合
- 変更が必要なファイル：
  - `README.md`（任意）：PoC機能進捗を記載する場合に更新
- 新規作成ファイル：
  - `src/context/BuildingProvider.tsx`：建物状態のContext/Reducer
  - `src/components/PlanViewCanvas.tsx`：Konvaベースの平面ビュー
  - `src/components/DimensionPanel.tsx`：寸法・階層設定フォーム
  - `src/components/ElevationViews.tsx`：立面図描画コンポーネント
  - `src/components/ThreeDView.tsx`：3Dビュー
  - `src/utils/geometry.ts`：ポリゴン処理、寸法計算、屋根生成などのヘルパー
