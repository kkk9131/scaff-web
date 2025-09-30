# 技術設計書

## アーキテクチャ概要
Next.js/Reactの既存平面図エディタに、テンプレート切替・頂点編集・軒の出制御・作図支援モードを追加する。状態は`FloorPlanStore`（React Context）で一元管理し、Konva.jsキャンバスとサイドバーUIは同じ状態をサブスクライブして相互同期する。モード切替や軒の出点線描画はKonvaレイヤーの追加とユーティリティ関数で構成し、Three.js側の立面・3D生成は既存の頂点配列を再利用して変更差分のみ反映する。

## 主要コンポーネント
### コンポーネント1：TemplateSelectorPanel
- 責務：L字型・凹型・凸型などのテンプレートを選択し、`FloorPlanStore`に初期化データを流し込む。
- 入力：現在の頂点列、利用可能テンプレート定義、選択イベント。
- 出力：新しい頂点配列とエッジ情報を`updateFromTemplate`アクションとしてDispatch。
- 依存関係：`FloorPlanStore`のdispatch、`polygonTemplates`ユーティリティ、Konvaキャンバス再レンダリング。

### コンポーネント2：PolygonEditorCanvas
- 責務：Konva.js上で頂点追加・削除・移動、直角・グリッドスナップ、軒の出点線表示を担う。
- 入力：`FloorPlanStore`の頂点・エッジ状態、モードフラグ（直角・グリッド）、選択中の辺ID。
- 出力：頂点/辺更新アクション、選択イベント、軒の出図形のKonvaレイヤー。
- 依存関係：Konvaステージ、`useSnapToRightAngle`・`useGridSnap`カスタムフック、`offsetPolygon`ジオメトリ関数。

### コンポーネント3：EdgePropertiesSidebar
- 責務：辺リスト表示・選択、軒の出オフセット編集、階層ロック切り替えを提供する。
- 入力：`FloorPlanStore`の辺情報、選択状態、階層ロック情報。
- 出力：`selectEdge`、`updateEaveOffset`、`toggleLayerLock`アクション。
- 依存関係：`FloorPlanStore`のdispatch、`measurementFormatter`ユーティリティ、UI用Tailwindスタイル。

### コンポーネント4：DrawingSupportToolbar
- 責務：直角モード・グリッド表示・軒の出一括生成などの操作ボタンをまとめる。
- 入力：現在のモードフラグ、軒の出初期値、階層ロック状態。
- 出力：`setRightAngleMode`、`setGridVisible`、`generateUniformEaves`などのアクション。
- 依存関係：`FloorPlanStore`のdispatch、`PolygonEditorCanvas`モードプロップ。

## データモデル
### FloorPlanState
- `vertices: Vertex[]`：各頂点の座標 `{ id: string; x: number; y: number; }`。
- `edges: Edge[]`：頂点参照と属性 `{ id: string; startId: string; endId: string; eaveOffset: number; locked: boolean; }`。
- `selectedEdgeId: string | null`：現在サイドバーで選択中の辺。
- `activeTemplate: TemplateId | null`：最後に適用したテンプレート。
- `modes: { rightAngle: boolean; gridSnap: boolean; gridVisible: boolean; }`：作図支援モード。
- `layers: LayerState[]`：階層情報 `{ id: string; name: string; locked: boolean; }`。
- `meta: { updatedAt: number; isDirty: boolean; }`：描画状態メタデータ。

### TemplateDefinition
- `id: TemplateId`：テンプレート識別子。
- `vertices: Coordinate[]`：標準化された頂点配列。
- `label: string`：UI表示名。
- `description?: string`：テンプレート概要。

### EaveOverlay
- `edgeId: string`：参照する辺。
- `path: Coordinate[]`：500mm基準オフセット後の点線座標。
- `offset: number`：現在のオフセット値（mm）。

## 処理フロー
1. ユーザーがTemplateSelectorPanelでテンプレートを選択すると、`updateFromTemplate`が発火し、`FloorPlanState`の`vertices`と`edges`をテンプレート定義で置換する。
2. キャンバス上で頂点追加・削除を行うと、PolygonEditorCanvasが`addVertex`/`removeVertex`アクションをdispatchし、頂点配列とエッジの連結が更新され、サイドバーは新しいリストを再取得する。
3. サイドバーで辺を選択すると`selectedEdgeId`が更新され、PolygonEditorCanvasは該当辺をハイライトし、軒の出点線を強調表示する。
4. 「軒の出」ボタンを押すと`generateUniformEaves(500)`が呼ばれ、各辺の`eaveOffset`を500に設定し、`offsetPolygon`で生成した点線をKonvaレイヤーへ描画する。
5. EdgePropertiesSidebarでオフセット値を編集すると`updateEaveOffset`が発火し、該当辺の点線が即座に再計算される。直角モード・グリッドモード切替は`modes`を更新し、PolygonEditorCanvasがスナップ計算を切り替える。

## エラーハンドリング
- エラーケース1：テンプレート適用で自己交差が発生した場合は`validatePolygon`で検出し、Toastで「テンプレートが無効です」と通知し復旧する。
- エラーケース2：軒の出オフセット計算が失敗（負値や頂点数不足）した場合は入力を拒否し、サイドバーでエラー表示を行う。
- エラーケース3：階層ロック中の操作が試みられた場合は操作を無視し、UIにロックアイコンとツールチップで理由を示す。

## 既存コードとの統合
- 変更が必要なファイル：
  - `src/state/floorPlanStore.ts`：テンプレート更新・辺選択・モード管理・軒の出計算を扱うアクションとリデューサを追加。
  - `src/features/floor-plan/components/FloorPlanEditor.tsx`：新しいテンプレートパネル、エッジサイドバー、支援ツールバーを組み込み、コンテキストを渡す。
  - `src/features/floor-plan/utils/geometry.ts`：`offsetPolygon`や`validatePolygon`などのジオメトリ関数を拡張。
- 新規作成ファイル：
  - `src/features/floor-plan/components/TemplateSelectorPanel.tsx`：テンプレート選択UI。
  - `src/features/floor-plan/components/EdgePropertiesSidebar.tsx`：辺情報と軒の出設定UI。
  - `src/features/floor-plan/components/DrawingSupportToolbar.tsx`：直角/グリッド/ロック操作UI。
  - `src/features/floor-plan/hooks/useSnapToRightAngle.ts`：直角制約ロジック。
  - `src/features/floor-plan/hooks/useGridSnap.ts`：グリッドスナップ処理。
  - `src/features/floor-plan/utils/eaveOffset.ts`：辺ごとの軒の出計算とKonvaパス生成ユーティリティ。
