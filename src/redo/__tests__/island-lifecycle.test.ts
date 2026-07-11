// src/redo/__tests__/island-lifecycle.test.ts
// 島(island)のライフサイクルの穴埋め検証テスト（Issue #10）
//
// 穴1: 島がkeyを持てず、keyed listで並べ替えると破棄→再生成される
// 穴2: 島の撤去で内部の onUnmount が発火しない
//
// JSXは使わず、h() を直接呼び出す。island.test.ts / controller.test.ts のスタイルを踏襲する。
// queue.ts / island.ts はモジュールレベルの状態（イベントキュー、islandMap）を持つため、
// 各テストで vi.resetModules() を行い、h/render/mount/patch/island/List を同一の
// （resetModules後の）モジュールグラフから動的importする。

import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

// enqueue（マイクロタスク）の完了を確実に待つためのヘルパー
const flushEvents = () => new Promise((resolve) => setTimeout(resolve, 0));

// テストで必要なモジュール一式を、resetModules後にフレッシュな状態で読み込む
async function loadModules() {
	const { h } = await import("../h");
	const { render } = await import("../render");
	const { mount } = await import("../mount");
	const { patch } = await import("../patch");
	const { island, reRenderIsland } = await import("../island");
	const { List } = await import("../list");
	return { h, render, mount, patch, island, reRenderIsland, List };
}

describe("island-lifecycle 穴1: keyed listでの並べ替え", () => {
	it("key付きの島をリストで並べ替えても、島の同一性・内部状態・DOM順序が保たれる", async () => {
		const { h, render, mount, patch, island } = await loadModules();

		// 別々のView関数を持つ2つの島。内部状態はクロージャ変数で表現する。
		let aCount = 5;
		let bCount = 9;
		const A = () => h("div", { class: "island-a" }, String(aCount));
		const B = () => h("div", { class: "island-b" }, String(bCount));

		// 親は配列順に島を並べる。順序はテストが差し替える。
		let order: Array<[string, () => any]> = [
			["a", A],
			["b", B],
		];
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				...order.map(([key, View]) => island(View, {}, key)),
			);

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		const aEl = container.querySelector(".island-a") as HTMLElement;
		const bEl = container.querySelector(".island-b") as HTMLElement;
		expect(aEl.textContent).toBe("5");
		expect(bEl.textContent).toBe("9");

		// 初期のDOM順序は [a, b]
		let roots = Array.from(
			(container.querySelector("#root") as HTMLElement).children,
		);
		expect(roots).toEqual([aEl, bEl]);

		// 配列を並べ替えて親を patch 再描画（key経路でマッチし、Case 4bの不透明引き継ぎに入る）
		order = [
			["b", B],
			["a", A],
		];
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// (a) 各島のルートDOMが参照レベルで同一（破棄→再生成されていない）
		expect(container.querySelector(".island-a")).toBe(aEl);
		expect(container.querySelector(".island-b")).toBe(bEl);
		// (b) 内部状態が保持されている
		expect((container.querySelector(".island-a") as HTMLElement).textContent).toBe("5");
		expect((container.querySelector(".island-b") as HTMLElement).textContent).toBe("9");
		// (c) DOM順序が新配列順 [b, a] に一致
		roots = Array.from(
			(container.querySelector("#root") as HTMLElement).children,
		);
		expect(roots).toEqual([bEl, aEl]);
	});
});

describe("island-lifecycle 穴2: 島撤去で内部の onUnmount 発火", () => {
	it("島をリストから外して再描画すると、島内部要素とその子孫の onUnmount が発火する", async () => {
		const { h, render, mount, patch, island } = await loadModules();

		let rootUnmountArg: unknown = "not-called";
		let childUnmountArg: unknown = "not-called";

		// 島内部のルート要素と子孫要素に onUnmount を付ける
		const C = () =>
			h(
				"section",
				{ id: "c-root", onUnmount: (ctx: any) => (rootUnmountArg = ctx.payload) },
				h("span", {
					id: "c-child",
					onUnmount: (ctx: any) => (childUnmountArg = ctx.payload),
				}),
			);

		let show = true;
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				...(show ? [island(C, {}, "c")] : []),
				h("span", { id: "sib", key: "sib" }, "s"),
			);

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		const cRoot = container.querySelector("#c-root") as HTMLElement;
		const cChild = container.querySelector("#c-child") as HTMLElement;
		expect(cRoot).not.toBeNull();
		expect(cChild).not.toBeNull();

		// 島を外して再描画（撤去）
		show = false;
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// DOMからは既に消えている
		expect(container.querySelector("#c-root")).toBeNull();
		// 兄弟は残る
		expect(container.querySelector("#sib")).not.toBeNull();

		// onUnmount は enqueue 経由なのでフラッシュを待つ
		await flushEvents();

		// ルート要素・子孫要素どちらの onUnmount も、生成要素をpayloadに発火する
		expect(rootUnmountArg).toBe(cRoot);
		expect(childUnmountArg).toBe(cChild);
	});
});

