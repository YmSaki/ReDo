// src/redo/__tests__/patch.test.ts
// patch.ts の keyed diff（patchChildren）のスモークテスト
//
// JSXは使わず、h() を直接呼び出す。render() -> mount() で初回描画し、
// render() -> patch() で差分更新する。

import { describe, it, expect } from "vitest";
import { h } from "../h";
import { render } from "../render";
import { mount } from "../mount";
import { patch } from "../patch";
import type { VNode } from "../vnode";

// key付きの <li><input /></li> のリストを持つ <ul> を組み立てる
function buildList(keys: string[]): ReturnType<typeof h> {
	return h(
		"ul",
		{},
		...keys.map((k) => h("li", { key: k }, h("input", {}))),
	);
}

describe("keyed diff: DOM再利用", () => {
	it("シャッフル後もDOM順序が一致し、要素は再生成されず、input値がkeyと一緒に移動する", () => {
		const container = document.createElement("div");

		// 初回描画
		const initialKeys = ["a", "b", "c"];
		let oldVNode: VNode = render(buildList(initialKeys));
		mount(oldVNode, container);

		const ul = container.firstElementChild as HTMLElement;
		expect(ul.tagName).toBe("UL");
		expect(ul.children.length).toBe(3);

		// 各liのinputに値をセットし、key -> DOM要素の対応を記録しておく
		const liByKey: Record<string, Element> = {};
		const inputByKey: Record<string, HTMLInputElement> = {};

		initialKeys.forEach((key, index) => {
			const li = ul.children[index];
			const input = li.querySelector("input") as HTMLInputElement;
			input.value = `value-${key}`;

			liByKey[key] = li;
			inputByKey[key] = input;
		});

		// シャッフルして再描画
		const shuffledKeys = ["c", "a", "b"];
		const newVNode = render(buildList(shuffledKeys));
		patch(container, oldVNode, newVNode);
		oldVNode = newVNode;

		const newLis = Array.from(ul.children);
		expect(newLis.length).toBe(3);

		shuffledKeys.forEach((key, index) => {
			const li = newLis[index];

			// (a) DOM順序が新しい配列順に一致する
			// (b) 各keyのDOM要素が参照レベルで同一（再生成されていない）
			expect(li).toBe(liByKey[key]);

			// (c) inputの値がkeyと一緒に移動している
			const input = li.querySelector("input") as HTMLInputElement;
			expect(input).toBe(inputByKey[key]);
			expect(input.value).toBe(`value-${key}`);
		});
	});
});
