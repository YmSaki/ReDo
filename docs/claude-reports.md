# ReDo フレームワーク コードレビュー

**レビュー日時**: 2026-01-17
**レビュー対象**: 開発開始から約1時間経過時点のコード
**レビュアー**: Claude Code

---

## 1. プロジェクト概要

ReDoは、カスタムJSXランタイムを持つReactライクなUIフレームワークの実装です。独自のイベントキューシステムと非同期処理サポートを備えており、最小限のAPIで状態管理とレンダリングを実現することを目指しています。

### 主要な構成要素
- **JSX変換**: カスタムJSX runtime（`h`関数ベース）
- **Virtual DOM**: JSXNode → VNode 変換とrender pipeline
- **イベント処理**: キューベースのイベントシステム
- **非同期処理**: Promise対応のタスク管理
- **コンテキスト**: 統一されたイベントハンドリングインターフェース

---

## 2. アーキテクチャ評価

### 2.1 良い点

#### ✅ 明確な責務分離
各モジュールが明確な役割を持っています：
- `h.ts`: JSX変換
- `render.ts`: VNode解決
- `mount.ts`: DOM生成
- `queue.ts`: イベント管理
- `context.ts`: API統合

#### ✅ シンプルなAPI設計
```typescript
// App.tsx での使用例
const incriment = (ctx: Context) => {
  count++;
  ctx.reRender();
};
```
Context APIを通じて必要な機能にアクセスできる設計は直感的です。

#### ✅ イベントキューシステム
`queue.ts:19-22` のenqueue/flushパターンは、イベントのバッチ処理を可能にし、パフォーマンス最適化の基盤になります。

#### ✅ 非同期処理の統合
AsyncFunctionの検出（`mount.ts:33`）とタスクキャンセル機能（`queue.ts:59-65`）は、実用的なアプリケーションに必要な機能です。

#### ✅ 型定義の基盤
TypeScriptで型定義が整理されており、将来的な型安全性の向上に対応できる構造です。

---

## 3. 問題点と改善提案

### 3.1 重大な問題

#### ❌ **全体再レンダリングによるパフォーマンス問題**
**場所**: `core.ts:20`
```typescript
rootElement.innerHTML = "";
```

**問題点**:
- 毎回DOMを完全にクリアして再構築
- イベントリスナーが失われる
- 入力フォーカスが失われる
- スクロール位置がリセットされる

**影響度**: ★★★★★（最重要）

**推奨対応**:
1. 差分検出アルゴリズムの実装（Virtual DOM diffing）
2. 旧VNodeと新VNodeを比較してDOM操作を最小化
3. キー属性のサポート

#### ❌ **JSX設定の不一致**
**場所**:
- `tsconfig.json:6-7` (react-jsx)
- `vite.config.ts:7-13` (classic JSX)
- `.swcrc:9-11` (classic JSX with ReDo.h)

**問題点**:
異なるビルドツールで異なるJSX変換設定が混在しています。

**推奨対応**:
統一されたJSX設定への変更：
```json
// tsconfig.json
{
  "jsx": "react-jsx",
  "jsxImportSource": "./src/redo"
}
```
そして`jsx-runtime.ts`を適切に実装する必要があります。

#### ❌ **型定義の不完全性**
**場所**: `jsx-runtime.ts:3-5`, `jsx-node.ts:4-6`
```typescript
export const jsx = () => { };  // 空実装
type: any;  // any型の多用
```

**問題点**:
- 型安全性が失われている
- IDEの補完が効かない
- ランタイムエラーのリスク

**推奨対応**:
```typescript
// jsx-runtime.ts
export function jsx(type: any, props: any) {
  const { children, ...restProps } = props;
  return h(type, restProps, ...(Array.isArray(children) ? children : [children]));
}
```

---

### 3.2 中程度の問題

#### ⚠️ **状態管理の欠如**
**場所**: `App.tsx:5`
```typescript
let count = 0;  // モジュールレベルの変数
```

**問題点**:
- グローバル変数に依存
- コンポーネント間での状態共有が困難
- テスタビリティが低い

**推奨対応**:
- useState風のフック機能の追加
- またはコンテキストベースの状態管理

#### ⚠️ **イベントハンドラの型安全性**
**場所**: `mount.ts:29-40`

**問題点**:
- イベントハンドラの型チェックが不十分
- Context APIの暗黙的な注入

**推奨対応**:
```typescript
type ReDoEventHandler<E = Event> = (ctx: Context, event: E) => void;
```

#### ⚠️ **エラーハンドリングの不足**
**場所**: `queue.ts:45-54`

**問題点**:
- エラーが握りつぶされる可能性
- デバッグが困難

**推奨対応**:
```typescript
.catch((error) => {
  console.error("[ReDo Error]", error);
  if (routing?.fail) {
    enqueue(routing.fail, error);
  } else {
    throw error;  // 未処理エラーは再スロー
  }
  taskTable.delete(taskId);
})
```

---

### 3.3 軽微な問題

#### 💡 **命名の不統一**
- `App.tsx:7`: `incriment` → `increment` (スペルミス)
- `constant.ts` と `constants.ts` の混在

