// sample/todo-app/TodoApp.tsx
// ルートコンポーネント。
// - router.Link によるフィルタ切り替えナビゲーション、router.Router によるルーティング（機能6）
// - Todo追加フォーム（uncontrolled input + 非同期保存。機能3, 4）
// - 島(list island, summary island, nav island)の配置（機能5）
//
// 島(list/summary/nav)は親からのprops自動伝播をしない設計(src/redo/island.ts)のため、
// URLパス→filterの反映はmain.tsxが明示的にstore.setFilter()とreRenderIsland(FilterNavView)を
// 呼んで同期している。このファイル自体はViewの組み立てだけに専念する。

import { island } from "../../src/redo";
import type { Component, Context } from "../../src/redo";
import { router, filterToPath } from "./router";
import { store } from "./store";
import type { Filter } from "./types";

const FILTERS: { label: string; value: Filter }[] = [
	{ label: "すべて", value: "all" },
	{ label: "未完了", value: "active" },
	{ label: "完了済み", value: "completed" },
];

/**
 * フィルタナビゲーションの島（機能5: 3つ目の独立したisland）。
 * router.Link自体は{to:string}以外の余分なpropsを受け付けない作りなので、
 * 選択中のハイライトは<span>側でclassを切り替えて表現する。
 * main.tsx が router.navigate をラップして、Linkクリック・ブラウザバックの
 * どちらでも store.filter の更新と同時にこの島を明示的に再描画する。
 */
export const FilterNavView: Component = () => (
	<nav class="filter-nav">
		{FILTERS.map((f) => (
			<span key={f.value} class={store.filter === f.value ? "filter-link active" : "filter-link"}>
				<router.Link to={filterToPath(f.value)}>{f.label}</router.Link>
			</span>
		))}
	</nav>
);

const NotFound: Component = () => (
	<div class="not-found">
		<p>ページが見つかりません。</p>
		<router.Link to="/">トップに戻る</router.Link>
	</div>
);

/**
 * Todo追加フォーム。uncontrolled input（機能4と同じ考え方）: valueをstateと同期させず、
 * ボタンクリック時にDOMから直接値を読み取ってから店の追加イベントへ渡す。
 * <form onSubmit>ではなく<button type="button" onClick>にしているのは、
 * ReDoのイベントはマイクロタスクへ一旦キューイングされてから実行されるため
 * （src/redo/queue.ts参照）、`submit`のようにブラウザの既定動作（ページ遷移）を
 * 同期的にpreventDefaultできないと事故る類のイベントを避けるため（App.tsx/Test.tsxも
 * 同じ理由でbuttonクリックのみを使っている）。
 */
const AddTodoForm: Component = () => (
	<div class="add-form">
		<input id="new-todo-input" class="new-todo-input" placeholder="やることを入力..." autocomplete="off" />
		<button
			type="button"
			onClick={(ctx: Context<Event>) => {
				const input = document.getElementById("new-todo-input") as HTMLInputElement | null;
				if (!input) {
					return;
				}
				const title = input.value.trim();
				if (!title) {
					return;
				}
				// uncontrolled inputなので、送信後はDOMを直接クリアする（機能4と同じ考え方）
				ctx.next(store.addTodo, title);
				input.value = "";
			}}
		>
			追加（サーバー保存あり）
		</button>
	</div>
);

// 3つのURLパスはすべて同じTodoPageを指す。フィルタの絞り込み自体はstore.filter
// （main.tsxによってURLと同期される）をisland側で読んで行うため、ルートコンポーネント
// 自体に差分はない（それでもrouter.Routerのルート定義・fallbackはきちんと使う）。
const TodoPage: Component = () => (
	<>
		<AddTodoForm />
		{island(store.SummaryView)}
		{island(store.ListView)}
	</>
);

export const TodoApp: Component = () => (
	<div class="todo-app">
		<h1>ReDo Todo サンプル</h1>
		{island(FilterNavView)}
		<router.Router
			routes={[
				{ path: "/", component: TodoPage },
				{ path: "/active", component: TodoPage },
				{ path: "/completed", component: TodoPage },
			]}
			fallback={NotFound}
		/>
	</div>
);
