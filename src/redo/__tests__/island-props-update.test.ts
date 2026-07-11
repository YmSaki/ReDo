// src/redo/__tests__/island-props-update.test.ts
// 島(island)のprops明示更新の検証テスト（Issue #12）
//
// 穴: handle.props を更新する経路が存在せず、reRenderIsland(component) を呼んでも
// 常にマウント時のpropsのまま再描画されてしまう。
// 「親からの自動伝播はしない。ただし明示的にはやれる」ようにするための reRenderIsland(component, newProps) を検証する。
//
// JSXは使わず、h() を直接呼び出す。island-lifecycle.test.ts のスタイルを踏襲する。
// islandMap がモジュールレベルの状態のため、各テストで vi.resetModules() し、
// h/render/mount/patch/island/reRenderIsland を同一の（resetModules後の）モジュールグラフから動的importする。

import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

// テストで必要なモジュール一式を、resetModules後にフレッシュな状態で読み込む
async function loadModules() {
	const { h } = await import("../h");
	const { render } = await import("../render");
	const { mount } = await import("../mount");
	const { patch } = await import("../patch");
	const { island, reRenderIsland } = await import("../island");
	return { h, render, mount, patch, island, reRenderIsland };
}

describe("island props明示更新 1: 明示的なprops更新が反映される", () => {
	it("reRenderIsland(C, newProps) で島のpropsが更新され、新propsで再描画される", async () => {
		const { h, render, mount, island, reRenderIsland } = await loadModules();

		const C = (props: { value: number }) =>
			h("div", { id: "island" }, String(props.value));
		const Parent = () => h("div", { id: "root" }, island(C, { value: 1 }));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");

		reRenderIsland(C, { value: 2 });

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("2");
	});
});

describe("island props明示更新 2: props省略時は現状維持", () => {
	it("reRenderIsland(C)（第2引数省略）は既存のpropsのまま再描画する", async () => {
		const { h, render, mount, island, reRenderIsland } = await loadModules();

		const C = (props: { value: number }) =>
			h("div", { id: "island" }, String(props.value));
		const Parent = () => h("div", { id: "root" }, island(C, { value: 1 }));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");

		// 第2引数省略 → propsは変わらず1のまま再描画される
		reRenderIsland(C);

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");
	});
});

describe("island props明示更新 3: 親からの自動伝播は引き続きしない（回帰防止）", () => {
	it("親が新propsでislandを宣言して親を再描画しても、reRenderIslandを呼ばない限り島は古いpropsのまま", async () => {
		const { h, render, mount, patch, island, reRenderIsland } = await loadModules();

		const C = (props: { value: number }) =>
			h("div", { id: "island" }, String(props.value));

		let value = 1;
		const Parent = () =>
			h("div", { id: "root" }, island(C, { value }), h("span", { id: "sib" }, "s"));

		const container = document.createElement("div");
		let oldV = render(h(Parent, {}));
		mount(oldV, container);

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");

		// 親側は新しいpropsを宣言するが、reRenderIslandは呼ばない
		value = 99;
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// Case 4bの不透明引き継ぎにより、島は古いpropsのまま
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");

		// reRenderIslandを明示的に呼べば、新propsを渡すことで初めて反映される
		reRenderIsland(C, { value });
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("99");
	});
});

describe("island props明示更新 4: props更新後もDOM同一性が保たれる", () => {
	it("props更新に伴う再描画で島ルートDOMが破棄・再生成されない", async () => {
		const { h, render, mount, island, reRenderIsland } = await loadModules();

		const C = (props: { value: number }) =>
			h("div", { id: "island" }, String(props.value));
		const Parent = () => h("div", { id: "root" }, island(C, { value: 1 }));

		const container = document.createElement("div");
		const v = render(h(Parent, {}));
		mount(v, container);

		const islandEl = container.querySelector("#island") as HTMLElement;

		reRenderIsland(C, { value: 42 });

		// 通常のpatchによる差分更新であり、破棄→再生成ではない（参照レベルで同一）
		expect(container.querySelector("#island")).toBe(islandEl);
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("42");
	});
});
