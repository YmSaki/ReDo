# ReDo Todo サンプル (Issue #14)

ReDoフレームワークの主要機能（バニラ状態管理、同期/非同期イベント、`List`によるkeyed diff、
island部分再描画、`redo-router`）を1つのTodoアプリとして実演するサンプルです。

## 起動方法

このディレクトリ(`sample/todo-app`)で、専用の`vite.config.ts`を使って起動します
（追加の依存インストールは不要。`vite`はリポジトリの既存devDependency）。

```sh
cd sample/todo-app
npx vite
```

ブラウザで以下を開いてください。

```
http://localhost:3001/
```

- ポートは`sample/todo-app/vite.config.ts`の設定で`3001`固定です。空いていない場合は
  `npx vite --port <空いているポート>` を指定してください。
- データは`localStorage`（キー: `redo-todo-app:todos`）に保存されます。ブラウザのlocalStorageを
  クリアすると初期データにリセットされます。

### なぜリポジトリルートの `npx vite` では動かないか

`redo-router`（`ReDoRouter`）は`window.location.pathname`を`"/"` / `"/active"` / `"/completed"`
という**ルート絶対パス**と直接比較する作りです。リポジトリルートのvite設定で
`http://localhost:3000/sample/todo-app/index.html`のようにネスト配信すると、実際の
pathnameは`/sample/todo-app/index.html`になってしまい、どのルートにもマッチせず
404相当（`fallback`コンポーネント）が表示されます（実装時にPlaywrightで実際に
ブラウザ操作して発覚した不具合で、`sample/todo-app/vite.config.ts`を追加して
解消しています）。

そのため本サンプルは`sample/todo-app`を vite の`root`とする専用設定で単独のSPAとして
起動します。こうすると`index.html`がそのルートの`"/"`となり、`redo-router`の絶対パス
前提と一致します。devサーバーは既定でSPAとして振る舞うため、`/active`への直接アクセスや
ブラウザバックでも`index.html`にフォールバックされ、`pushState`ベースのルーティングが
正しく動作します。

`jsxInject`もこの専用設定内で相対パス（`../../src/redo/h`）に調整し、`server.fs.allow`で
リポジトリルート（`../../src`など）への読み取りを許可しています。詳細は
`sample/todo-app/vite.config.ts`のコメントを参照してください。

### 動作確認のポイント

- **編集(uncontrolled input)**: 各行の「タイトルを編集...」欄に文字を入力 → 「保存」を押すと
  ステータスが「保存中...」→「保存済み」または「保存失敗」に変わります（3割の確率でわざと失敗する
  ように実装しています。失敗時は「再試行」ボタンが出ます）。
- **並び替え/フィルタでも入力中の値が消えないこと**: 複数行の編集欄に別々の文字を入力した状態で
  「🔀 表示順をシャッフル」を押す、または上部ナビで「未完了」⇄「すべて」を切り替えると、
  各行の入力値がDOMごと正しい項目についてくることを確認できます。
- **island独立性**: 各islandの右上/右下に表示される「list再描画回数」「summary再描画回数」を見ながら
  操作すると、例えば編集保存やフィルタ切り替えでは`list再描画回数`だけが増え、
  `summary再描画回数`は増えないことが確認できます（完了トグル・追加・削除では両方増えます）。
- **ルーティング**: 上部ナビのリンクでURLが`/`, `/active`, `/completed`に変わり、ブラウザの
  戻る/進むボタンでもフィルタが連動して切り替わります。

## ファイル構成と機能対応表

| ファイル | 役割 | 対応する機能 |
| --- | --- | --- |
| `types.ts` | `Todo` / `TodoStatus` / `Filter` の型定義 | (共通) |
| `storage.ts` | `localStorage`への保存・読み込み（ダミー永続化） | (制約: 永続化はlocalStorageでよい) |
| `asyncTasks.ts` | `saveTodoToServer`: `setTimeout`ベースの疑似サーバー保存タスク（3割の確率で失敗） | **機能3**（非同期イベントの分離） |
| `router.ts` | `ReDoRouter`インスタンスの生成、URLパス⇔`Filter`の対応付け | **機能6**（redo-router） |
| `store.tsx` | `TodoStore`コントローラclass。`todos`状態、同期イベント（追加/トグル/削除/編集）、`ctx.run`による非同期保存、`ListView`/`SummaryView`の2つの島 | **機能1, 2, 3, 5** |
| `TodoApp.tsx` | ルートコンポーネント。`router.Link`/`router.Router`の配置、Todo追加フォーム、3つ目の島(`FilterNavView`) | **機能5, 6** |
| `main.tsx` | エントリポイント。`init()`と`ReDoRouter`の配線、URL⇔`store.filter`の同期 | **機能6** |
| `index.html` | 最小限のHTML + インラインCSS | - |
| `vite.config.ts` | このサンプル専用のvite設定（root固定・jsxInject相対パス化・fs.allow） | (起動用。redo-routerの絶対パス前提を成立させるため) |

