# ReDo Project Analysis: Philosophy & Architecture
**"Logic Unbound from UI" - A Rebellion against React**

## 1. コア・フィロソフィー (Core Philosophy)
ReDoは、既存のUIライブラリ（特にReact）が抱える「ロジックがUIコンポーネントの人質になっている」という構造的な問題に対するアンチテーゼとして設計されています。

- **脱・React Component Hooks:** ビジネスロジックをコンポーネントのライフサイクル (`useState`, `useEffect`) に閉じ込めない。
- **Separation of Concerns (関心の分離):** 「計算する場所 (Logic/Model)」と「表示する場所 (View/UI)」を物理的・構造的に分離する。
- **Explicit over Implicit:** 暗黙的な再レンダリングの魔法に頼らず、ロジック側が明示的にUIへ更新を通知する制御権を持つ。

## 2. アーキテクチャ再評価 (Architecture Review)

### A. 状態管理 (State Management)
**現状のコード (`App.tsx`):**
```typescript
let count = 0; // State is separated from Component

const incriment = (ctx: Context) => { // Logic is pure function (or separate class)
    count++;
    ctx.reRender(); // Explicit update trigger
};

export const App = () => { ... } // Pure View
```
**評価:**
これを単なる「グローバル変数の使用」と見るのは誤りです。これは**Model-View分離の原型**です。
- **強み:** `incriment` 関数や `count` はDOMやReDoライブラリがなくても動作し、単体テストが極めて容易です。
- **特徴:** UIは状態を「持つ」のではなく、状態を「参照」して描画するだけのプロジェクターとして機能しています。

### B. コンポーネント設計 (Component Design)
ReDoにおけるコンポーネントは、状態を持たない**純粋な関数 (Pure Function)** であることが推奨されていると読み取れます。
- Reactのコンポーネントは「状態と振る舞いをカプセル化したオブジェクト」に近いですが、ReDoのコンポーネントは「データをVNodeに変換するテンプレート」に徹しています。
- これにより、デザイン変更やフレームワークの移行が発生しても、ロジックコードへの影響をゼロに抑えることが可能です。

### C. 更新フロー (Update Flow)
`Context` クラスと `reRender()` メソッドが、ロジック層とUI層をつなぐブリッジの役割を果たしています。
- **React:** `setState` を呼ぶと、いつか再レンダリングが走る（制御不能）。
- **ReDo:** ロジックが完了したタイミングで `ctx.reRender()` を呼ぶ（制御可能）。バッチ処理や非同期処理の制御権が開発者側にあります。

## 3. 現状の実装における技術的ポイント

### メリット (Pros)
1.  **圧倒的なテスタビリティ:** ロジック部分にモックやテスト用レンダラが不要。純粋なTypeScriptのテストとして記述できる。
2.  **移植性 (Portability):** ロジックコードはUIライブラリに依存しないため、将来的に他のViewライブラリへ移行したり、React Native等の別プラットフォームへロジックを共有したりすることが容易。
3.  **単純さ (Simplicity):** フックのルール（条件付き呼び出し禁止など）や依存配列 (`deps array`) の管理から解放される。

### 留意点と今後の強化ポイント (Cons -> Challenges)
思想は素晴らしいですが、実用アプリケーションにするためには、以下の「UI側の都合」を解決する必要があります。

1.  **Diffing / Reconciliation (差分検知)**
    - *理由:* 全消去・再描画 (`innerHTML = ""`) は、思想とは無関係に、ブラウザのUX（フォーカス、スクロール、アニメーション）を破壊するため。
    - *解決策:* `vnode.ts`, `diff.ts` の強化。ただしReactのような複雑なFiberアーキテクチャである必要はなく、Preactのような同期的なDiffで十分。

2.  **状態の注入メカニズム (Dependency Injection)**
    - *理由:* グローバル変数 (`let count`) は、複数インスタンス化（例：2つの独立したカウンター）に対応できない。
    - *解決策:* コンポーネント内部にStateを作るのではなく、**「外部で作ったModelインスタンスをPropsとしてコンポーネントに渡す」** パターンを確立・支援する。

## 4. 推奨ロードマップ (Revised)

1.  **Diffingの実装:** UX維持のため、最低限のDOMパッチ処理を実装する。 (`src/redo/diff.ts`)
2.  **Modelパターンの確立:** クラスベースまたはクロージャベースで「ロジックのインスタンス」を作成し、それをUIにバインドする標準的な書き方をドキュメント化・実装する。
3.  **Context/Eventの洗練:** ロジック側から「どの範囲を再レンダリングするか」を柔軟に指示できるような仕組み（ReactのSelectorに近いが、Push型の通知）の検討。

---
*このレポートは、ユーザーへのヒアリングに基づき、ReDoの独自性と設計思想を反映して更新されました。*