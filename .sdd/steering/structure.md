# Project Structure

## ルートディレクトリ構成
```
/
├── src/                   # Next.jsアプリ本体
│   ├── app/               # App Routerのエントリ（layout.tsx, page.tsx, globals.css）
│   ├── components/        # UIコンポーネント群（平面/立面/3Dビュー、サイドパネル、ツールバー等）
│   │   └── __tests__/     # React Testing LibraryによるUIテスト
│   ├── context/           # BuildingProviderと状態管理、関連テスト
│   ├── modules/           # ドメインロジック（キャンバス描画、図面寸法、テンプレ定義など）
│   └── utils/             # 幾何計算・永続化ユーティリティとテスト
├── docs/                  # 要件定義・ロードマップドキュメント
├── .sdd/                  # SDD関連ファイル（description, specs, steering）
├── jest.config.ts         # Jest設定（next/jestベース）
├── jest.setup.ts          # テスト前準備（@testing-library/jest-dom）
├── tailwind.config.js     # Tailwind CSS設定
├── postcss.config.js      # PostCSS設定
├── tsconfig.json          # TypeScript設定
├── next.config.mjs        # Next.js設定
├── package.json           # 依存関係・npmスクリプト
└── README.md              # プロジェクト概要（簡易）
```

## コード構成パターン
- `BuildingProvider` が建物モデルのReducerとローカルストレージ同期を担当し、UIは `useBuildingState` フックを介して状態を取得・操作する
- UIコンポーネントは「ビュー（平面/立面/3D）」「サイドバーセクション」「ヘッダー/ツールバー」に分割し、プレゼンテーション要素と状態操作を明確に分離
- `modules/canvas`・`modules/templates`・`modules/floorplan` がテンプレート生成、寸法計算、軒線レンダリングなどのドメインロジックを保持し、`utils/geometry` が立面・3Dデータを生成
- `__tests__` ディレクトリでコンポーネント/フックの単体テストを管理し、React Testing Library + Jest でUI挙動を検証

## ファイル命名規則
- Reactコンポーネント：PascalCase（例：`EditorLayout.tsx`, `DimensionPanel.tsx`）
- フック/ユーティリティ/モジュール：camelCaseまたはlowercase＋Suffix（例：`persistence.ts`, `CanvasConstraintController.ts`）
- テスト：対象ファイルと同名＋`.test.ts` / `.test.tsx` を `__tests__` 配下に配置
- スタイル：グローバルスタイルは `src/app/globals.css` に集約し、Tailwindクラスで局所スタイルを指定

## 主要な設計原則
- 単一の建物モデル状態から平面・立面・3Dビュー、出力処理を生成し、ビュー間の一貫性を維持
- 幾何計算・テンプレ適用・寸法補正は副作用のない純粋関数へ切り出し、テスト可能性と再利用性を確保
- 編集補助機能（グリッド、直角補正、軒オフセット等）はトグル可能なモードとして実装し、作図体験を最適化
- ローカルストレージとJSONインポート／エクスポートで作業状態を保全し、PoC段階でも継続的な検証ができるように設計
