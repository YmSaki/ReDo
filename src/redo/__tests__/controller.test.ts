// src/redo/__tests__/controller.test.ts
// 「コントローラ + this.reRender()」エルゴノミクスの検証テスト（Issue #8）
//
// JSXは使わず、h() を直接呼び出す。island.test.ts のスタイルを踏襲する。
// コントローラは実際の class として定義し、arrowフィールドで View/イベントハンドラを持たせる。
//
// queue.ts / island.ts はどちらもモジュールレベルの状態（イベントキュー、islandMap）を
// 持っているため、テスト間の汚染を避けるべく各テストで vi.resetModules() を行い、
// h/render/mount/patch/island/controller を同一の（resetModules後の）モジュール
// グラフから動的importする（queue.test.ts / asyncdetect.test.ts と同じパターン）。
// これにより makeReRender 内部が使う reRenderIsland と、テストが直接使う
// reRenderIsland / islandMap が確実に同じモジュールインスタンスを指す。

import { describe, it, expect, beforeEach, vi } from "vitest";

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
	const { island } = await import("../island");
	const { makeReRender } = await import("../controller");
	return { h, render, mount, island, makeReRender };
}

describe("controller: 同期イベントによる部分再描画", () => {
	it("this.reRender() は自分の島だけを更新し、非島の兄弟inputには触れない", async () => {
		const { h, render, mount, island, makeReRender } = await loadModules();

		class Counter {
			count = 0;

			View = () =>
				h(
					"div",
					{ id: "counter" },
					h("span", { id: "count-value" }, String(this.count)),
					h("button", { id: "inc-btn", onClick: this.increment }),
				);

			increment = (_ctx: unknown) => {
				this.count++;
				this.reRender();
			};

			reRender = makeReRender(this.View);
		}

		const counter = new Counter();
		const Parent = () =>
			h("div", { id: "root" }, island(counter.View), h("input", { id: "sib" }));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		// 非島の兄弟inputに値をセットし、参照を記録
		const sib = container.querySelector("#sib") as HTMLInputElement;
		sib.value = "keep-me";

		expect((container.querySelector("#count-value") as HTMLElement).textContent).toBe("0");

		// DOMイベントとしてクリックを発火する（実際のイベント経路: enqueue -> flush -> item.event(ctx)）
		const btn = container.querySelector("#inc-btn") as HTMLElement;
		btn.dispatchEvent(new Event("click"));

		await flushEvents();

		// (a) 島の内容だけ更新される
		expect((container.querySelector("#count-value") as HTMLElement).textContent).toBe("1");
		// (b) 兄弟のinputは参照レベルで同一かつ値保持（＝島の外は再描画されていない）
		expect(container.querySelector("#sib")).toBe(sib);
		expect(sib.value).toBe("keep-me");
	});
});

describe("controller: 非同期完了時の部分再描画", () => {
	it("ctx.run(...).success（payloadがDOM要素ではない）でも this.reRender() が正しく島を再描画する", async () => {
		const { h, render, mount, island, makeReRender } = await loadModules();

		class Counter {
			count = 0;

			View = () =>
				h(
					"div",
					{ id: "counter" },
					h("span", { id: "count-value" }, String(this.count)),
					h("button", { id: "load-btn", onClick: this.load }),
				);

			// 非同期タスクを発火する（成功時ハンドラはthis.apply）
			load = (ctx: any) => {
				ctx.run(async () => 42, undefined, { success: this.apply });
			};

			// payloadは非同期処理の結果（数値）であり、DOM要素ではない。
			// DOMから島を辿る方式では対象を特定できないケースの検証。
			apply = (ctx: any) => {
				expect(ctx.payload).toBe(42);
				expect(ctx.payload).not.toBeInstanceOf(HTMLElement);
				this.count = ctx.payload;
				this.reRender();
			};

			reRender = makeReRender(this.View);
		}

		const counter = new Counter();
		const Parent = () => h("div", { id: "root" }, island(counter.View));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		expect((container.querySelector("#count-value") as HTMLElement).textContent).toBe("0");

		const btn = container.querySelector("#load-btn") as HTMLElement;
		btn.dispatchEvent(new Event("click"));

		// runAsyncの完了(マイクロタスク) -> enqueue(success) -> flush(マイクロタスク) を待つ
		await flushEvents();

		expect((container.querySelector("#count-value") as HTMLElement).textContent).toBe("42");
	});
});

describe("controller: インスタンス独立性", () => {
	it("同じクラスの2つのインスタンスはそれぞれ独立した島を持ち、片方のreRenderがもう片方に影響しない", async () => {
		const { h, render, mount, island, makeReRender } = await loadModules();

		class Counter {
			count = 0;

			View = () =>
				h(
					"div",
					{ class: "counter" },
					h("span", { class: "count-value" }, String(this.count)),
					h("button", { class: "inc-btn", onClick: this.increment }),
				);

			increment = (_ctx: unknown) => {
				this.count++;
				this.reRender();
			};

			reRender = makeReRender(this.View);
		}

		// Viewはインスタンスごとに一意なarrow関数なので、別のインスタンス = 別の島になる
		const a = new Counter();
		const b = new Counter();

		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				h("div", { id: "island-a" }, island(a.View)),
				h("div", { id: "island-b" }, island(b.View)),
			);

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		expect(
			(container.querySelector("#island-a .count-value") as HTMLElement).textContent,
		).toBe("0");
		expect(
			(container.querySelector("#island-b .count-value") as HTMLElement).textContent,
		).toBe("0");

		// aだけインクリメントする
		const btnA = container.querySelector("#island-a .inc-btn") as HTMLElement;
		btnA.dispatchEvent(new Event("click"));

		await flushEvents();

		// aの島だけ更新され、bの島・状態は無傷
		expect(
			(container.querySelector("#island-a .count-value") as HTMLElement).textContent,
		).toBe("1");
		expect(
			(container.querySelector("#island-b .count-value") as HTMLElement).textContent,
		).toBe("0");
		expect(b.count).toBe(0);
	});
});

describe("controller: thisの正体とctx.payload", () => {
	it("arrowフィールドのハンドラ内のthisはコントローラインスタンスに一致し、ctx.payloadはトリガー(DOMイベント)を指す", async () => {
		const { h, render, mount, island, makeReRender } = await loadModules();

		let capturedThis: unknown;
		let capturedPayload: unknown;

		class Counter {
			count = 0;

			View = () => h("div", { id: "counter" }, h("button", { id: "btn", onClick: this.onClick }));

			onClick = (ctx: any) => {
				// thisはJavaScriptの言語仕様が決める（ReDoではない）:
				// arrowフィールドの定義時にレキシカルに束縛されたコントローラインスタンス。
				capturedThis = this;
				// トリガー要素(ボタン)そのものではなく、ctx.payload(DOMイベント)経由でアクセスする
				capturedPayload = ctx.payload;
			};

			reRender = makeReRender(this.View);
		}

		const counter = new Counter();
		const Parent = () => h("div", { id: "root" }, island(counter.View));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		const btn = container.querySelector("#btn") as HTMLElement;
		const clickEvent = new Event("click");
		btn.dispatchEvent(clickEvent);

		await flushEvents();

		// thisはコントローラインスタンス本人（ボタン要素ではない）
		expect(capturedThis).toBe(counter);
		expect(capturedThis).not.toBe(btn);
		// ctx.payloadがトリガー(DOMイベント)。イベントのtargetからトリガー要素にアクセスできる
		expect(capturedPayload).toBe(clickEvent);
		expect((capturedPayload as Event).target).toBe(btn);
	});
});
