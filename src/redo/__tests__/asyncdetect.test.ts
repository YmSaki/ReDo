// src/redo/__tests__/asyncdetect.test.ts
// 非同期ハンドラ判定 (constructor.name === "AsyncFunction") の壊れやすさに対する
// フォールバックのテスト（Issue #5）
//
// swc/babel等でasync関数が古いターゲットにトランスパイルされたり、
// fn.bind() されたasync関数が渡されたりすると、domeventmanager.ts の
// isAsync 判定（handler.constructor.name === "AsyncFunction"）をすり抜けて
// enqueue（同期経路）に回ってしまう。その場合でも、返り値のPromiseが
// unhandled rejectionとして握り潰されないことを確認する。
//
// queue.ts がモジュールレベル状態（eventQueue, taskTable等）を持つため、
// テスト間の汚染を避けるべく各テストで vi.resetModules() を行い、
// 動的importで毎回フレッシュなモジュールインスタンスを取得する
// （queue.test.ts / lifecycle.test.ts と同様のパターン）。

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// @types/nodeを追加せずにNodeのprocessイベント（unhandledRejection監視）を使うための
// 最小限のローカル型定義。実行環境（vitest環境がhappy-domでもNode上で動く）には
// 実体としてのprocessが存在するため、型だけをここで補う。
type MinimalNodeProcess = {
	on(event: "unhandledRejection", listener: (reason: unknown) => void): void;
	off(event: "unhandledRejection", listener: (reason: unknown) => void): void;
};
const nodeProcess = (globalThis as unknown as { process?: MinimalNodeProcess }).process;

beforeEach(() => {
	vi.resetModules();
});

// マイクロタスクの深さに依存せず、enqueue/runAsyncの完了を確実に待つためのヘルパー
const flushEvents = () => new Promise((resolve) => setTimeout(resolve, 0));

// テストで必要なモジュール一式を、resetModules後にフレッシュな状態で読み込む
async function loadModules() {
	const { h } = await import("../h");
	const { render } = await import("../render");
	const { mount } = await import("../mount");
	const { EventContext, AsyncContext } = await import("../context");
	return { h, render, mount, EventContext, AsyncContext };
}

