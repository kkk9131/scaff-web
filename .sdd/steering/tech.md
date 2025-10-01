# Technology Stack

## アーキテクチャ
Next.js (App Router) + React/TypeScript をベースにしたフロントエンド単体のPoC構成。全ての編集・計算ロジックをクライアント側に実装し、`BuildingProvider` がReducerベースで建物モデルを管理する。ローカルストレージに自動保存しつつ、Konva.jsで2D編集、独自ロジックで立面生成、Three.jsで3Dワイヤーフレーム描画を行う。サイドパネルや各種ツールバーを通じて状態を操作し、将来的なバックエンド連携や足場計算拡張に備えたモジュール分割を採用している。

## 使用技術
### 言語とフレームワーク
- TypeScript 5系：幾何計算や状態遷移を型安全に実装
- React 18 / Next.js 15：App Router構成とクライアントコンポーネントでインタラクティブUIを構築
- Tailwind CSS 3系：ダッシュボードUIとレスポンシブレイアウトを実現

### 依存関係
- 2D編集：`konva`, `react-konva` による平面図キャンバスと頂点/寸法レンダリング
- 3D表示：`three`, `@react-three/fiber`, `@react-three/drei` で階層押し出しワイヤーフレームを描画
- 出力機能：`html-to-image` でDOMキャプチャ、`jspdf`, `pdf-lib` でPDF生成
- UI/ユーティリティ：`lucide-react`（アイコン）、`@testing-library/*`, `jest`, `ts-jest`, `identity-obj-proxy` などのテスト・スタブ
- lint/ビルド：`eslint`, `eslint-config-next`, `typescript`, `@types/*`, `postcss`, `autoprefixer`

## 開発環境
### 必要なツール
- Node.js 18 以上（Next.js 15対応）
- npm（`package-lock.json` 管理）
- 推奨：VS Code + Tailwind/TypeScriptプラグイン、ブラウザ(Chrome/Safari)での動作確認

### よく使うコマンド
- 起動：`npm run dev`
- テスト：`npm run test`
- Lint：`npm run lint`
- ビルド：`npm run build`
- 本番起動：`npm run start`

## 環境変数
- 現時点で必須の環境変数は定義されていない（API連携機能はPoC対象外）