### 機能ごとの実装箇所（詳細）

1. **バニラ状態（コントローラclass）**
   `store.tsx`の`TodoStore`クラスが`todos`配列・`filter`・`nextId`などを素のプロパティとして持つ。
   hooksやストアライブラリは一切使用していない。

2. **同期イベント**
   `TodoStore#addTodo` / `toggleTodo` / `deleteTodo` / `saveEdit` はいずれも
   `ReDoEvent`（`(ctx: Context<T>) => void`）として実装。状態変更後に
   `this.reRenderList()` / `this.reRenderSummary()`（`makeReRender`経由の`reRenderIsland`）で
   反映する。`TodoApp.tsx`側の各`onClick`は`ctx.next(store.xxx, payload)`で次のイベントとして発火する。

3. **非同期イベントの分離**
   `asyncTasks.ts`の`saveTodoToServer`（`ReDoAsync`）を、`addTodo` / `saveEdit` / `retrySave`から
   `ctx.run(saveTodoToServer, payload, { success, fail })`で呼び出す。3割の確率で
   `SaveTodoError`を投げて失敗させ、`fail`ルーティング（`handleSaveFail`）を実演する。
   Todoごとの`status`（`saving` / `saved` / `error`）を専用のステータス表示として
   `ListView`内に描画する。

4. **List + keyed diff + uncontrolled input**
   `ListView`内で`List({ items, keyExtractor, renderItem })`（`src/redo/list.ts`）を使用。
   各行の編集用`<input>`はvalueをpropsとして与えず、`onMount`で一度だけDOMへ直接値を注入し
   （`TodoStore#registerEditInput`）、以後の再描画では一切触れない完全なuncontrolled構成。
   「🔀 表示順をシャッフル」ボタン（`shuffleTodos`）で実際に配列の並びを変える操作を用意しており、
   フィルタ切り替え（表示件数・順序が変わる）と合わせて、`Test.tsx`のシャッフル実験と同じ精神で
   DOM再利用（＝入力中の値がその項目についてくること）を確認できる。

5. **島(island)による部分再描画**
   `store.tsx`の`ListView`（Todoリスト本体）と`SummaryView`（残タスク数などのサマリ）が
   独立した2つの島。加えて`TodoApp.tsx`の`FilterNavView`（フィルタナビのハイライト）も
   3つ目の島として存在する。件数に影響しない変更（編集の保存状態、フィルタ切り替え、
   シャッフル）は`reRenderList()`のみを呼び、`SummaryView`は再描画されない。
   逆に完了トグル・追加・削除は件数が変わるため両方を再描画する。
   各Viewは呼ばれるたびに再描画回数を数えて画面に表示しており（`list再描画回数` /
   `summary再描画回数`）、この独立性を目視で確認できる。

6. **redo-router**
   `router.ts`で`new ReDoRouter()`を生成し、`main.tsx`で`init()`が返す`App`を
   `router.connect(app)`で接続している。`TodoApp.tsx`の`router.Router`に
   `/`（All） / `/active`（Active） / `/completed`（Completed）の3ルート＋`fallback`（404）を
   登録し、`router.Link`でナビゲーションする。
   island（`ListView`/`FilterNavView`）は親からのprops自動伝播をしない設計
   （`src/redo/island.ts`のBOUNDARY分岐を参照）のため、`main.tsx`で
   `router.navigate`をラップして`store.setFilter()` + `reRenderIsland(FilterNavView)`を
   明示的に呼び、ブラウザの戻る/進む（`popstate`）でも同様に同期している
   （`router.ts`自体は変更していない）。

## 検証結果（実装時に確認済み）

- `npx tsc --noEmit`: `sample/`配下のエラーはなし（`src/App.tsx`の既存エラー2件のみ残存、本サンプルとは無関係）。
- `npm test`: 既存51件すべて成功（回帰なし）。
- `sample/todo-app`ディレクトリで`npx vite`を起動し、Playwright（実ブラウザ）で以下を
  実際に操作して確認済み:
  - 初回表示（ナビ・追加フォーム・サマリ島・リスト島）が正しく描画される
  - Todoを追加すると一覧に即反映され（楽観的更新）、ステータスが「保存中...」→
    「保存済み」（または3割の確率で「保存失敗」＋「再試行」ボタン）に変わる
  - 複数行の編集欄に別々の文字を入力した状態で「🔀 表示順をシャッフル」を押しても、
    各行の入力値がDOMごと正しい項目についてくる（uncontrolled inputのDOM再利用）
  - シャッフル・編集保存では`list再描画回数`のみが増え、`summary再描画回数`は
    変化しない（island独立性）。完了トグルでは両方の再描画回数が増え、件数表示も
    正しく更新される
  - 上部ナビの「未完了」クリックでURLが`/active`に変わり、該当するTodoのみ表示される。
    ブラウザの「戻る」でも`/`に戻り一覧表示に復帰する
  - コンソールにJSエラーが出ない
