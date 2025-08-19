/**
 * SuperCursor Framework - 基本的な使用例
 */

import { 
  createSuperCursorApp, 
  createCommandContext,
  SuperCursorApp
} from '../src/index';

async function basicUsageExample() {
  console.log('SuperCursor Framework - 基本的な使用例');
  
  try {
    // フレームワークアプリケーションを作成・初期化
    const app = await createSuperCursorApp({
      logLevel: 'info',
      workingDirectory: process.cwd(),
      enableCaching: true,
    });

    console.log('✅ SuperCursor Framework が初期化されました');

    // 利用可能なコマンドを表示
    const availableCommands = app.getAvailableCommands();
    console.log(`\n📋 利用可能なコマンド数: ${availableCommands.length}`);
    
    availableCommands.forEach(cmd => {
      console.log(`  - /${cmd.type}: ${cmd.description}`);
    });

    // ヘルプコマンドの実行例
    console.log('\n🔍 ヘルプコマンドを実行...');
    const helpContext = createCommandContext('/sc:help');
    const helpResult = await app.executeCommand(helpContext);
    
    if (helpResult.success) {
      console.log('✅ ヘルプコマンド実行成功');
      console.log(helpResult.output);
    } else {
      console.log('❌ ヘルプコマンド実行失敗:', helpResult.error);
    }

    // 実装コマンドの実行例
    console.log('\n🚀 実装コマンドを実行...');
    const implementContext = createCommandContext(
      '/sc:implement',
      ['簡単なユーザー認証機能'],
      {
        language: 'typescript',
        framework: 'express',
      }
    );
    
    const implementResult = await app.executeCommand(implementContext);
    
    if (implementResult.success) {
      console.log('✅ 実装コマンド実行成功');
      console.log('生成されたファイル数:', implementResult.output?.generatedFiles?.length || 0);
      console.log('変更されたファイル数:', implementResult.output?.modifiedFiles?.length || 0);
    } else {
      console.log('❌ 実装コマンド実行失敗:', implementResult.error);
    }

    // 分析コマンドの実行例
    console.log('\n📊 分析コマンドを実行...');
    const analyzeContext = createCommandContext(
      '/sc:analyze',
      ['project'],
      {
        types: 'architecture,security',
        'include-tests': true,
      }
    );
    
    const analyzeResult = await app.executeCommand(analyzeContext);
    
    if (analyzeResult.success) {
      console.log('✅ 分析コマンド実行成功');
      console.log('発見された問題数:', analyzeResult.output?.findings?.length || 0);
      console.log('品質スコア:', analyzeResult.output?.summary?.qualityScore || 0);
    } else {
      console.log('❌ 分析コマンド実行失敗:', analyzeResult.error);
    }

    // コマンド履歴を表示
    console.log('\n📋 コマンド履歴:');
    const history = app.getCommandHistory();
    history.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.command} - ${entry.success ? '成功' : '失敗'} (${entry.duration}ms)`);
    });

    // ヘルスチェック
    console.log('\n🏥 ヘルスチェック実行...');
    const health = await app.healthCheck();
    console.log(`システム状態: ${health.status}`);
    Object.entries(health.components).forEach(([component, status]) => {
      console.log(`  - ${component}: ${status === 'ok' ? '✅' OK' : '❌ エラー'}`);
    });

    // フレームワークを終了
    await app.shutdown();
    console.log('\n✅ SuperCursor Framework が正常に終了しました');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error instanceof Error ? error.message : error);
  }
}

// コマンドチェーンの実行例
async function commandChainExample() {
  console.log('\n\n🔗 コマンドチェーンの使用例');
  
  try {
    const app = await createSuperCursorApp({ logLevel: 'warn' });
    
    // 複数のコマンドを連続実行
    const contexts = [
      createCommandContext('/sc:analyze', ['project'], { types: 'architecture' }),
      createCommandContext('/sc:design', ['architecture', 'enhancement'], { requirements: '高可用性,セキュリティ' }),
      createCommandContext('/sc:build', ['production'], { optimization: 'advanced' }),
    ];
    
    console.log(`${contexts.length} 個のコマンドを連続実行中...`);
    
    const results = await app.executeCommandChain(contexts);
    
    console.log(`実行完了: ${results.filter(r => r.success).length}/${results.length} が成功`);
    
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${contexts[index].command}: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
      if (!result.success) {
        console.log(`     エラー: ${result.error}`);
      }
    });
    
    await app.shutdown();
    
  } catch (error) {
    console.error('❌ コマンドチェーン実行でエラー:', error instanceof Error ? error.message : error);
  }
}

// 設定のカスタマイズ例
async function customConfigurationExample() {
  console.log('\n\n⚙️  カスタム設定の使用例');
  
  try {
    const app = new SuperCursorApp({
      config: {
        logLevel: 'debug',
        enableCaching: false,
        cacheTimeout: 600000, // 10分
        maxHistorySize: 50,
        enableValidation: true,
        workingDirectory: process.cwd(),
        personas: {
          enableAutoSelection: false,
          enableLearning: false,
        },
      },
    });
    
    await app.initialize();
    console.log('✅ カスタム設定でフレームワークを初期化しました');
    
    // 設定の更新例
    await app.updateConfig({
      logLevel: 'info',
      enableCaching: true,
    });
    
    console.log('✅ 実行時設定を更新しました');
    
    await app.shutdown();
    
  } catch (error) {
    console.error('❌ カスタム設定例でエラー:', error instanceof Error ? error.message : error);
  }
}

// すべての例を実行
async function main() {
  await basicUsageExample();
  await commandChainExample();
  await customConfigurationExample();
}

if (require.main === module) {
  main().catch(console.error);
}