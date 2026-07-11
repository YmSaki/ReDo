// src/redo/island.ts
// 部分再描画の基盤 = 入れ子の再描画島(island)
//
// 「境界(boundary)」を導入する。境界の内部はその島だけが所有し、
// 親の再描画は境界内部に立ち入らない（プロップスは自動で流れない = 意図的な思想）。
//
// v1制約:
// - 島のViewは単一ホスト要素をルートに返すこと。
//   FRAGMENTルートの島はv1非対応（placeChildrenが親の兄弟と干渉するため）。
// - 親→島のprops自動伝播なし。
// - 同一View関数の多重マウント非対応（1つのView関数 ↔ 1マウント の契約）。

import { BOUNDARY } from "./constants";
import { h } from "./h";
import { render } from "./render";
import { mount } from "./mount";
import { patch, invokeUnmount } from "./patch";
import type { Component } from "./component";
import type { JSXNode } from "./jsx-node";
import type { VNode } from "./vnode";

/**
 * マウント済みの島の状態を保持するハンドル
 * component(=View関数)をキーに islandMap で一意に管理される。
 * oldVNode が島内部の解決済みVNodeツリー（島の現在状態の唯一の真実）。
 */
export type IslandHandle = {
	/// 島のView関数（islandMapのキー）
	component: Component;
	/// 島に渡すprops（親からの自動伝播はしない）
	props: Record<string, unknown>;
	/// 島内部の解決済みVNode（島だけが所有する差分検出の起点）
	oldVNode: VNode;
	/// 島内部だけを再描画する
	reRender: () => void;
};

// View関数 ↔ マウント済みの島 の対応表（1つのView関数 ↔ 1マウント の契約）
const islandMap = new Map<Component, IslandHandle>();

/**
 * 親JSX内に置いて島を宣言する
 *
 * @param component - 島のView関数（インスタンスごとに一意なarrow関数を想定）
 * @param props - 島に渡すprops（省略時は空。親からの自動伝播はしない）
 * @param key - オプションのkey（keyed listでの並べ替えに島の同一性を持たせる）
 * @returns 境界(BOUNDARY)のJSXNode
 */
export const island = (
	component: Component,
	props?: Record<string, unknown>,
	key?: string | number,
): JSXNode => ({
	type: BOUNDARY,
	// keyは render.ts の BOUNDARY分岐が node.props.key として拾う（h()のkey取り回しと整合）。
	// component/props は node.props.component / node.props.props で直接読まれるためkeyと干渉しない。
	props:
		key === undefined
			? { component, props: props ?? {} }
			: { component, props: props ?? {}, key },
	children: [],
});

/**
 * 境界(BOUNDARY)VNodeから島を生成してマウントする
 * mount.ts の BOUNDARY 分岐から呼ばれる。
 *
 * @param vnode - 境界(BOUNDARY)VNode
 * @param parent - マウント先の実DOM親（切り離してマウントする場合はnull）
 * @returns 島ルートの実DOM
 */
export function mountIsland(
	vnode: VNode,
	parent: HTMLElement | null,
): HTMLElement | Text | null {
	const component = vnode.component as Component;
	const props = vnode.boundaryProps ?? {};

	// 島内部を解決してマウントする（島のViewは単一ホスト要素をルートに返す前提）
	const sub = render(h(component, props));
	const dom = mount(sub, parent);

	const handle: IslandHandle = {
		component,
		props,
		oldVNode: sub,
		reRender: () => reRenderHandle(handle),
	};

	// 1つのView関数 ↔ 1マウント。多重マウントはv1非対応（上書きになる）。
	islandMap.set(component, handle);

	// 境界VNodeにハンドルを持たせる（島の現在状態への参照はハンドル経由で辿る）
	vnode.island = handle;
	vnode.dom = sub.dom;

	// 将来の 要素→島 ルックアップ用にDOMへスタンプする
	if (dom) {
		(dom as any).__redoIsland = handle;
	}

	return dom;
}

/**
 * 島サブツリーをDOMから撤去し、島の登録を破棄する
 * patch.ts の削除・置き換え分岐から呼ばれる。
 *
 * @param vnode - 撤去する境界(BOUNDARY)VNode
 */
export function unmountIsland(vnode: VNode): void {
	const handle =
		vnode.island ?? islandMap.get(vnode.component as Component);
	if (!handle) {
		return;
	}

	// 島ルートDOMを外す前に、島内部サブツリー(handle.oldVNode)の onUnmount を再帰発火する。
	// 順序は「onUnmount enqueue → DOM除去」。patch.ts の削除経路（invokeUnmount してから remove）と揃える。
	// invokeUnmount は呼び出し時にのみ参照されるため、island.ts ⇄ patch.ts の循環importでも安全。
	invokeUnmount(handle.oldVNode);

	// 島ルートは単一ホスト要素なので、ルートDOMを外せばサブツリーごと撤去される
	const rootDom = handle.oldVNode.dom;
	if (rootDom) {
		rootDom.remove();
	}

	islandMap.delete(handle.component);
}

/**
 * 登録済みの島を再描画する
 * component(=コントローラの this.View。インスタンスごとに一意なarrow関数)をキーに探す。
 * 未登録（未マウント / アンマウント済み）なら no-op。
 *
 * @param component - 島のView関数
 */
export const reRenderIsland = (component: Component): void => {
	const handle = islandMap.get(component);
	if (!handle) {
		// 未登録 → no-op（例外は投げない）
		return;
	}
	handle.reRender();
};

/**
 * ハンドルが指す島内部だけを差分再描画する
 * 親の再描画とは独立に、島ルートDOMの現在の親に対してpatchする。
 *
 * @param handle - 対象の島ハンドル
 */
function reRenderHandle(handle: IslandHandle): void {
	const nv = render(h(handle.component, handle.props));

	// 島ルートは単一ホスト要素前提なので、そのparentNodeから実DOM親を得る
	const rootDom = handle.oldVNode.dom;
	const parentDom = rootDom?.parentNode as HTMLElement | null;
	if (!parentDom) {
		// DOMツリーに繋がっていない（アンマウント済み等）→ no-op
		return;
	}

	// 自分自身の再描画中は、島ルートの __redoIsland ガード（外部の降下を防ぐ二重防御）を
	// 一時的に外す。これを外さないと、島ルートを起点にした自分のpatchが
	// patchChildren をスキップしてしまい、島内部を更新できない。
	delete (rootDom as any).__redoIsland;

	patch(parentDom, handle.oldVNode, nv);
	handle.oldVNode = nv;

	// 新しいルートDOMへスタンプし直す（型変更でルートが差し替わっていても正しく張り直せる）
	if (nv.dom) {
		(nv.dom as any).__redoIsland = handle;
	}
}
