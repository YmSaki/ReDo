// src/redo/__tests__/island.test.ts
// 部分再描画の基盤 = 入れ子の再描画島(island) の検証テスト（Issue #7）
//
// JSXは使わず、h() を直接呼び出す。render() -> mount() で初回描画し、
// render() -> patch() で親ツリーを差分更新する。
// 島の内部状態はテストローカルのクロージャ変数で表現する。
// 島は component(=View関数) をキーに管理されるため、各テストで一意な関数を定義する。

import { describe, it, expect } from "vitest";
import { h } from "../h";
import { render } from "../render";
import { mount } from "../mount";
import { patch } from "../patch";
import { island, reRenderIsland } from "../island";
import type { VNode } from "../vnode";

describe("island: 島のマウント", () => {
	it("island(C) を子に持つ親をmountすると、Cの出力DOMが親に展開される", () => {
		const container = document.createElement("div");

		const C = () => h("div", { id: "c" }, "c-content");
		const Parent = () => h("div", { id: "root" }, island(C));

		const v = render(h(Parent, {}));
		mount(v, container);

		const root = container.querySelector("#root") as HTMLElement;
		const c = container.querySelector("#c") as HTMLElement;

		expect(root).not.toBeNull();
		expect(c).not.toBeNull();
		// 島の出力が親(#root)の直下に展開されている
		expect(c.parentElement).toBe(root);
		expect(c.textContent).toBe("c-content");
	});
});

describe("island: 部分再描画のスコープ", () => {
	it("reRenderIsland(C) は島の内容だけ更新し、非島の兄弟には触れない", () => {
		const container = document.createElement("div");

		let count = 0;
		const C = () => h("div", { id: "island" }, String(count));
		const Parent = () =>
			h("div", { id: "root" }, island(C), h("input", { id: "sib" }));

		const v = render(h(Parent, {}));
		mount(v, container);

		// 非島の兄弟inputに値をセットし、参照を記録
		const sib = container.querySelector("#sib") as HTMLInputElement;
		sib.value = "keep-me";

		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("0");

		// 島の状態を変えて島だけ再描画
		count = 1;
		reRenderIsland(C);

		// (a) 島の内容が更新される
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("1");
		// (b) 兄弟のinputは参照レベルで同一かつ値保持（＝島の外は再描画されていない）
		expect(container.querySelector("#sib")).toBe(sib);
		expect(sib.value).toBe("keep-me");
	});
});

describe("island: 親再描画が島を壊さない", () => {
	it("島内部を変化させた後に親を丸ごとpatchしても、島のルートDOMと内部状態が保持される", () => {
		const container = document.createElement("div");

		let count = 0;
		const C = () => h("div", { id: "island" }, String(count));
		const Parent = () =>
			h("div", { id: "root" }, island(C), h("span", { id: "sib" }, "s"));

		let oldV: VNode = render(h(Parent, {}));
		mount(oldV, container);

		const islandEl = container.querySelector("#island") as HTMLElement;

		// 島内部を変化させる（島だけ再描画）
		count = 5;
		reRenderIsland(C);
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("5");
		// 再描画後も島ルートDOMは参照レベルで同一
		expect(container.querySelector("#island")).toBe(islandEl);

		// 親ツリーを丸ごと再描画（不透明化の検証）
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// 島のルートDOMが参照レベルで保持される
		expect(container.querySelector("#island")).toBe(islandEl);
		// 親の再描画は島内部に立ち入らないので、内部状態(5)がリセットされない
		expect((container.querySelector("#island") as HTMLElement).textContent).toBe("5");
	});
});

describe("island: 島の除去でアンマウント", () => {
	it("親ツリーから island(C) を外して再描画するとサブツリーが消え、以後の reRenderIsland は no-op", () => {
		const container = document.createElement("div");

		let show = true;
		const C = () => h("div", { id: "island" }, "c");
		const Parent = () =>
			h(
				"div",
				{ id: "root" },
				...(show ? [island(C)] : []),
				h("span", { id: "sib", key: "sib" }, "s"),
			);

		let oldV: VNode = render(h(Parent, {}));
		mount(oldV, container);
		expect(container.querySelector("#island")).not.toBeNull();

		// island(C) を外して再描画
		show = false;
		const newV = render(h(Parent, {}));
		patch(container, oldV, newV);
		oldV = newV;

		// CのサブツリーがDOMから消える
		expect(container.querySelector("#island")).toBeNull();
		// 非島の兄弟は残る
		expect(container.querySelector("#sib")).not.toBeNull();

		// 以後 reRenderIsland(C) は例外を投げず no-op
		expect(() => reRenderIsland(C)).not.toThrow();
		expect(container.querySelector("#island")).toBeNull();
	});
});

describe("island: 入れ子の島", () => {
	it("島の中の別の島 D を reRenderIsland すると内側だけ更新し外側は不変", () => {
		const container = document.createElement("div");

		let cCount = 0;
		let dCount = 0;
		const D = () => h("div", { id: "inner" }, String(dCount));
		const C = () =>
			h(
				"div",
				{ id: "outer" },
				h("span", { id: "cval" }, String(cCount)),
				island(D),
			);
		const Parent = () => h("div", { id: "root" }, island(C));

		const v = render(h(Parent, {}));
		mount(v, container);

		expect((container.querySelector("#inner") as HTMLElement).textContent).toBe("0");
		expect((container.querySelector("#cval") as HTMLElement).textContent).toBe("0");

		// 内側の島 D だけ再描画 → 内側だけ更新、外側は不変
		dCount = 7;
		reRenderIsland(D);
		expect((container.querySelector("#inner") as HTMLElement).textContent).toBe("7");
		expect((container.querySelector("#cval") as HTMLElement).textContent).toBe("0");

		// 外側の島 C を再描画 → 外側は更新、内側の島 D は不透明に保持される
		cCount = 3;
		const innerBefore = container.querySelector("#inner");
		reRenderIsland(C);
		expect((container.querySelector("#cval") as HTMLElement).textContent).toBe("3");
		// 内側の島 D はルートDOMも内部状態(7)も保持される
		expect(container.querySelector("#inner")).toBe(innerBefore);
		expect((container.querySelector("#inner") as HTMLElement).textContent).toBe("7");
	});
});
