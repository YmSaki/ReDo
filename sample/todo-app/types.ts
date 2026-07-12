// sample/todo-app/types.ts
// Todoアプリで扱うドメイン型の定義

/** 1件のTodoの保存状態（機能3: 非同期の「サーバー保存」の進行状況を表す） */
export type TodoStatus = "idle" | "saving" | "saved" | "error";

/** 1件のTodo */
export type Todo = {
	id: number;
	title: string;
	completed: boolean;
	status: TodoStatus;
};

/** 表示フィルタ（機能6: URLパスと対応する） */
export type Filter = "all" | "active" | "completed";