#### 💡 **未使用ファイル**
- `diff.ts`: 空ファイル（将来のdiffingアルゴリズム用？）
- `fragment.ts` と `h.ts` でFragmentが重複定義

#### 💡 **開発環境の混在**
`package.json:14` で Python の http.server を使用していますが、Viteの開発サーバーがあるため不要かもしれません。

---

## 4. コード品質評価

| 項目 | 評価 | コメント |
|------|------|----------|
| アーキテクチャ | ⭐⭐⭐⭐☆ | 明確な責務分離、拡張可能な設計 |
| 型安全性 | ⭐⭐☆☆☆ | `any`の多用、型定義が不完全 |
| パフォーマンス | ⭐⭐☆☆☆ | 全体再レンダリングが致命的 |
| 保守性 | ⭐⭐⭐☆☆ | コードは読みやすいが、ドキュメントが不足 |
| テスタビリティ | ⭐⭐☆☆☆ | テストコードなし、依存注入が不十分 |

**総合評価**: ⭐⭐⭐☆☆（3.0/5.0）

---

## 5. 優先度別アクションアイテム

### 🔴 高優先度（すぐに対応すべき）

1. **差分検出アルゴリズムの実装**
   - 現在の全体再レンダリングから、差分更新への移行
   - 参考: `diff.ts` ファイルを活用

2. **JSX設定の統一**
   - ビルドツール間での設定を統一
   - `jsx-runtime.ts` の適切な実装

3. **型定義の強化**
   - `any` の削除
   - 適切なジェネリック型の使用

### 🟡 中優先度（次のステップで対応）

4. **状態管理機能の追加**
   - `useState` 相当の機能
   - コンポーネントスコープの状態

5. **エラーハンドリングの改善**
   - グローバルエラーハンドラ
   - 開発モードでの詳細なエラー情報

6. **テストの追加**
   - ユニットテスト環境の構築
   - 主要機能のテストカバレッジ

### 🟢 低優先度（余裕があれば対応）

7. **ドキュメント整備**
   - API リファレンス
   - サンプルコード

8. **開発ツールの整備**
   - デバッガー機能
   - パフォーマンスプロファイラ

9. **コードの最適化**
   - 不要なファイルの削除
   - 命名の統一

---

## 6. 長所と独自性

### 💎 このフレームワークの強み

1. **軽量性**: 最小限の依存関係で動作
2. **シンプルなAPI**: 学習コストが低い
3. **イベント駆動アーキテクチャ**: 明示的なイベントフローが追跡しやすい
4. **非同期処理の統合**: Promise ベースの処理が標準で組み込まれている

### 🎯 将来的な可能性

- エンタープライズ向けの状態管理パターンの追加
- ルーティング機能の統合
- SSR (Server-Side Rendering) のサポート
- DevTools の開発

---

## 7. 総括

**開発開始1時間時点での評価としては、非常に良いスタートを切っています。**

### 👍 特に評価できる点
- アーキテクチャの設計思想が明確
- コードが読みやすく、拡張しやすい構造
- イベントキューなど、独自の工夫が見られる

### ⚠️ 早急に対処すべき点
- 差分検出の欠如によるパフォーマンス問題
- JSX設定の不一致
- 型安全性の向上

### 🚀 推奨される次のステップ

1. まず、差分検出アルゴリズムを実装し、パフォーマンスの基盤を固める
2. 型定義を強化し、開発体験を向上させる
3. 簡単なサンプルアプリを作りながら、不足している機能を洗い出す

**1時間で作成したコードとしては、構造が非常に整理されており、今後の発展が期待できます。**ただし、実用レベルに到達するには、上記の重大な問題への対応が不可欠です。

---

## 付録: 参考実装パターン

### A. 差分検出の基本パターン

```typescript
// diff.ts の実装例
export function diff(oldVNode: VNode | null, newVNode: VNode | null, parent: HTMLElement, index = 0) {
  // 新規追加
  if (!oldVNode) {
    mount(newVNode, parent);
    return;
  }

  // 削除
  if (!newVNode) {
    parent.removeChild(parent.childNodes[index]);
    return;
  }

  // 更新
  if (hasChanged(oldVNode, newVNode)) {
    parent.replaceChild(
      createDOMElement(newVNode),
      parent.childNodes[index]
    );
    return;
  }

  // 子要素の差分検出（再帰）
  // ...
}
```

### B. useState実装のヒント

```typescript
let currentComponent: any = null;
let hookIndex = 0;
const hooks: any[] = [];

export function useState<T>(initialValue: T): [T, (newValue: T) => void] {
  const currentIndex = hookIndex;
  hooks[currentIndex] = hooks[currentIndex] ?? initialValue;

  const setState = (newValue: T) => {
    hooks[currentIndex] = newValue;
    reRender();
  };

  hookIndex++;
  return [hooks[currentIndex], setState];
}
```

---

**レビュー完了**

このレポートが今後の開発の指針となれば幸いです。質問や追加のコードレビューが必要な場合は、お気軽にお申し付けください。
