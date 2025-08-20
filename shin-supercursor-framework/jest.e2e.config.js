/**
 * Jest 設定ファイル - E2E テスト用
 */

module.exports = {
  // TypeScript サポート
  preset: 'ts-jest',
  testEnvironment: 'node',

  // E2E テスト対象ファイル
  testMatch: [
    '<rootDir>/test/e2e/**/*.e2e-spec.ts'
  ],

  // モジュール解決
  moduleNameMapping: {
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1'
  },

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/test/e2e-setup.ts'],

  // TypeScript 設定
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },

  // E2E テスト用タイムアウト（長め）
  testTimeout: 60000,

  // シーケンシャル実行（E2Eテストは並列化しない）
  maxWorkers: 1,

  // 詳細ログ
  verbose: true,

  // キャッシュ無効化（E2Eテストは毎回フレッシュな状態で）
  cache: false,

  // カバレッジは収集しない（E2Eテストでは不要）
  collectCoverage: false,

  // グローバル変数
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};