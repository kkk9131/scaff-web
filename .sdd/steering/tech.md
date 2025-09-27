# Technology Stack

## アーキテクチャ
Next.js (React + TypeScript) をベースにしたフロントエンド単体のPoC構成。ブラウザ上で2D/3Dの編集ロジックを実装し、将来的なバックエンド連携前提でクライアント側に建物モデルの状態を保持する。

## 使用技術
### 言語とフレームワーク
- TypeScript：インタラクティブなUIと幾何計算を型安全に実装
- React / Next.js：コンポーネント駆動のUIとページルーティング

### 依存関係
- Konva.js：平面図キャンバスと頂点編集のための2D描画ライブラリ
- Tailwind CSS：レスポンシブ対応とUIスタイリング
- Three.js / @react-three/fiber：建物外形の3D表示と屋根形状の表現
- html-to-image / dom-to-image：キャンバスやビューの画像出力
- jsPDF / pdf-lib：PDF図面生成

## 開発環境
### 必要なツール
- Node.js（Next.js開発・ビルドに必要）
- npm / pnpm などのパッケージマネージャ
- Vercel CLI（ホスティングとデプロイ検証用、必要に応じて）

### よく使うコマンド
- 起動：`npm run dev`（Next.jsプロジェクトセットアップ後に利用想定）
- テスト：未定（テスト環境はPoC段階でこれから整備）
- ビルド：`npm run build` → `npm run start`（Vercelデプロイ前提の想定フロー）

## 環境変数
- 現時点で必須の環境変数は定義されていない（API連携機能はPoC対象外）
