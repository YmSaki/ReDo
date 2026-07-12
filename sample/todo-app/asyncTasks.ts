// sample/todo-app/asyncTasks.ts
// 「サーバー保存」を模した非同期タスク（機能3）
//
// setTimeoutベースの疑似遅延Promiseで、3割の確率でわざと失敗させる。
// ctx.run(saveTodoToServer, payload, { success, fail }) の形で使うことで、
// 成功/失敗のfail routingを実演する。

import type { Async } from "../../src/redo";

export type SaveTodoPayload = { id: number; title: string };
export type SaveTodoResult = { id: number };

/** 保存失敗時に投げるエラー。どのTodoの保存に失敗したかをidで持ち回る */
export class SaveTodoError extends Error {
	constructor(public readonly id: number, message: string) {
		super(message);
		this.name = "SaveTodoError";
	}
}

const FAIL_RATE = 0.3;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 900;

/**
 * Todoをサーバーに保存する体で、疑似的な遅延と失敗を発生させる非同期タスク。
 * DOM操作は行わない（ReDoAsyncの契約どおり、ロジック層に徹する）。
 */
export const saveTodoToServer: Async<SaveTodoPayload, SaveTodoResult> = (ctx) => {
	const payload = ctx.payload as SaveTodoPayload;
	const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

	return new Promise<SaveTodoResult>((resolve, reject) => {
		setTimeout(() => {
			if (Math.random() < FAIL_RATE) {
				reject(new SaveTodoError(payload.id, `Todo #${payload.id} の保存に失敗しました（サーバーエラーを模擬）`));
			} else {
				resolve({ id: payload.id });
			}
		}, delay);
	});
};
