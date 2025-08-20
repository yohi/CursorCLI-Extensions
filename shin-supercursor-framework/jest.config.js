/**
 * Jest 設定ファイル - ユニット・統合テスト用
 */

module.exports = {
  // TypeScript サポート
  preset: 'ts-jest',
  testEnvironment: 'node',

  // テスト対象ファイル
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.spec.ts'
  ],

  // ソースコードの場所
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/index.ts'
  ],

  // カバレッジレポート
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // モジュール解決
  moduleNameMapping: {
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1'
  },

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // モック設定
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // TypeScript 設定
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },

  // タイムアウト設定
  testTimeout: 10000,

  // 並列実行
  maxWorkers: '50%',

  // エラー時の詳細表示
  verbose: true,

  // グローバル変数
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
};