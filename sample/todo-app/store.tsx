// sample/todo-app/store.tsx
// TodoStoreコントローラ + 2つの島(List/Summary)のView（機能1, 2, 3, 5）
//
// - TodoStoreは普通のclass。todos配列などの状態をフィールドとして持つだけで、
//   hooksやストアライブラリの類は一切使わない（機能1）。
// - 追加/トグル完了/削除/編集はReDoEventとして実装し、状態を変更した後に
//   this.reRenderXxx()（= makeReRender(View) 経由の reRenderIsland）でその場で反映する（機能2）。
// - 追加/編集の確定は「サーバー保存」を模した非同期タスク(asyncTasks.ts)をctx.runで実行し、
//   success/failで結果を反映する。保存状況はTodoごとのstatusとして画面に表示する（機能3）。
// - ListViewとSummaryViewは独立した2つの島。件数に影響しない変更（編集中の保存状態、
//   フィルタの絞り込み、並び替え）はListViewだけを再描画し、SummaryViewには一切触れない（機能5）。
//   各Viewは呼ばれるたびに再描画回数をカウントしており、画面上でその独立性を目視確認できる。

import { makeReRender } from "../../src/redo";
import { List } from "../../src/redo";
import type { Component, Context } from "../../src/redo";
import type { Todo, TodoStatus, Filter } from "./types";
import { loadTodos, saveTodos } from "./storage";
import { saveTodoToServer, SaveTodoError } from "./asyncTasks";
import type { SaveTodoResult } from "./asyncTasks";

const statusLabel = (status: TodoStatus): string => {
	switch (status) {
		case "saving":
			return "保存中...";
		case "saved":
			return "保存済み";
		case "error":
			return "保存失敗";
		default:
			return "";
	}
};

export class TodoStore {
	todos: Todo[] = loadTodos();
	filter: Filter = "all";

	// 編集用input(uncontrolled)のDOM参照。現在の入力値を読み取るためだけに使う（機能4）
	private editInputRefs = new Map<number, HTMLInputElement>();

	private nextId = this.todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

	// Viewが呼ばれた回数（island独立性を目視確認するための可視カウンタ。機能5）
	private listRenderCount = 0;
	private summaryRenderCount = 0;

	// === 島その1: Todoリスト本体（機能4, 5） ===
	ListView: Component = () => {
		this.listRenderCount++;
		const filtered = this.getFilteredTodos();

		return (
			<div class="island todo-list-island">
				<div class="list-toolbar">
					<button type="button" onClick={this.shuffleTodos}>
						🔀 表示順をシャッフル（並び替え確認用）
					</button>
					<span class="render-count">list再描画回数: {this.listRenderCount}</span>
				</div>

				{List({
					items: filtered,
					keyExtractor: (todo) => todo.id,
					renderItem: (todo) => (
						<div class="todo-row">
							<input
								type="checkbox"
								class="toggle"
								checked={todo.completed}
								onChange={(ctx: Context<Event>) => ctx.next(this.toggleTodo, todo.id)}
							/>

							{/*
								uncontrolled input: valueをpropsとして与えず、onMountで一度だけDOMに直接
								初期値を注入する。以降の再描画（フィルタ切り替え・シャッフル・他の項目の
								完了トグルなど）ではこのinputのvalue propに一切触れないため、DOMノードさえ
								使い回されれば入力中の文字は必ずそのDOMノードに付いてくる。
							*/}
							<input
								type="text"
								class="edit-input"
								placeholder="タイトルを編集..."
								onMount={this.registerEditInput(todo.id)}
								onUnmount={this.unregisterEditInput(todo.id)}
							/>

							<span class={`status status-${todo.status}`}>{statusLabel(todo.status)}</span>

							<button type="button" onClick={(ctx: Context<Event>) => ctx.next(this.saveEdit, todo.id)}>
								保存
							</button>

							{todo.status === "error" && (
								<button type="button" onClick={(ctx: Context<Event>) => ctx.next(this.retrySave, todo.id)}>
									再試行
								</button>
							)}

							<button type="button" onClick={(ctx: Context<Event>) => ctx.next(this.deleteTodo, todo.id)}>
								削除
							</button>
						</div>
					),
				})}

				{filtered.length === 0 && <p class="empty-hint">このフィルタに該当するタスクはありません</p>}
			</div>
		);
	};

	// === 島その2: 件数サマリ（機能5） ===
	SummaryView: Component = () => {
		this.summaryRenderCount++;
		const total = this.todos.length;
		const active = this.todos.filter((t) => !t.completed).length;
		const completed = total - active;

		return (
			<div class="island todo-summary-island">
				<strong>{active}</strong> 件が未完了 / 全{total}件（完了{completed}件）
				<span class="render-count">summary再描画回数: {this.summaryRenderCount}</span>
			</div>
		);
	};

	// === 同期イベント（機能2） ===

