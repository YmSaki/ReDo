// src/redo/context.ts
// イベントハンドラに渡されるContextクラス

import type { ReDoEvent, ReDoAsync, AsyncRouting } from "./event";
import { enqueue, runAsync, cancelTask } from "./queue";
import { reRender } from "./core";

/**
 * イベントハンドラに渡されるコンテキストオブジェクト
 * イベント間でのデータ受け渡しや、再レンダリング、非同期処理の制御を提供する
 */
export class EventContext<T> {
	/** イベント間で受け渡されるペイロード */
	constructor(public readonly payload?: T) { }

	/**
	 * 次のイベントをキューに追加する
	 * @param event - 実行するイベント関数
	 * @param overridePayload - ペイロードを上書きする場合に指定
	 */
	next<ANEXT_PAYLOAD>(event: ReDoEvent<ANEXT_PAYLOAD>, overridePayload?: ANEXT_PAYLOAD) {
		enqueue(event as ReDoEvent<unknown>, overridePayload);
	}

	/**
	 * 非同期タスクを実行する
	 * @param task - 実行する非同期関数
	 * @param initialPayload - 初期ペイロード
	 * @param routing - 成功/失敗時に実行するイベントのルーティング
	 * @returns タスクID（キャンセル用）
	 */
	run<PAYLOAD, RESULT>(
		task: ReDoAsync<PAYLOAD, RESULT>,
		initialPayload?: PAYLOAD,
		routing?: AsyncRouting<RESULT>,
	): number {
		return runAsync(task, initialPayload, routing);
	}

	/**
	 * 実行中の非同期タスクをキャンセルする
	 * @param taskId - run()で返されたタスクID
	 */
	cancel(taskId: number) {
		cancelTask(taskId);
	}

	/**
	 * デバッグ用のログ出力
	 * @param msg - ログメッセージ
	 */
	log(msg: string) {
		console.log("[ReDo] " + msg);
	}

	/**
	 * アプリケーション全体を再レンダリングする
	 */
	reRender() {
		reRender();
	}
}

export class AsyncContext<T> {
	constructor(public readonly payload?: T) { }

	/**
	 * デバッグ用のログ出力
	 * @param msg - ログメッセージ
	 */
	log(msg: string) {
		console.log("[ReDo] " + msg);
	}
}
