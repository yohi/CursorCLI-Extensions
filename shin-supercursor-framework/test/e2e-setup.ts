/**
 * Jest セットアップファイル - E2E テスト用
 */

import { config } from 'dotenv';

// E2Eテスト用環境変数を読み込み
config({ path: '.env.test' });

// E2Eテスト用のグローバル設定
beforeAll(async () => {
  // テスト用データベースの設定
  process.env.DATABASE_PATH = ':memory:'; // SQLite インメモリDB
  process.env.NODE_ENV = 'test';
  
  // ログレベルを制限
  process.env.LOG_LEVEL = 'error';
  
  // 外部統合を無効化（テスト時）
  process.env.CURSOR_API_ENABLED = 'false';
  
  // テスト用の制限値
  process.env.MAX_FILE_SIZE = '1048576'; // 1MB
  process.env.MAX_CONCURRENT_COMMANDS = '5';
  
  console.log('E2E テスト環境を初期化しました');
});

afterAll(async () => {
  console.log('E2E テストが完了しました');
});

// テスト間でのクリーンアップ
afterEach(async () => {
  // 必要に応じてテストデータをクリーンアップ
  // データベースリセット、一時ファイル削除など
});

// E2E テスト用ヘルパー関数
global.createTestUser = () => ({
  id: `test_user_${Date.now()}` as any,
  name: 'E2E Test User',
  preferences: {
    language: 'ja' as const,
    theme: 'dark' as const,
    outputFormat: 'json' as const,
    verbosity: 'normal' as const,
    autoSave: false,
    confirmActions: false,
    shortcuts: {},
    notifications: {
      email: false,
      desktop: true,
      sound: false,
      types: []
    }
  },
  permissions: [
    {
      resource: 'commands' as const,
      actions: ['read', 'write', 'execute'] as const,
      scope: 'project' as const
    }
  ],
  profile: {
    experience: 'intermediate' as const,
    skills: [],
    interests: [],
    timezone: 'Asia/Tokyo',
    workingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'Asia/Tokyo',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
    }
  },
  activity: {
    lastLogin: new Date(),
    sessionCount: 1,
    totalTime: 0,
    recentProjects: [],
    statistics: {
      commandsExecuted: 0,
      projectsWorked: 0,
      favoritePersonas: [],
      averageSessionTime: 0,
      productivity: {
        linesOfCodeGenerated: 0,
        bugsFixed: 0,
        testsWritten: 0,
        documentsCreated: 0,
        refactoringsPerformed: 0
      }
    }
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

// グローバル型定義
declare global {
  var createTestUser: () => any;
}