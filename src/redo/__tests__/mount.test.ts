// src/redo/__tests__/mount.test.ts
// mount.ts のスモークテスト
//
// JSXは使わず、h() を直接呼び出してJSXNodeを組み立てる。
// className の正規化バグ、onMount等のライフサイクルpropsの誤登録バグを踏まないよう、
// className / onMount / onUpdate / onUnmount props は使用しない。

import { describe, it, expect } from "vitest";
import { h } from "../h";
import { render } from "../render";
import { mount } from "../mount";

describe("mount: 基本生成", () => {
	it("文字列/数値のVNodeはテキストノードとしてマウントされる", () => {
		const container = document.createElement("div");

		const textVNode = render("hello");
		mount(textVNode, container);

		expect(container.childNodes.length).toBe(1);
		const textNode = container.childNodes[0];
		expect(textNode.nodeType).toBe(3); // Node.TEXT_NODE
		expect(textNode.textContent).toBe("hello");

		const numberContainer = document.createElement("div");
		const numberVNode = render(42);
		mount(numberVNode, numberContainer);
		expect(numberContainer.textContent).toBe("42");
	});

	it("単一のHTML要素と属性を生成する", () => {
		const container = document.createElement("div");

		const jsxNode = h("span", { id: "greeting", title: "hi-title" }, "hi");
		const vnode = render(jsxNode);
		mount(vnode, container);

		const span = container.firstElementChild as HTMLElement;
		expect(span).not.toBeNull();
		expect(span.tagName).toBe("SPAN");
		expect(span.getAttribute("id")).toBe("greeting");
		expect(span.getAttribute("title")).toBe("hi-title");
		expect(span.textContent).toBe("hi");
	});

	it("ネストした構造を正しくDOMに変換する", () => {
		const container = document.createElement("div");

		const jsxNode = h(
			"div",
			{ id: "outer" },
			"before",
			h("span", { id: "inner" }, "hi"),
			h("b", {}, "bold"),
		);
		const vnode = render(jsxNode);
		mount(vnode, container);

		const outer = container.firstElementChild as HTMLElement;
		expect(outer.tagName).toBe("DIV");
		expect(outer.getAttribute("id")).toBe("outer");
		expect(outer.childNodes.length).toBe(3);

		// "before" テキストノード
		expect(outer.childNodes[0].nodeType).toBe(3);
		expect(outer.childNodes[0].textContent).toBe("before");

		// <span id="inner">hi</span>
		const innerSpan = outer.childNodes[1] as HTMLElement;
		expect(innerSpan.tagName).toBe("SPAN");
		expect(innerSpan.getAttribute("id")).toBe("inner");
		expect(innerSpan.textContent).toBe("hi");

		// <b>bold</b>
		const boldEl = outer.childNodes[2] as HTMLElement;
		expect(boldEl.tagName).toBe("B");
		expect(boldEl.textContent).toBe("bold");
	});
});
