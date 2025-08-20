# SuperCursor Framework - よくある質問 (FAQ)

## 一般的な質問

### Q: SuperCursor Frameworkとは何ですか？
A: SuperCursor Frameworkは、Framework-1の優れた設計思想とFramework-2の実装完成度を統合し、NestJSのベストプラクティスを適用した次世代フレームワークです。AIペルソナ管理、コマンド実行、外部システム統合などを提供します。

### Q: 他のフレームワークとの違いは何ですか？
A: 主な特徴：
- **統合アーキテクチャ**: ヘキサゴナルアーキテクチャ + CQRS パターン
- **AIペルソナシステム**: コンテキストに応じた自動ペルソナ選択
- **型安全性**: TypeScript strict mode + Brand types
- **企業グレード**: セキュリティ、監視、テストを完備

### Q: どのような用途に適していますか？
A: 以下の用途に最適です：
- **開発ツール**: コード生成、分析、リファクタリング
- **CI/CDパイプライン**: 自動化されたビルド・テスト・デプロイ
- **プロジェクト管理**: タスク自動化、品質チェック
- **教育・学習**: コードレビュー、ベストプラクティス提案

## インストールと設定

### Q: インストール方法を教えてください。
A: 以下のコマンドでインストールできます：
```bash
npm install shin-supercursor-framework
# または
yarn add shin-supercursor-framework
```

### Q: 最小システム要件は？
A: 
- **Node.js**: 18.0.0 以上
- **TypeScript**: 5.0.0 以上
- **メモリ**: 512MB 以上
- **ストレージ**: 100MB 以上

### Q: 環境変数の設定方法は？
A: `.env`ファイルを作成し、以下を設定：
```env
# データベース
DATABASE_PATH=./supercursor.db

# ペルソナ設定
MAX_ACTIVE_PERSONAS=5
PERSONA_ENABLE_LEARNING=true

# コマンド設定
COMMAND_DEFAULT_TIMEOUT=30000

# 統合設定
CURSOR_PATH=cursor
CURSOR_API_ENABLED=true
```

## 使用方法

### Q: 基本的な使用方法は？
A: NestJSアプリケーションとして使用：
```typescript
import { SuperCursorModule } from 'shin-supercursor-framework';

@Module({
  imports: [SuperCursorModule.forRoot()]
})
export class AppModule {}
```

### Q: ライブラリとして使用できますか？
A: はい、以下のように使用できます：
```typescript
import { FrameworkEntity } from 'shin-supercursor-framework';

const framework = new FrameworkEntity();
await framework.initialize();

const result = await framework.executeCommand(
  'analyze src/',
  executionContext
);
```

### Q: カスタムコマンドの追加方法は？
A: コマンドハンドラーを実装：
```typescript
@Injectable()
export class CustomCommandHandler implements CommandHandler {
  name = 'custom';
  async execute(command: Command): Promise<CommandResult> {
    // カスタム処理
  }
}
```

## ペルソナシステム

### Q: ペルソナとは何ですか？
A: ペルソナは特定の専門領域に特化したAIエージェントです。例：
- **Developer**: コード生成・レビュー
- **Architect**: システム設計・アーキテクチャ
- **Analyst**: コード分析・品質評価
- **DevOps**: デプロイ・インフラ管理

### Q: ペルソナの選択はどのように行われますか？
A: 以下の要因に基づいて自動選択：
- **技術スタック**: プロジェクトで使用されている技術
- **専門レベル**: タスクの複雑さとペルソナの専門性
- **過去のパフォーマンス**: 実行履歴と成功率
- **ユーザー設定**: 個人の好みと経験レベル

### Q: カスタムペルソナの作成は可能ですか？
A: はい、PersonaFactoryを使用：
```typescript
const customPersona = await personaFactory.createPersona({
  name: 'Custom Expert',
  type: PersonaType.CUSTOM,
  expertise: [/* 専門領域 */],
  capabilities: [/* 機能 */]
});
```

## コマンドシステム

### Q: 利用可能なコマンドは？
A: 現在提供されているコマンド：
- **analyze**: プロジェクト・ファイルの分析
- **implement**: 要件に基づくコード実装（予定）
- **build**: ビルド・テストの実行（予定）
- **design**: アーキテクチャ設計（予定）

### Q: コマンドのバリデーションは？
A: 以下のバリデーションを実行：
- **構文チェック**: コマンド名・引数・オプション
- **権限チェック**: ユーザーの実行権限
- **パラメータ検証**: 型と値の妥当性
- **セキュリティ**: パストラバーサル等の検査

