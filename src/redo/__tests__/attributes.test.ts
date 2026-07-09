// src/redo/__tests__/attributes.test.ts
// 属性処理の一本化（Issue #3）のテスト
//
// JSXは使わず、h() を直接呼び出す。render() -> mount() で初回描画し、
// render() -> patch() で差分更新する。
// mount.ts と patch.ts が共通の src/redo/domattribute.ts を使うことで、
// className正規化・styleオブジェクト差分・boolean属性の扱いが
// mount / patch のどちらでも一致することを検証する。

import { describe, it, expect } from "vitest";
import { h } from "../h";
import { render } from "../render";
import { mount } from "../mount";
import { patch } from "../patch";
import type { VNode } from "../vnode";

describe("className の正規化", () => {
	it("mount: className は class 属性として設定され、className というliteral属性は作られない", () => {
		const container = document.createElement("div");

		const vnode = render(h("div", { className: "app" }));
		mount(vnode, container);

		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute("class")).toBe("app");
		expect(el.hasAttribute("className")).toBe(false);
	});

	it("patch: className更新後もclassのみが変化し、className属性は存在しない", () => {
		const container = document.createElement("div");

		let oldVNode: VNode = render(h("div", { className: "app" }));
		mount(oldVNode, container);

		const newVNode = render(h("div", { className: "app active" }));
		patch(container, oldVNode, newVNode);

		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute("class")).toBe("app active");
		expect(el.hasAttribute("className")).toBe(false);
	});
});

describe("style属性", () => {
	it("styleオブジェクトのpatchで旧キーが消え、新キーが付く（[object Object]は現れない）", () => {
		const container = document.createElement("div");

		let oldVNode: VNode = render(h("div", { style: { color: "red" } }));
		mount(oldVNode, container);

		const el = container.firstElementChild as HTMLElement;
		expect(el.style.color).toBe("red");
		expect(el.getAttribute("style")).not.toContain("[object Object]");

		const newVNode = render(h("div", { style: { background: "blue" } }));
		patch(container, oldVNode, newVNode);

		expect(el.style.color).toBe("");
		expect(el.style.background).toBe("blue");
		expect(el.getAttribute("style")).not.toContain("[object Object]");
	});

	it("style文字列の設定と更新が反映される", () => {
		const container = document.createElement("div");

		let oldVNode: VNode = render(h("div", { style: "color: red;" }));
		mount(oldVNode, container);

		const el = container.firstElementChild as HTMLElement;
		expect(el.style.color).toBe("red");

		const newVNode = render(h("div", { style: "background: blue;" }));
		patch(container, oldVNode, newVNode);

		expect(el.style.color).toBe("");
		expect(el.style.background).toBe("blue");
	});
});

describe("boolean属性", () => {
	it("disabled: true で属性が付き、falseへのpatchで属性が消える", () => {
		const container = document.createElement("div");

		let oldVNode: VNode = render(h("input", { disabled: true }));
		mount(oldVNode, container);

		const el = container.firstElementChild as HTMLElement;
		expect(el.hasAttribute("disabled")).toBe(true);
		expect(el.getAttribute("disabled")).toBe("");

		const newVNode = render(h("input", { disabled: false }));
		patch(container, oldVNode, newVNode);

		expect(el.hasAttribute("disabled")).toBe(false);
		expect(el.getAttribute("disabled")).not.toBe("false");
	});

	it("mount時にdisabled: falseを与えても属性は付かない（文字列 'false' は観測されない）", () => {
		const container = document.createElement("div");

		const vnode = render(h("input", { disabled: false }));
		mount(vnode, container);

		const el = container.firstElementChild as HTMLElement;
		expect(el.hasAttribute("disabled")).toBe(false);
		expect(el.getAttribute("disabled")).not.toBe("false");
	});
});

describe("mount/patch対称性", () => {
	// 属性の最終状態を比較しやすい形に正規化するヘルパー
	function snapshot(el: HTMLElement) {
		return {
			class: el.getAttribute("class"),
			hasClassNameAttr: el.hasAttribute("className"),
			styleCssText: el.style.cssText,
			disabled: el.hasAttribute("disabled"),
			title: el.getAttribute("title"),
		};
	}

	it("mount直後の属性状態と、別propsからpatchした後の属性状態が一致する", () => {
		const targetProps = {
			title: "hello",
			className: "btn active",
			style: { color: "red" },
			disabled: true,
		};

		// mount側: 最初からtargetPropsでマウント
		const mountContainer = document.createElement("div");
		const mountVNode = render(h("div", { ...targetProps }));
		mount(mountVNode, mountContainer);
		const mountedEl = mountContainer.firstElementChild as HTMLElement;

		// patch側: 別のpropsでマウントしてからtargetPropsへpatch
		const patchContainer = document.createElement("div");
		let patchOldVNode: VNode = render(
			h("div", {
				title: "old",
				className: "old-cls",
				style: { background: "blue" },
				disabled: false,
			}),
		);
		mount(patchOldVNode, patchContainer);

		const patchNewVNode = render(h("div", { ...targetProps }));
		patch(patchContainer, patchOldVNode, patchNewVNode);
		const patchedEl = patchContainer.firstElementChild as HTMLElement;

		expect(snapshot(patchedEl)).toEqual(snapshot(mountedEl));

		// 具体的な期待値も確認しておく
		expect(snapshot(mountedEl)).toEqual({
			class: "btn active",
			hasClassNameAttr: false,
			styleCssText: mountedEl.style.cssText,
			disabled: true,
			title: "hello",
		});
		expect(mountedEl.style.color).toBe("red");
	});
});
