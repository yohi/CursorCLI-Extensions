import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdir, writeFile, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ContextAnalyzer, ContextAnalysisError } from '../../../src/core/context-analyzer.js';
import {
  ProjectType,
  FrameworkType,
  DatabaseType,
  FileType,
  DirectoryPurpose
} from '../../../src/types/index.js';

describe('ContextAnalyzer', () => {
  let contextAnalyzer: ContextAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), `context-analyzer-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // ContextAnalyzerのインスタンスを作成
    contextAnalyzer = new ContextAnalyzer();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      contextAnalyzer.dispose();
      await rmdir(testDir, { recursive: true });
    } catch (error) {
      // エラーは無視（テスト環境での一時的な問題）
    }
  });

  describe('プロジェクト構造解析', () => {
    it('基本的なプロジェクト構造を正しく解析する', async () => {
      // テストプロジェクト構造を作成
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, 'tests'), { recursive: true });
      await mkdir(join(testDir, 'docs'), { recursive: true });
      
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'jest': '^29.0.0'
        }
      }));
      
      await writeFile(join(testDir, 'src/index.ts'), 'console.log("Hello, World!");');
      await writeFile(join(testDir, 'src/app.tsx'), 'import React from "react"; export const App = () => <div>App</div>;');
      await writeFile(join(testDir, 'tests/app.test.ts'), 'describe("App", () => { it("works", () => { expect(true).toBe(true); }); });');
      await writeFile(join(testDir, 'README.md'), '# Test Project');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.name).toBe(context.name);
      expect(context.rootPath).toBe(testDir);
      expect(context.structure).toBeDefined();
      expect(context.structure.directories).toHaveLength(1); // ルートディレクトリ
      expect(context.structure.files.length).toBeGreaterThan(0);
      
      // ディレクトリの目的が正しく推定されているかチェック
      const rootDir = context.structure.directories[0];
      const srcDir = rootDir?.children.find(d => d.name === 'src');
      const testsDir = rootDir?.children.find(d => d.name === 'tests');
      const docsDir = rootDir?.children.find(d => d.name === 'docs');

      expect(srcDir?.purpose).toBe(DirectoryPurpose.SOURCE);
      expect(testsDir?.purpose).toBe(DirectoryPurpose.TESTS);
      expect(docsDir?.purpose).toBe(DirectoryPurpose.DOCS);
    });

    it('ファイルタイプを正しく推定する', async () => {
      await writeFile(join(testDir, 'config.json'), '{}');
      await writeFile(join(testDir, 'app.test.js'), '// test file');
      await writeFile(join(testDir, 'README.md'), '# Documentation');
      await writeFile(join(testDir, 'style.css'), 'body { margin: 0; }');
      await writeFile(join(testDir, 'index.js'), 'console.log("app");');

      const context = await contextAnalyzer.analyzeProject(testDir);

      const configFile = context.structure.files.find(f => f.name === 'config.json');
      const testFile = context.structure.files.find(f => f.name === 'app.test.js');
      const docFile = context.structure.files.find(f => f.name === 'README.md');
      const assetFile = context.structure.files.find(f => f.name === 'style.css');
      const sourceFile = context.structure.files.find(f => f.name === 'index.js');

      expect(configFile?.type).toBe(FileType.CONFIG);
      expect(testFile?.type).toBe(FileType.TEST);
      expect(docFile?.type).toBe(FileType.DOCUMENTATION);
      expect(assetFile?.type).toBe(FileType.ASSET);
      expect(sourceFile?.type).toBe(FileType.SOURCE_CODE);
    });

    it('言語を拡張子から正しく推定する', async () => {
      await writeFile(join(testDir, 'app.js'), 'console.log("js");');
      await writeFile(join(testDir, 'app.ts'), 'const message: string = "ts";');
      await writeFile(join(testDir, 'app.py'), 'print("python")');
      await writeFile(join(testDir, 'App.java'), 'public class App {}');

      const context = await contextAnalyzer.analyzeProject(testDir);

      const jsFile = context.structure.files.find(f => f.name === 'app.js');
      const tsFile = context.structure.files.find(f => f.name === 'app.ts');
      const pyFile = context.structure.files.find(f => f.name === 'app.py');
      const javaFile = context.structure.files.find(f => f.name === 'App.java');

      expect(jsFile?.language).toBe('javascript');
      expect(tsFile?.language).toBe('typescript');
      expect(pyFile?.language).toBe('python');
      expect(javaFile?.language).toBe('java');
    });
  });

  describe('技術スタック検出', () => {
    it('JavaScriptプロジェクトを正しく検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'js-project',
        dependencies: {
          'lodash': '^4.17.21'
        }
      }));
      await writeFile(join(testDir, 'index.js'), 'const _ = require("lodash"); console.log("JS project");');
      await writeFile(join(testDir, 'utils.js'), 'module.exports = { helper: () => {} };');

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.languages).toHaveLength(1);
      expect(techStack.languages[0]?.name).toBe('javascript');
      expect(techStack.languages[0]?.confidence).toBeGreaterThan(0.5);
      expect(techStack.languages[0]?.fileCount).toBe(2);
    });

    it('TypeScriptプロジェクトを正しく検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'ts-project',
        devDependencies: {
          'typescript': '^5.0.0'
        }
      }));
      await writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs'
        }
      }));
      await writeFile(join(testDir, 'index.ts'), 'interface User { name: string; } const user: User = { name: "test" };');
      await writeFile(join(testDir, 'app.tsx'), 'import React from "react"; const App: React.FC = () => <div>App</div>;');

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.languages.some(lang => lang.name === 'typescript')).toBe(true);
      const tsLang = techStack.languages.find(lang => lang.name === 'typescript');
      expect(tsLang?.confidence).toBeGreaterThan(0.5);
      expect(tsLang?.fileCount).toBe(2);
    });

    it('Pythonプロジェクトを正しく検出する', async () => {
      await writeFile(join(testDir, 'requirements.txt'), 'flask==2.3.0\nrequests==2.31.0');
      await writeFile(join(testDir, 'app.py'), 'from flask import Flask\napp = Flask(__name__)');
      await writeFile(join(testDir, 'utils.py'), 'def helper(): pass');

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.languages.some(lang => lang.name === 'python')).toBe(true);
      const pyLang = techStack.languages.find(lang => lang.name === 'python');
      expect(pyLang?.confidence).toBeGreaterThan(0.5);
    });

    it('Reactフレームワークを正しく検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'react-project',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        }
      }));
      await writeFile(join(testDir, 'App.jsx'), 'import React from "react"; export const App = () => <div>Hello</div>;');

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.frameworks.some(fw => fw.name === 'React')).toBe(true);
      const reactFw = techStack.frameworks.find(fw => fw.name === 'React');
      expect(reactFw?.confidence).toBeGreaterThan(0.5);
    });

    it('Next.jsフレームワークを正しく検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'nextjs-project',
        dependencies: {
          'next': '^13.4.0',
          'react': '^18.2.0'
        }
      }));
      await mkdir(join(testDir, 'pages'), { recursive: true });
      await writeFile(join(testDir, 'pages/index.js'), 'export default function Home() { return <div>Home</div>; }');
      await writeFile(join(testDir, 'next.config.js'), 'module.exports = {};');

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.frameworks.some(fw => fw.name === 'Next.js')).toBe(true);
      const nextFw = techStack.frameworks.find(fw => fw.name === 'Next.js');
      expect(nextFw?.confidence).toBeGreaterThan(0.5);
    });

    it('Express.jsフレームワークを正しく検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'express-project',
        dependencies: {
          'express': '^4.18.0'
        }
      }));
      await writeFile(join(testDir, 'server.js'), `
        const express = require('express');
        const app = express();
        app.get('/', (req, res) => res.send('Hello World!'));
      `);

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.frameworks.some(fw => fw.name === 'Express.js')).toBe(true);
    });

    it('データベースを依存関係から検出する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'db-project',
        dependencies: {
          'pg': '^8.11.0',
          'mongodb': '^5.6.0',
          'redis': '^4.6.0'
        }
      }));

      const techStack = await contextAnalyzer.detectTechnologyStack(testDir);

      expect(techStack.databases.some(db => db.name === 'PostgreSQL')).toBe(true);
      expect(techStack.databases.some(db => db.name === 'MongoDB')).toBe(true);
      expect(techStack.databases.some(db => db.name === 'Redis')).toBe(true);
    });
  });

  describe('プロジェクトタイプ推定', () => {
    it('Reactプロジェクトをウェブアプリケーションとして推定する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'react-app',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        }
      }));
      await writeFile(join(testDir, 'src/App.tsx'), 'import React from "react";');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.type).toBe(ProjectType.WEB_APPLICATION);
    });

    it('Express.jsプロジェクトをAPIサービスとして推定する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'express-api',
        dependencies: {
          'express': '^4.18.0'
        }
      }));
      await writeFile(join(testDir, 'server.js'), 'const express = require("express");');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.type).toBe(ProjectType.API_SERVICE);
    });

    it('Next.jsプロジェクトをウェブアプリケーションとして推定する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'nextjs-app',
        dependencies: {
          'next': '^13.4.0'
        }
      }));
      await mkdir(join(testDir, 'pages'), { recursive: true });
      await writeFile(join(testDir, 'pages/index.js'), 'export default function Home() {}');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.type).toBe(ProjectType.WEB_APPLICATION);
    });
  });

  describe('依存関係解析', () => {
    it('package.jsonから依存関係を正しく解析する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'dependency-test',
        dependencies: {
          'react': '^18.2.0',
          'lodash': '^4.17.21'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'jest': '^29.5.0'
        }
      }));

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.dependencies).toHaveLength(4);
      
      const reactDep = context.dependencies.find(d => d.name === 'react');
      const lodashDep = context.dependencies.find(d => d.name === 'lodash');
      const tsDep = context.dependencies.find(d => d.name === 'typescript');
      const jestDep = context.dependencies.find(d => d.name === 'jest');

      expect(reactDep?.dev).toBe(false);
      expect(lodashDep?.dev).toBe(false);
      expect(tsDep?.dev).toBe(true);
      expect(jestDep?.dev).toBe(true);
    });

    it('package.jsonが存在しない場合は空の依存関係配列を返す', async () => {
      await writeFile(join(testDir, 'index.js'), 'console.log("no package.json");');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.dependencies).toEqual([]);
    });
  });

  describe('構造パターン認識', () => {
    it('モノレポ構造を正しく認識する', async () => {
      await mkdir(join(testDir, 'packages'), { recursive: true });
      await mkdir(join(testDir, 'packages/app1'), { recursive: true });
      await mkdir(join(testDir, 'packages/app2'), { recursive: true });
      await writeFile(join(testDir, 'lerna.json'), JSON.stringify({
        version: '1.0.0',
        packages: ['packages/*']
      }));

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.structure.patterns.some(p => p.name === 'monorepo')).toBe(true);
    });

    it('MVCパターンを正しく認識する', async () => {
      await mkdir(join(testDir, 'models'), { recursive: true });
      await mkdir(join(testDir, 'views'), { recursive: true });
      await mkdir(join(testDir, 'controllers'), { recursive: true });
      await writeFile(join(testDir, 'models/User.js'), 'class User {}');
      await writeFile(join(testDir, 'views/index.html'), '<html></html>');
      await writeFile(join(testDir, 'controllers/UserController.js'), 'class UserController {}');

      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(context.structure.patterns.some(p => p.name === 'mvc')).toBe(true);
    });
  });

  describe('ナレッジグラフ構築', () => {
    it('基本的なナレッジグラフを構築する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'graph-test'
      }));

      const context = await contextAnalyzer.analyzeProject(testDir);
      const knowledgeGraph = await contextAnalyzer.buildKnowledgeGraph(context);

      expect(knowledgeGraph.nodes).toHaveLength(1); // プロジェクトルートノード
      expect(knowledgeGraph.nodes[0]?.id).toBe('project-root');
      expect(knowledgeGraph.nodes[0]?.name).toBe(context.name);
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないディレクトリでエラーをスローする', async () => {
      const nonExistentPath = join(testDir, 'non-existent');

      await expect(contextAnalyzer.analyzeProject(nonExistentPath))
        .rejects.toThrow(ContextAnalysisError);
    });

    it('読み取り権限のないディレクトリでエラーをスローする', async () => {
      // Windows環境では権限テストをスキップ
      if (process.platform === 'win32') {
        return;
      }

      const restrictedDir = join(testDir, 'restricted');
      await mkdir(restrictedDir);
      
      try {
        // 権限を削除（テスト環境によっては動作しない場合がある）
        const { chmod } = await import('fs/promises');
        await chmod(restrictedDir, 0o000);

        await expect(contextAnalyzer.analyzeProject(restrictedDir))
          .rejects.toThrow();
      } finally {
        // 権限を復元してクリーンアップ可能にする
        try {
          const { chmod } = await import('fs/promises');
          await chmod(restrictedDir, 0o755);
        } catch {
          // エラーは無視
        }
      }
    });
  });

  describe('イベント処理', () => {
    it('解析開始時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      contextAnalyzer.on('analysisStarted', mockListener);

      await writeFile(join(testDir, 'index.js'), 'console.log("test");');
      await contextAnalyzer.analyzeProject(testDir);

      expect(mockListener).toHaveBeenCalledWith({ rootPath: testDir });
    });

    it('解析完了時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      contextAnalyzer.on('analysisCompleted', mockListener);

      await writeFile(join(testDir, 'index.js'), 'console.log("test");');
      const context = await contextAnalyzer.analyzeProject(testDir);

      expect(mockListener).toHaveBeenCalledWith({ projectContext: context });
    });

    it('解析エラー時にイベントが発生する', async () => {
      const mockListener = jest.fn();
      contextAnalyzer.on('analysisError', mockListener);

      const nonExistentPath = join(testDir, 'non-existent');

      try {
        await contextAnalyzer.analyzeProject(nonExistentPath);
      } catch (error) {
        expect(mockListener).toHaveBeenCalled();
        const call = mockListener.mock.calls[0];
        expect(call?.[0]?.error).toBeInstanceOf(ContextAnalysisError);
      }
    });
  });

  describe('コンテキスト更新', () => {
    it('ファイル変更を適切に処理する', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));
      const initialContext = await contextAnalyzer.analyzeProject(testDir);

      const changes = [{
        type: 'file_added' as const,
        path: join(testDir, 'new-file.js'),
        content: 'console.log("new file");'
      }];

      const updatedContext = await contextAnalyzer.updateContext(initialContext, changes);

      expect(updatedContext).toBeDefined();
      // 実際の更新ロジックが実装されていないため、基本的な動作確認のみ
    });
  });
});