describe("native async: constructor.nameでの高速パス", () => {
	it("async (ctx) => {...} はrunAsync経由で実行され、AsyncContextを受け取る", async () => {
		const { h, render, mount, AsyncContext } = await loadModules();

		const calls: unknown[] = [];
		const onClick = async (ctx: unknown) => {
			calls.push(ctx);
		};

		const container = document.createElement("div");
		const vnode = render(h("button", { onClick }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		button.dispatchEvent(new Event("click"));

		await flushEvents();

		expect(calls.length).toBe(1);
		// runAsync経由なのでAsyncContextを受け取っているはず
		expect(calls[0]).toBeInstanceOf(AsyncContext);
	});
});

describe("トランスパイル模擬: constructor.nameが\"Function\"だがthenableを返す", () => {
	it("Promiseを返す通常関数がonClickに渡っても、握り潰されず完了を観測できる", async () => {
		const { h, render, mount, EventContext } = await loadModules();

		let receivedCtx: unknown;
		let observedResult: unknown;

		// swc等がasyncを古いターゲットに落とした場合を模擬:
		// constructor.name は "Function" になるが、実体はPromiseを返す
		function transpiledHandler(ctx: unknown) {
			receivedCtx = ctx;
			const p = Promise.resolve("x");
			// フレームワークの追跡とは独立に、テスト側からも完了を観測できることを確認する
			p.then((v) => {
				observedResult = v;
			});
			return p;
		}
		expect(transpiledHandler.constructor.name).toBe("Function");

		const container = document.createElement("div");
		const vnode = render(h("button", { onClick: transpiledHandler }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		// 同期的なdispatchEvent自体は例外を投げない
		expect(() => button.dispatchEvent(new Event("click"))).not.toThrow();

		await flushEvents();

		// isAsync判定をすり抜けているので、enqueue経路（EventContext）で実行される
		expect(receivedCtx).toBeInstanceOf(EventContext);
		// 返り値のPromiseはフレームワークに邪魔されずに正常に解決している
		expect(observedResult).toBe("x");
	});
});

describe("rejectionの非握り潰し", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let unhandledRejectionSpy: ReturnType<typeof vi.fn<(reason: unknown) => void>>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		unhandledRejectionSpy = vi.fn((_reason: unknown) => {});
		nodeProcess?.on("unhandledRejection", unhandledRejectionSpy);
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		nodeProcess?.off("unhandledRejection", unhandledRejectionSpy);
	});

	it("トランスパイル模擬ハンドラがrejectしても、unhandled rejectionにならずconsole.errorで報告される", async () => {
		const { h, render, mount } = await loadModules();

		// constructor.name は "Function" のまま、reject するPromiseを返す
		function transpiledRejectingHandler() {
			return Promise.reject(new Error("boom"));
		}
		expect(transpiledRejectingHandler.constructor.name).toBe("Function");

		const container = document.createElement("div");
		const vnode = render(h("button", { onClick: transpiledRejectingHandler }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		button.dispatchEvent(new Event("click"));

		await flushEvents();
		// unhandledRejectionイベントが発火する場合、通常は次のマイクロタスク/タスクで
		// 報告されるため、念のためもう一度待つ
		await flushEvents();

		expect(unhandledRejectionSpy).not.toHaveBeenCalled();
		expect(consoleErrorSpy).toHaveBeenCalled();
		const reportedArgs = consoleErrorSpy.mock.calls[0];
		expect(String(reportedArgs[0])).toContain("[ReDo]");
	});
});

describe("純同期ハンドラ", () => {
	it("(ctx) => {...} は従来どおりenqueueで同期実行され、EventContextを受け取る", async () => {
		const { h, render, mount, EventContext } = await loadModules();

		const calls: unknown[] = [];
		const onClick = (ctx: unknown) => {
			calls.push(ctx);
		};
		expect(onClick.constructor.name).toBe("Function");

		const container = document.createElement("div");
		const vnode = render(h("button", { onClick }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		button.dispatchEvent(new Event("click"));

		await flushEvents();

		expect(calls.length).toBe(1);
		expect(calls[0]).toBeInstanceOf(EventContext);
	});
});

describe("bind済みasync関数", () => {
	let unhandledRejectionSpy: ReturnType<typeof vi.fn<(reason: unknown) => void>>;

	beforeEach(() => {
		unhandledRejectionSpy = vi.fn((_reason: unknown) => {});
		nodeProcess?.on("unhandledRejection", unhandledRejectionSpy);
	});

	afterEach(() => {
		nodeProcess?.off("unhandledRejection", unhandledRejectionSpy);
	});

	it("(async (ctx) => {...}).bind(null) でも例外を出さず、rejectしても外へ漏れない（安全側に倒れる）", async () => {
		const { h, render, mount } = await loadModules();

		const calls: unknown[] = [];
		const boundHandler = (async (ctx: unknown) => {
			calls.push(ctx);
			throw new Error("bound-boom");
		}).bind(null);

		// 検証環境（V8/happy-dom）では、ネイティブasync関数をbind()しても
		// constructor.nameは"AsyncFunction"のまま保たれ、isAsync判定はすり抜けない
		// （= runAsync経路を通る）ことが確認できる。
		// Issue #5が想定する「bind()でconstructor.nameが壊れるエンジン/変換系」でも
		// 同じ結果になることを保証するのがこのテストの目的なので、
		// どちらの経路を通っても例外が漏れず、rejectがunhandled rejectionに
		// ならないことだけを検証する（経路そのものはアサートしない）。
		const container = document.createElement("div");
		const vnode = render(h("button", { onClick: boundHandler }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		expect(() => button.dispatchEvent(new Event("click"))).not.toThrow();

		await flushEvents();
		await flushEvents();

		expect(calls.length).toBe(1);
		expect(unhandledRejectionSpy).not.toHaveBeenCalled();
	});

	it("bind()後にconstructor.nameが\"Function\"になるケース（トランスパイル+bind相当）でもrejectが握り潰されない", async () => {
		const { h, render, mount } = await loadModules();
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		// トランスパイルされたasync関数（＝普通のFunction）をbind()したケースを模擬。
		// 通常関数のbind()結果は常にconstructor.name === "Function"になるため、
		// エンジンに依存せずisAsync判定をすり抜けるケースを再現できる。
		function plainHandler() {
			return Promise.reject(new Error("bound-transpiled-boom"));
		}
		const boundHandler = plainHandler.bind(null);
		expect(boundHandler.constructor.name).toBe("Function");

		const container = document.createElement("div");
		const vnode = render(h("button", { onClick: boundHandler }));
		mount(vnode, container);

		const button = container.firstElementChild as HTMLElement;
		expect(() => button.dispatchEvent(new Event("click"))).not.toThrow();

		await flushEvents();
		await flushEvents();

		expect(unhandledRejectionSpy).not.toHaveBeenCalled();
		expect(consoleErrorSpy).toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});
});
