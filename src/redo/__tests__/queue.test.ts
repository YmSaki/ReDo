// src/redo/__tests__/queue.test.ts
// queue.ts のスモークテスト
//
// queue.ts はモジュールレベルの状態（eventQueue, taskTable, isFlushing など）を
// 持っているため、テスト間の汚染を避けるために各テストで vi.resetModules() を行い、
// 動的 import で毎回フレッシュなモジュールインスタンスを取得する。

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReDoEvent, ReDoAsync } from "../event";

beforeEach(() => {
	vi.resetModules();
});

describe("queue: 順序保証", () => {
	it("enqueue(A); enqueue(B) はマイクロタスク後に A, B の順で実行される", async () => {
		const { enqueue } = await import("../queue");

		const order: string[] = [];
		const A: ReDoEvent = () => order.push("A");
		const B: ReDoEvent = () => order.push("B");

		enqueue(A, undefined);
		enqueue(B, undefined);

		// マイクロタスクキューに積まれただけで、まだ同期的には実行されない
		expect(order).toEqual([]);

		// flush はマイクロタスクとしてスケジュールされているので待つ
		await Promise.resolve();
		await Promise.resolve();

		expect(order).toEqual(["A", "B"]);
	});
});

describe("queue: 再入（スナップショット方式）", () => {
	it("イベントA実行中にctx.next(B)しても、Bは同一フラッシュ内では実行されない", async () => {
		const { enqueue } = await import("../queue");

		const order: string[] = [];
		const B: ReDoEvent = () => order.push("B");
		const A: ReDoEvent = (ctx) => {
			order.push("A");
			ctx.next(B);
			// A実行中（同一フラッシュ内）はBはまだ実行されていないはず
			expect(order).toEqual(["A"]);
		};

		enqueue(A, undefined);

		// 1回目のフラッシュ（Aのみを含むスナップショット）が完了した直後。
		// enqueue()はflush中でも同期的にscheduleFlush()するため、Bの実行は
		// 既に次のマイクロタスクとしてスケジュール済みだが、まだ実行されてはいない。
		await Promise.resolve();
		expect(order).toEqual(["A"]);

		// 2回目のフラッシュ: A実行中にenqueueされたBが実行される
		await Promise.resolve();
		expect(order).toEqual(["A", "B"]);
	});
});

describe("queue: 非同期ルーティング", () => {
	// マイクロタスクの深さに依存せず、非同期タスクの完了を確実に待つためのヘルパー
	const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("runAsync成功時にrouting.successが結果payload付きで呼ばれる", async () => {
		const { runAsync } = await import("../queue");

		let received: unknown = undefined;
		let calledWithCtx = false;
		const success: ReDoEvent<string> = (ctx) => {
			received = ctx.payload;
			calledWithCtx = true;
		};
		const fail: ReDoEvent<unknown> = () => {
			throw new Error("failは呼ばれてはいけない");
		};

		const asyncTask: ReDoAsync<void, string> = async () => "hello-async";

		runAsync(asyncTask, undefined, { success, fail });

		await flushAsync();

		expect(calledWithCtx).toBe(true);
		expect(received).toBe("hello-async");
	});

	it("cancelTask後はsuccess/failのどちらも呼ばれない", async () => {
		const { runAsync, cancelTask } = await import("../queue");

		let successCalled = false;
		let failCalled = false;
		const success: ReDoEvent<string> = () => {
			successCalled = true;
		};
		const fail: ReDoEvent<unknown> = () => {
			failCalled = true;
		};

		const asyncTask: ReDoAsync<void, string> = async () => "should-not-arrive";

		const taskId = runAsync(asyncTask, undefined, { success, fail });
		cancelTask(taskId);

		await flushAsync();

		expect(successCalled).toBe(false);
		expect(failCalled).toBe(false);
	});
});