describe("island-lifecycle 穴2: 撤去後の後始末", () => {
	it("撤去後は reRenderIsland が no-op で、DOMからも消えている", async () => {
		const { h, render, mount, patch, island, reRenderIsland } = await loadModules();

		let count = 0;
		const C = () => h("div", { id: "island" }, String(count));

		let show = true;
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				...(show ? [island(C, {}, "c")] : []),
				h("span", { id: "sib", key: "sib" }, "s"),
			);

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);
		expect(container.querySelector("#island")).not.toBeNull();

		// 撤去
		show = false;
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		expect(container.querySelector("#island")).toBeNull();

		// 撤去後、状態を変えて reRenderIsland しても no-op（islandMapから消えている）
		count = 99;
		expect(() => reRenderIsland(C)).not.toThrow();
		expect(container.querySelector("#island")).toBeNull();
	});
});

describe("island-lifecycle 穴2: onMount/onUnmount の対称性", () => {
	it("島マウントで onMount、島撤去で onUnmount がそれぞれ発火する", async () => {
		const { h, render, mount, patch, island } = await loadModules();

		let mountCount = 0;
		let unmountCount = 0;
		const C = () =>
			h("div", {
				id: "island",
				onMount: () => mountCount++,
				onUnmount: () => unmountCount++,
			});

		let show = true;
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				...(show ? [island(C, {}, "c")] : []),
				h("span", { id: "sib", key: "sib" }, "s"),
			);

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		await flushEvents();
		// マウントで onMount が1回
		expect(mountCount).toBe(1);
		expect(unmountCount).toBe(0);

		// 撤去
		show = false;
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		await flushEvents();
		// 撤去で onUnmount が1回。onMountは増えない。
		expect(mountCount).toBe(1);
		expect(unmountCount).toBe(1);
	});
});

describe("island-lifecycle 穴1: 後方互換", () => {
	it("island(C) と island(C, {})（key無し）が従来通り動く", async () => {
		const { h, render, mount, patch, island, reRenderIsland } = await loadModules();

		// key無し1引数
		let count1 = 0;
		const C1 = () => h("div", { id: "island-1" }, String(count1));
		// key無し2引数
		let count2 = 0;
		const C2 = () => h("div", { id: "island-2" }, String(count2));

		const Parent = () =>
			h("div", { id: "root" }, island(C1), island(C2, {}));

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		expect((container.querySelector("#island-1") as HTMLElement).textContent).toBe("0");
		expect((container.querySelector("#island-2") as HTMLElement).textContent).toBe("0");

		// それぞれ島だけ再描画できる
		count1 = 3;
		reRenderIsland(C1);
		count2 = 7;
		reRenderIsland(C2);

		expect((container.querySelector("#island-1") as HTMLElement).textContent).toBe("3");
		expect((container.querySelector("#island-2") as HTMLElement).textContent).toBe("7");

		// 親の丸ごと再描画でも不透明に引き継がれる（key無しは位置マッチ）
		const c1El = container.querySelector("#island-1");
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;
		expect(container.querySelector("#island-1")).toBe(c1El);
		expect((container.querySelector("#island-1") as HTMLElement).textContent).toBe("3");
	});
});

describe("island-lifecycle 穴1: Listヘルパー併用", () => {
	it("List が注入したkeyで島を並べ替えても、島の同一性・内部状態・DOM順序が保たれる", async () => {
		const { h, render, mount, patch, island, List } = await loadModules();

		let aCount = 5;
		let bCount = 9;
		const A = () => h("div", { class: "island-a" }, String(aCount));
		const B = () => h("div", { class: "island-b" }, String(bCount));

		// List は renderItem の返すノードに props.key = keyExtractor(item) を注入する。
		// island() の返すBOUNDARYノードにも props.key が載れば穴1が効く。
		type Item = { id: string; View: () => any };
		let items: Item[] = [
			{ id: "a", View: A },
			{ id: "b", View: B },
		];
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				List({
					items,
					renderItem: (item: Item) => island(item.View),
					keyExtractor: (item: Item) => item.id,
				}),
			);

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		const aEl = container.querySelector(".island-a") as HTMLElement;
		const bEl = container.querySelector(".island-b") as HTMLElement;
		expect(aEl.textContent).toBe("5");
		expect(bEl.textContent).toBe("9");

		let roots = Array.from(
			(container.querySelector("#root") as HTMLElement).children,
		);
		expect(roots).toEqual([aEl, bEl]);

		// 並べ替え
		items = [
			{ id: "b", View: B },
			{ id: "a", View: A },
		];
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// 島の同一性・内部状態・順序
		expect(container.querySelector(".island-a")).toBe(aEl);
		expect(container.querySelector(".island-b")).toBe(bEl);
		expect((container.querySelector(".island-a") as HTMLElement).textContent).toBe("5");
		expect((container.querySelector(".island-b") as HTMLElement).textContent).toBe("9");
		roots = Array.from(
			(container.querySelector("#root") as HTMLElement).children,
		);
		expect(roots).toEqual([bEl, aEl]);
	});
});
