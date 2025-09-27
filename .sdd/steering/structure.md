# Project Structure

## ルートディレクトリ構成
```
/
├── README.md           # プロジェクト概要（暫定）
├── docs/               # 要件定義とロードマップドキュメント
│   ├── requirements.md
│   └── roadmap_checklist.md
├── .sdd/               # SDD関連ファイル
│   ├── description.md
│   ├── specs/
│   └── steering/
└── .git/               # Gitリポジトリメタデータ
```

## コード構成パターン
アプリケーションコードはまだ作成されていない。Next.js (TypeScript) ベースで `app/` または `pages/`, `components/`, `hooks/`, `utils/`, `types/` を分離する構成をロードマップで計画している。

## ファイル命名規則
- Markdownドキュメント：用途に応じた英字のkebab-case（例：`roadmap_checklist.md`）
- 将来のソースコード：Next.js標準に従い、コンポーネント名はPascalCase、フックは`use`プレフィックスのcamelCaseを想定

## 主要な設計原則
- インタラクティブな図面編集と数値入力を単一の状態管理（React Context）で同期
- 平面・立面・3D表示を同一建物モデルから生成し、ビュー間で常に一貫性を保つ
- PC/タブレットを対象にしたレスポンシブUIとブラウザ完結型の操作性
- PoC段階ではオフライン/バックエンド依存を持たず、クライアントのみで完結
