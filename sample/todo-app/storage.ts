// sample/todo-app/storage.ts
// 永続化のダミー実装（localStorageのみ。実サーバーは使わない）

import type { Todo } from "./types";

const STORAGE_KEY = "redo-todo-app:todos";

const defaultTodos = (): Todo[] => [
	{ id: 1, title: "ReDoのREADMEを読む", completed: true, status: "saved" },
	{ id: 2, title: "Todoアプリのサンプルを作る", completed: false, status: "saved" },
	{ id: 3, title: "コーヒーを飲む", completed: false, status: "idle" },
];

/** localStorageからTodo一覧を読み込む（無ければ初期データを返す） */
export const loadTodos = (): Todo[] => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return defaultTodos();
		}
		const parsed = JSON.parse(raw) as Todo[];
		// "saving"のまま保存されてしまった項目は、再読み込み時の見た目を整えるためidleに戻す
		return parsed.map((todo) => ({
			...todo,
			status: todo.status === "saving" ? "idle" : todo.status,
		}));
	} catch {
		return defaultTodos();
	}
};

/** Todo一覧をlocalStorageに保存する（ダミー実装。失敗しても無視してアプリの動作は継続する） */
export const saveTodos = (todos: Todo[]): void => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
	} catch {
		// プライベートモード等でlocalStorageが使えない環境でも、アプリ自体は動作を続ける
	}
};
