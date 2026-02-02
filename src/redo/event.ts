// src/redo/event.ts
// イベントハンドラの型定義

import type { AsyncContext, EventContext } from "./context";

/**
 * 同期イベントハンドラの型（UI層）
 * - DOM操作や状態更新など、軽量で即座に完了する処理に使用
 * - async/awaitは使用不可（型定義で強制）
 * - イベントキューで順序保証されて実行される
 */
export type ReDoEvent<T = void> = (ctx: EventContext<T>) => void;

/**
 * 非同期イベントハンドラの型（ロジック層）
 * - API呼び出しや重いデータ処理に使用
 * - 将来的にWeb Workerで実行される予定
 * - DOM操作は禁止（Worker環境ではDOMにアクセスできないため）
 *
 * @template T - 非同期処理の戻り値の型
 */
export type ReDoAsync<TPayload = void, TResult = unknown> = (ctx: AsyncContext<TPayload>) => Promise<TResult>;

/**
 * 非同期タスクの完了時に実行するイベントのルーティング
 */
export type AsyncRouting<TResult = unknown, TError = Error> = {
	/** タスクが成功した時に実行するイベント（結果がpayloadに渡される） */
	success?: ReDoEvent<TResult>;
	/** タスクが失敗した時に実行するイベント（エラーがpayloadに渡される） */
	fail?: ReDoEvent<TError>;
};
