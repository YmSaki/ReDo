// src/redo/__tests__/lifecycle.test.ts
// ライフサイクルprops（onMount/onUpdate/onUnmount）のテスト（Issue #4）
//
// JSXは使わず、h() + render() + mount() + patch() を直接使う。
// queue.ts がモジュールレベル状態（eventQueue等）を持つため、テスト間の汚染を避けるべく
// 各テストで vi.resetModules() を行い、h/render/mount/patch を動的importで
// 毎回フレッシュなモジュールインスタンスとして取得する（queue.test.tsと同様のパターン）。
//
// ライフサイクルの発火はenqueue経由（マイクロタスク）なので、確認には
// マイクロタスクよりも後まで待つ setTimeout(..., 0) を使う。

import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

// マイクロタスクの深さに依存せず、enqueueされたイベントの実行を確実に待つためのヘルパー
const flushEvents = () => new Promise((resolve) => setTimeout(resolve, 0));

// テストで必要なモジュール一式を、resetModules後にフレッシュな状態で読み込む
async function loadModules() {
	const { h } = await import("../h");
	const { render } = await import("../render");
	const { mount } = await import("../mount");
	const { patch } = await import("../patch");
	return { h, render, mount, patch };
}

describe("誤登録がないこと", () => {
	it("onMount/onUpdate/onUnmountはDOMイベントリスナーとして登録されない", async () => {
		const { h, render, mount, patch } = await loadModules();

		const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

		const container = document.createElement("div");
		const onMount = () => {};
		const onUpdate = () => {};
		const onUnmount = () => {};

		let oldVNode = render(h("div", { onMount, onUpdate, onUnmount, title: "a" }));
		mount(oldVNode, container);
		const el = oldVNode.dom as HTMLElement & {
			_eventHandler?: Record<string, Function>;
			_eventListener?: Record<string, EventListener>;
		};

		// 更新（onUpdateの発火経路）
		const newVNode = render(h("div", { onMount, onUpdate, onUnmount, title: "b" }));
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;

		// 削除（onUnmountの発火経路）
		patch(container, oldVNode, null);

		// "mount" / "update" / "unmount" という名前のDOMイベントリスナーは一切登録されていない
		const registeredNames = addEventListenerSpy.mock.calls.map(([name]) => name);
		expect(registeredNames).not.toContain("mount");
		expect(registeredNames).not.toContain("update");
		expect(registeredNames).not.toContain("unmount");

		// _eventHandler / _eventListener にライフサイクル由来のエントリが作られていない
		expect(el._eventHandler ?? {}).not.toHaveProperty("mount");
		expect(el._eventHandler ?? {}).not.toHaveProperty("update");
		expect(el._eventHandler ?? {}).not.toHaveProperty("unmount");
		expect(el._eventListener ?? {}).not.toHaveProperty("mount");
		expect(el._eventListener ?? {}).not.toHaveProperty("update");
		expect(el._eventListener ?? {}).not.toHaveProperty("unmount");

		addEventListenerSpy.mockRestore();
	});
});

describe("onMount", () => {
	it("mount時に1回だけ、生成された要素をpayloadとして呼ばれる", async () => {
		const { h, render, mount } = await loadModules();

		const container = document.createElement("div");
		const calls: unknown[] = [];
		const onMount = (ctx: { payload: unknown }) => calls.push(ctx.payload);

		const vnode = render(h("div", { onMount, title: "a" }));
		mount(vnode, container);

		await flushEvents();

		expect(calls.length).toBe(1);
		expect(calls[0]).toBe(vnode.dom);
	});

	it("同一要素へのpatch（更新）ではonMountは再発火しない", async () => {
		const { h, render, mount, patch } = await loadModules();

		const container = document.createElement("div");
		const calls: unknown[] = [];
		const onMount = (ctx: { payload: unknown }) => calls.push(ctx.payload);

		let oldVNode = render(h("div", { onMount, title: "a" }));
		mount(oldVNode, container);
		await flushEvents();
		expect(calls.length).toBe(1);

		const newVNode = render(h("div", { onMount, title: "b" }));
		patch(container, oldVNode, newVNode);
		await flushEvents();

		// patch（既存要素の更新）ではmount()が再実行されないため、onMountは増えない
		expect(calls.length).toBe(1);
	});
});

describe("onUpdate", () => {
	it("同一typeでのpatch時に、更新された要素をpayloadとして呼ばれる", async () => {
		const { h, render, mount, patch } = await loadModules();

		const container = document.createElement("div");
		const calls: unknown[] = [];
		const onUpdate = (ctx: { payload: unknown }) => calls.push(ctx.payload);

		let oldVNode = render(h("div", { onUpdate, title: "a" }));
		mount(oldVNode, container);
		await flushEvents();
		// mount時点ではonUpdateは呼ばれない
		expect(calls.length).toBe(0);

		const newVNode = render(h("div", { onUpdate, title: "b" }));
		patch(container, oldVNode, newVNode);
		await flushEvents();

		expect(calls.length).toBe(1);
		expect(calls[0]).toBe(newVNode.dom);
	});
});

describe("onUnmount", () => {
	it("要素削除時に呼ばれ、削除された要素の子孫のonUnmountも再帰的に呼ばれる", async () => {
		const { h, render, mount, patch } = await loadModules();

		const container = document.createElement("div");
		const parentCalls: unknown[] = [];
		const childCalls: unknown[] = [];
		const onUnmountParent = (ctx: { payload: unknown }) => parentCalls.push(ctx.payload);
		const onUnmountChild = (ctx: { payload: unknown }) => childCalls.push(ctx.payload);

		const build = (show: boolean) =>
			render(
				h(
					"ul",
					{},
					show
						? h(
								"li",
								{ key: "item", onUnmount: onUnmountParent },
								h("span", { onUnmount: onUnmountChild }, "x"),
							)
						: null,
				),
			);

		let oldVNode = build(true);
		mount(oldVNode, container);

		const li = container.querySelector("li");
		const span = container.querySelector("span");
		expect(li).not.toBeNull();
		expect(span).not.toBeNull();

		const newVNode = build(false);
		patch(container, oldVNode, newVNode);

		await flushEvents();

		expect(parentCalls).toEqual([li]);
		expect(childCalls).toEqual([span]);
	});
});

describe("onClickとの共存", () => {
	it("onClickのDOMリスナー登録は従来どおり行われ、onMountはDOMリスナーとして登録されない", async () => {
		const { h, render, mount } = await loadModules();

		const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

		const container = document.createElement("div");
		const onClick = () => {};
		const onMount = () => {};

		const vnode = render(h("button", { onClick, onMount }));
		mount(vnode, container);

		const registeredNames = addEventListenerSpy.mock.calls.map(([name]) => name);
		expect(registeredNames).toContain("click");
		expect(registeredNames).not.toContain("mount");

		addEventListenerSpy.mockRestore();
	});
});