### Q: コマンド実行のタイムアウト設定は？
A: 環境変数で設定可能：
```env
COMMAND_DEFAULT_TIMEOUT=30000  # 30秒
```

## トラブルシューティング

### Q: インストールでエラーが発生します
A: 以下をご確認ください：
1. Node.jsバージョン（18以上）
2. npm/yarnの最新版
3. ディスク容量（100MB以上）
4. ネットワーク接続

### Q: 「Cursor not found」エラーが表示されます
A: Cursorの設定を確認：
```env
CURSOR_PATH=/path/to/cursor
CURSOR_API_ENABLED=true
```

### Q: メモリ不足エラーが発生します
A: 以下の対策：
1. Node.jsメモリ制限を増加：`--max-old-space-size=4096`
2. 並行コマンド数を減少：`MAX_CONCURRENT_COMMANDS=3`
3. ファイルサイズ制限を調整：`MAX_FILE_SIZE=5242880`

### Q: データベース接続エラーが発生します
A: SQLite設定を確認：
```env
DATABASE_PATH=./supercursor.db
```
ディレクトリの書き込み権限もご確認ください。

### Q: ペルソナが選択されません
A: 以下をご確認：
1. ペルソナが登録されているか
2. プロジェクトの技術スタック情報
3. ユーザー権限設定
4. ログでエラー詳細を確認

## パフォーマンス

### Q: 実行速度を向上させるには？
A: 以下の最適化：
1. **キャッシュ有効化**: `ENABLE_CACHING=true`
2. **並行処理**: `MAX_CONCURRENT_COMMANDS=10`
3. **メモリ設定**: `--max-old-space-size=4096`
4. **ファイル監視無効化**: `ENABLE_FILE_WATCHING=false`

### Q: メモリ使用量を削減するには？
A: 以下の設定：
1. **ペルソナ数制限**: `MAX_ACTIVE_PERSONAS=3`
2. **ファイルサイズ制限**: `MAX_FILE_SIZE=1048576`
3. **監視機能無効化**: `PERSONA_ENABLE_LEARNING=false`

## セキュリティ

### Q: セキュリティ対策は？
A: 以下の対策を実装：
- **パス制限**: `ALLOWED_PATHS`と`DENIED_PATHS`
- **ファイルサイズ制限**: `MAX_FILE_SIZE`
- **入力検証**: すべての入力に対するバリデーション
- **権限制御**: ユーザー別の実行権限

### Q: 本番環境での注意点は？
A: 以下をご設定ください：
```env
NODE_ENV=production
LOG_LEVEL=error
ENABLE_METRICS=true
DENIED_PATHS=/etc,/usr,/bin,/sbin
```

## 開発・拡張

### Q: 開発に参加するには？
A: 以下の手順：
1. リポジトリをフォーク
2. 開発環境のセットアップ
3. テストの実行確認
4. プルリクエストの作成

### Q: カスタムモジュールの作成は？
A: NestJSモジュールとして作成：
```typescript
@Module({
  imports: [SuperCursorModule],
  providers: [CustomService],
  exports: [CustomService]
})
export class CustomModule {}
```

### Q: テストの実行方法は？
A: 以下のコマンド：
```bash
npm run test:unit       # ユニットテスト
npm run test:integration # 統合テスト
npm run test:e2e        # E2Eテスト
npm run test:coverage   # カバレッジ付き
```

## サポート

### Q: サポートはどこで受けられますか？
A: 以下をご利用ください：
- **GitHub Issues**: バグ報告・機能要求
- **GitHub Discussions**: 質問・議論
- **Wiki**: 詳細ドキュメント
- **Examples**: サンプルコード

### Q: バグを見つけた場合は？
A: GitHub Issuesで報告してください：
1. 再現手順
2. 期待される動作
3. 実際の動作
4. 環境情報（OS、Node.js、フレームワークバージョン）

### Q: 機能要求はどこに？
A: GitHub Issuesまたは Discussions で提案してください。

## ライセンスと利用条件

### Q: ライセンスは？
A: MITライセンスです。商用利用も可能です。

### Q: 商用プロジェクトで使用できますか？
A: はい、MITライセンスのため商用利用が可能です。

### Q: 再配布は可能ですか？
A: はい、ライセンス条項に従って再配布可能です。

---

その他の質問がございましたら、GitHub Issues または Discussions でお気軽にお尋ねください。