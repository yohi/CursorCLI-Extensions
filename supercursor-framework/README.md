# SuperCursor Framework

A comprehensive extension framework for Cursor CLI with specialized commands, AI personas, and enhanced development workflows.

## 概要

SuperCursor Frameworkは、Cursor CLIを拡張し、特化されたコマンド、AIペルソナ、拡張された開発ワークフローを提供する包括的なフレームワークです。開発者が日常の開発タスクをより効率的に実行できるようにします。

## 主要機能

- **専用スラッシュコマンド**: 開発タスクに特化したコマンドセット
- **AIペルソナ**: コンテキストに応じて自動的に切り替わる専門家AI
- **プロジェクト分析**: コードベースの構造とパターンの深い理解
- **自動化ワークフロー**: CI/CD統合とタスク自動化
- **セキュアな設定管理**: 細かな権限制御と設定管理

## インストール

```bash
npm install -g supercursor-framework
```

## 使用方法

### 基本コマンド

```bash
# 機能実装
/sc:implement [feature description]

# コード分析
/sc:analyze [target]

# ビルド設定
/sc:build [component]

# システム設計
/sc:design [system]

# テスト生成
/sc:test [component]

# ドキュメント作成
/sc:document [target]
```

### AIペルソナ

フレームワークは以下のペルソナを自動的に選択します：

- **Backend Architect**: API設計とサーバーサイド開発
- **Frontend Expert**: UI/UX最適化とフロントエンド開発
- **DevOps Engineer**: インフラとデプロイメント自動化
- **Security Specialist**: セキュリティ脆弱性検出と修正
- **Performance Expert**: パフォーマンス最適化
- **QA Engineer**: テスト戦略と品質保証

## 開発

### 環境セットアップ

```bash
# 依存関係のインストール
npm install

# 開発モード
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# リンティング
npm run lint
```

### プロジェクト構造

```
src/
├── core/          # フレームワークのコア機能
├── commands/      # コマンドプロセッサー
├── personas/      # AIペルソナ実装
├── integrations/  # 外部サービス統合
├── types/         # TypeScript型定義
└── utils/         # ユーティリティ関数

tests/
├── unit/          # ユニットテスト
├── integration/   # 統合テスト
└── e2e/          # エンドツーエンドテスト
```

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 貢献

プロジェクトへの貢献を歓迎します。詳細は[CONTRIBUTING.md](CONTRIBUTING.md)をご覧ください。

## サポート

- GitHub Issues: [Issues](https://github.com/yohi/CursorCLI-Extensions/issues)
- ドキュメント: [Documentation](./docs/)