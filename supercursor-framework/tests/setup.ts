// テスト用のグローバルセットアップファイル
import { jest } from '@jest/globals';

// テストタイムアウトの設定
jest.setTimeout(30000);

// グローバルモック設定
beforeAll(() => {
  // テスト実行前の初期化
});

afterAll(() => {
  // テスト実行後のクリーンアップ
});

beforeEach(() => {
  // 各テスト前の初期化
  jest.clearAllMocks();
});

afterEach(() => {
  // 各テスト後のクリーンアップ
});