	/** 追加。楽観的に一覧へ入れてから、非同期の「サーバー保存」を実行する（機能3） */
	addTodo = (ctx: Context<string>) => {
		const title = (ctx.payload ?? "").trim();
		if (!title) {
			return;
		}
		const todo: Todo = { id: this.nextId++, title, completed: false, status: "saving" };
		this.todos.push(todo);
		this.persist();
		this.reRenderList();
		this.reRenderSummary();

		ctx.run(saveTodoToServer, { id: todo.id, title }, {
			success: this.handleSaveSuccess,
			fail: this.handleSaveFail,
		});
	};

	/** 完了トグル。件数が変わるのでList/Summaryの両方を再描画する */
	toggleTodo = (ctx: Context<number>) => {
		const todo = this.todos.find((t) => t.id === ctx.payload);
		if (!todo) {
			return;
		}
		todo.completed = !todo.completed;
		this.persist();
		this.reRenderList();
		this.reRenderSummary();
	};

	/** 削除。件数が変わるのでList/Summaryの両方を再描画する */
	deleteTodo = (ctx: Context<number>) => {
		this.todos = this.todos.filter((t) => t.id !== ctx.payload);
		this.persist();
		this.reRenderList();
		this.reRenderSummary();
	};

	/**
	 * 編集の確定。uncontrolled inputの現在値をDOM参照から直接読み取り（機能4）、
	 * 非同期の「サーバー保存」を実行する（機能3）。タイトル変更は件数に影響しないので
	 * Listだけを再描画し、Summaryには触れない（機能5の実演ポイント）。
	 */
	saveEdit = (ctx: Context<number>) => {
		const id = ctx.payload;
		const todo = this.todos.find((t) => t.id === id);
		const input = this.editInputRefs.get(id!);
		if (!todo || !input) {
			return;
		}
		const title = input.value.trim();
		if (!title || title === todo.title) {
			return;
		}
		todo.title = title;
		todo.status = "saving";
		this.persist();
		this.reRenderList();

		ctx.run(saveTodoToServer, { id: todo.id, title }, {
			success: this.handleSaveSuccess,
			fail: this.handleSaveFail,
		});
	};

	/** 保存失敗時の再試行（機能3のfail routingから再度runする） */
	retrySave = (ctx: Context<number>) => {
		const todo = this.todos.find((t) => t.id === ctx.payload);
		if (!todo) {
			return;
		}
		todo.status = "saving";
		this.reRenderList();

		ctx.run(saveTodoToServer, { id: todo.id, title: todo.title }, {
			success: this.handleSaveSuccess,
			fail: this.handleSaveFail,
		});
	};

	// === 非同期完了時のハンドラ（機能3） ===
	// ctx.payloadは非同期処理の結果・エラーであってDOM要素ではないため、
	// this.reRenderList()（= reRenderIsland(this.ListView)）だけが確実に正しい島を再描画できる。

	private handleSaveSuccess = (ctx: Context<SaveTodoResult>) => {
		const todo = this.todos.find((t) => t.id === ctx.payload?.id);
		if (!todo) {
			return;
		}
		todo.status = "saved";
		this.persist();
		this.reRenderList();
	};

	private handleSaveFail = (ctx: Context<Error>) => {
		const error = ctx.payload;
		if (!(error instanceof SaveTodoError)) {
			return;
		}
		const todo = this.todos.find((t) => t.id === error.id);
		if (!todo) {
			return;
		}
		todo.status = "error";
		this.persist();
		this.reRenderList();
	};

	/** 表示順のシャッフル（並び替え）。件数もフィルタも変わらないのでListだけを再描画する（機能4の実演） */
	shuffleTodos = (ctx: Context<Event>) => {
		const arr = this.todos;
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		this.reRenderList();
	};

	/**
	 * フィルタを切り替える（機能6用。router.ts / main.tsx から呼ばれる）。
	 * 件数は変わらないのでListだけを再描画する。
	 */
	setFilter = (filter: Filter): void => {
		if (this.filter === filter) {
			return;
		}
		this.filter = filter;
		this.reRenderList();
	};

	private getFilteredTodos(): Todo[] {
		switch (this.filter) {
			case "active":
				return this.todos.filter((t) => !t.completed);
			case "completed":
				return this.todos.filter((t) => t.completed);
			default:
				return this.todos;
		}
	}

	private registerEditInput = (id: number) => (ctx: Context<HTMLElement | Text>) => {
		const el = ctx.payload as HTMLInputElement;
		const todo = this.todos.find((t) => t.id === id);
		el.value = todo?.title ?? "";
		this.editInputRefs.set(id, el);
	};

	private unregisterEditInput = (id: number) => () => {
		this.editInputRefs.delete(id);
	};

	private persist(): void {
		saveTodos(this.todos);
	}

	// 島だけを再描画する。中身はreRenderIsland(this.XxxView)を呼ぶだけ（機能5）
	reRenderList = makeReRender(this.ListView);
	reRenderSummary = makeReRender(this.SummaryView);
}

// コントローラのインスタンスはコンポーネント関数の外で保持する
// （islandはView関数をキーに1つのマウントとして管理するため、
//   再描画のたびに new TodoStore() すると別の島として扱われてしまう）
export const store = new TodoStore();
