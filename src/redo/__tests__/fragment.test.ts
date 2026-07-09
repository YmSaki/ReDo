// src/redo/__tests__/fragment.test.ts
// Fragment が差分更新(patch)に耐えられることを検証するテスト（Issue #2）
//
// JSXは使わず、h() を直接呼び出す。render() -> mount() で初回描画し、
// render() -> patch() で差分更新する。
// className / onMount 等のライフサイクルpropsは別issueのバグを踏まないため使用しない。

import { describe, it, expect } from "vitest";
import { h, Fragment } from "../h";
import { render } from "../render";
import { mount } from "../mount";
import { patch } from "../patch";
import { List } from "../list";
import type { VNode } from "../vnode";

// 現在のDOM上の子要素のidを順番通りに並べた配列を返すヘルパー
function idsOf(parent: HTMLElement): string[] {
	return Array.from(parent.children).map((el) => el.id);
}

describe("Fragment: List の再レンダリング耐性", () => {
	it("オブジェクト配列をシャッフルしても例外なく完走し、DOM順序が新配列に一致する", () => {
		const container = document.createElement("div");

		const items = [
			{ id: "a" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d" },
		];

		const build = (data: { id: string }[]): VNode =>
			render(
				h(List, {
					items: data,
					renderItem: (item: { id: string }) => h("div", { id: item.id }, item.id),
				}),
			);

		let oldVNode = build(items);
		mount(oldVNode, container);
		expect(idsOf(container)).toEqual(["a", "b", "c", "d"]);

		// シャッフルして再描画（同じオブジェクト参照を使うのでkeyは不変）
		const shuffled = [items[2], items[0], items[3], items[1]];
		const newVNode = build(shuffled);
		expect(() => patch(container, oldVNode, newVNode)).not.toThrow();
		oldVNode = newVNode;

		expect(idsOf(container)).toEqual(["c", "a", "d", "b"]);
	});
});

describe("Fragment: DOM再利用の維持", () => {
	it("シャッフル前後で各アイテムのDOMが参照レベルで同一、input値が一緒に移動する", () => {
		const container = document.createElement("div");

		const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

		const build = (data: { id: string }[]): VNode =>
			render(
				h(List, {
					items: data,
					renderItem: (item: { id: string }) =>
						h("div", { id: item.id }, h("input", {})),
				}),
			);

		let oldVNode = build(items);
		mount(oldVNode, container);

		// 各divのinputに値をセットし、id -> DOMの対応を記録
		const divById: Record<string, Element> = {};
		const inputById: Record<string, HTMLInputElement> = {};
		items.forEach((item) => {
			const div = container.querySelector(`#${item.id}`) as HTMLElement;
			const input = div.querySelector("input") as HTMLInputElement;
			input.value = `value-${item.id}`;
			divById[item.id] = div;
			inputById[item.id] = input;
		});

		// シャッフル
		const shuffled = [items[2], items[0], items[1]];
		const newVNode = build(shuffled);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;

		expect(idsOf(container)).toEqual(["c", "a", "b"]);

		shuffled.forEach((item, index) => {
			const div = container.children[index];
			// DOM要素が再生成されず参照レベルで同一
			expect(div).toBe(divById[item.id]);
			const input = div.querySelector("input") as HTMLInputElement;
			expect(input).toBe(inputById[item.id]);
			// input値が一緒に移動している
			expect(input.value).toBe(`value-${item.id}`);
		});
	});
});

describe("Fragment: 子の増減", () => {
	// Fragment直下の子を組み立てる
	const buildFrag = (keys: string[]): VNode =>
		render(h(Fragment, {}, ...keys.map((k) => h("div", { id: k, key: k }, k))));

	it("追加・削除・並べ替えが正しく反映される", () => {
		const container = document.createElement("div");

		let oldVNode = buildFrag(["a", "b", "c"]);
		mount(oldVNode, container);
		expect(idsOf(container)).toEqual(["a", "b", "c"]);

		// 追加: 末尾と中間に挿入
		let newVNode = buildFrag(["a", "x", "b", "c", "d"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(container)).toEqual(["a", "x", "b", "c", "d"]);

		// 削除: いくつか取り除く
		newVNode = buildFrag(["a", "c"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(container)).toEqual(["a", "c"]);

		// 並べ替え
		newVNode = buildFrag(["c", "a"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(container)).toEqual(["c", "a"]);
	});
});

describe("Fragment: ネスト Fragment", () => {
	// 外側Fragmentの中に、内側Fragmentと通常要素を混在させる
	const buildNested = (keys: string[]): VNode =>
		render(
			h(
				Fragment,
				{},
				h("div", { id: "head", key: "head" }, "head"),
				h(
					Fragment,
					{},
					...keys.map((k) => h("div", { id: k, key: k }, k)),
				),
				h("div", { id: "tail", key: "tail" }, "tail"),
			),
		);

	it("Fragmentの中のFragmentでも増減・並べ替えが成立する", () => {
		const container = document.createElement("div");

		let oldVNode = buildNested(["a", "b"]);
		mount(oldVNode, container);
		expect(idsOf(container)).toEqual(["head", "a", "b", "tail"]);

		// 内側Fragmentの子を並べ替え＋追加
		let newVNode = buildNested(["b", "c", "a"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(container)).toEqual(["head", "b", "c", "a", "tail"]);

		// 内側Fragmentを空にしても前後の兄弟は壊れない
		newVNode = buildNested([]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(container)).toEqual(["head", "tail"]);
	});
});

describe("Fragment: 兄弟との共存", () => {
	// <div><span#before/><Fragment>...</Fragment><span#after/></div>
	const buildWithSiblings = (keys: string[]): VNode =>
		render(
			h(
				"div",
				{ id: "root" },
				h("span", { id: "before", key: "before" }, "before"),
				h(
					Fragment,
					{},
					...keys.map((k) => h("span", { id: k, key: k }, k)),
				),
				h("span", { id: "after", key: "after" }, "after"),
			),
		);

	it("Fragment内の子の増減が前後の兄弟の位置を壊さない", () => {
		const container = document.createElement("div");

		let oldVNode = buildWithSiblings(["a", "b"]);
		mount(oldVNode, container);
		const root = container.firstElementChild as HTMLElement;
		expect(idsOf(root)).toEqual(["before", "a", "b", "after"]);

		// Fragment内に追加
		let newVNode = buildWithSiblings(["a", "b", "c"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(root)).toEqual(["before", "a", "b", "c", "after"]);

		// Fragment内を並べ替え
		newVNode = buildWithSiblings(["c", "a", "b"]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(root)).toEqual(["before", "c", "a", "b", "after"]);

		// Fragment内を空にする → before/after は隣接する
		newVNode = buildWithSiblings([]);
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;
		expect(idsOf(root)).toEqual(["before", "after"]);
	});
});
