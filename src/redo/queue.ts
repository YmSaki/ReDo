// src/redo/queue.ts
// イベントキューシステムと非同期タスク管理

import { EventContext, AsyncContext } from "./context";
import type { ReDoEvent, ReDoAsync, AsyncRouting } from "./event";

/**
 * イベントキューのアイテム
 */
export type QueueItem = {
	event: ReDoEvent<any>;
	payload: any;
};

// イベントキュー（同期イベントをバッチ処理するための配列）
const eventQueue: QueueItem[] = [];
// 非同期タスク管理テーブル（タスクIDとキャンセル状態を管理）
const taskTable = new Map<number, { canceled: boolean }>();

// 非同期タスクに割り振るID（インクリメント）
let taskIdCounter = 0;
// イベントキューの実行中フラグ（再入防止用）
let isFlushing = false;

/**
 * 同期イベントをキューに追加する
 * イベントはマイクロタスクキューでバッチ処理され、順序保証されて実行される
 *
 * @param event - 実行する同期イベント関数
 * @param payload - イベントに渡すデータ
 */
export const enqueue = <T>(event: ReDoEvent<T>, payload: T) => {
	eventQueue.push({ event, payload });
	scheduleFlush();
}

/**
 * 非同期タスクを実行する
 * 将来的にはWeb Workerで実行される予定
 *
 * @param asyncFn - 実行する非同期関数
 * @param payload - 初期ペイロード
 * @param routing - 成功/失敗時に実行するイベントのルーティング
 * @returns タスクID（キャンセル用）
 */
export const runAsync = <P, R>(
	asyncFn: ReDoAsync<P, R>,
	payload?: P,
	routing?: AsyncRouting<R>,
): number => {
	// タスクIDを発行してテーブルに登録
	const taskId = ++taskIdCounter;
	taskTable.set(taskId, { canceled: false });

	const ctx = new AsyncContext(payload);

	// 非同期関数を実行
	asyncFn(ctx)
		.then((result) => {
			const record = taskTable.get(taskId);
			// キャンセルされていたら何もしない
			if (!record || record?.canceled) {
				return;
			}

			// 成功時のイベントをキューに追加（UI層に戻る）
			if (routing?.success) {
				enqueue(routing.success, result);
			}
			taskTable.delete(taskId);
		})
		.catch((error) => {
			const record = taskTable.get(taskId);
			// キャンセルされていたら何もしない
			if (!record || record?.canceled) {
				return;
			}
			// 失敗時のイベントをキューに追加（UI層に戻る）
			if (routing?.fail) {
				enqueue(routing.fail, error);
			}
			taskTable.delete(taskId);
		})

	return taskId;
}

/**
 * 実行中の非同期タスクをキャンセルする
 * @param taskId - runAsync()で返されたタスクID
 */
export const cancelTask = (taskId: number) => {
	const record = taskTable.get(taskId);
	if (!record) {
		return;
	}
	// キャンセルフラグを立てる（Promise完了時にチェックされる）
	record.canceled = true;
}

/**
 * イベントキューのフラッシュをマイクロタスクとしてスケジュールする
 * Promise.resolve().then() を使うことで、同一タスク内の複数のイベントをバッチ処理する
 */
const scheduleFlush = () => {
	Promise.resolve().then(flush);
}

/**
 * イベントキューを実行する
 * - 再入防止: 実行中に新たなイベントが追加されても、次のフレームで処理される
 * - スナップショット方式: 実行中のイベントが新規イベントを追加しても、既存イベントには影響しない
 */
const flush = () => {
	// 既に実行中なら何もしない（再入防止）
	if (isFlushing) {
		return;
	}
	isFlushing = true;

	try {
		// 現在のキューをスナップショット
		const currentFrame = [...eventQueue];
		eventQueue.length = 0;

		// キュー内のイベントを順番に実行
		for (const item of currentFrame) {
			const ctx = new EventContext(item.payload);
			item.event(ctx);
		}
	}
	finally {
		isFlushing = false;
		// 実行中に新たなイベントが追加されていたら、次のフレームで実行
		if (eventQueue.length > 0) {
			scheduleFlush();
		}
	}
}
