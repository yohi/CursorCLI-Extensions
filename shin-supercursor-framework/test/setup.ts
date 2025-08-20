/**
 * Jest セットアップファイル - ユニット・統合テスト用
 */

// グローバルモック設定
beforeAll(() => {
  // ログ出力を抑制（テスト時）
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  
  // エラーとwarningは表示
  // jest.spyOn(console, 'error').mockImplementation(() => {});
  // jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  // モックをクリア
  jest.restoreAllMocks();
});

// カスタムマッチャー
expect.extend({
  toBeValidCommandResult(received) {
    const pass = received &&
      typeof received === 'object' &&
      typeof received.success === 'boolean' &&
      received.commandId &&
      received.output &&
      received.metadata &&
      received.performance;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid command result`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid command result`,
        pass: false
      };
    }
  },

  toBeValidPersona(received) {
    const pass = received &&
      typeof received === 'object' &&
      received.id &&
      received.name &&
      received.type &&
      received.expertise &&
      Array.isArray(received.capabilities);

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid persona`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid persona`,
        pass: false
      };
    }
  }
});

// TypeScript 型定義拡張
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCommandResult(): R;
      toBeValidPersona(): R;
    }
  }
}