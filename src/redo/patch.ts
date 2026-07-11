// src/redo/patch.ts
// VNode間の差分を検出してDOMを効率的に更新する

import { BOUNDARY, FRAGMENT, TEXT } from "./constants";
import { mount } from "./mount";
import { unmountIsland } from "./island";
import { ComponentProps } from "./props";
import { enqueue } from "./queue";
import type { VNode } from "./vnode";
import { applyAttribute } from "./domattribute";
import { ReDoEvent } from "./event";

/**
 * 旧VNodeと新VNodeを比較してDOMを差分更新する
 * フォーカスやスクロール位置を維持しながら、変更のあった部分のみを更新する
 *
 * @param parent - 親となるDOM要素
 * @param oldVNode - 前回レンダリング時のVNode
 * @param newVNode - 今回レンダリングするVNode
 * @param index - 子要素のインデックス（内部用）
 * @returns 更新されたDOM要素
 */
export function patch(
	parent: HTMLElement,
	oldVNode: VNode | null,
	newVNode: VNode | null
): HTMLElement | Text | null {
	// Case 1: Delete - 新VNodeがnull → 要素を削除
	// Fragmentは自身のDOMを持たず複数のDOMを親に展開するため、collectDomsで全て取り除く
	if (!newVNode) {
		if (oldVNode) {
			removeVNode(oldVNode);
		}
		return null;
	}

	// Case 2: Insert - 旧VNodeがnull → 新規マウント
	if (!oldVNode) {
		return mount(newVNode, parent);
	}

	// Case 3: Replace - 型が変わった → 要素を置き換え
	// Fragment ⇔ 通常要素、境界(BOUNDARY) ⇔ 他 の入れ替えにも耐えるよう、DOMノードのリスト単位で差し替える
	if (oldVNode.type !== newVNode.type) {
		// 旧DOMの先頭位置を先に確保しておく（撤去前）
		const ref = collectDoms(oldVNode)[0] ?? null;

		// 新VNodeをマウント（Fragmentなら複数DOM、境界なら島を生成、通常要素なら単一DOM）
		mount(newVNode, null);
		collectDoms(newVNode).forEach((dom) => parent.insertBefore(dom, ref));

		// 旧を撤去（境界なら島を破棄する）
		removeVNode(oldVNode);

		invokeUpdate(newVNode);
		return newVNode.dom ?? null;
	}

	// Case 4a: Fragment - 自身のDOMを持たず、子を同じ実DOM親に対して差分更新する
	if (newVNode.type === FRAGMENT) {
		patchChildren(parent, oldVNode.children, newVNode.children);
		return null;
	}

	// Case 4b: Boundary(島) - 内部は島が所有するため、親の再描画は境界内部に立ち入らない（不透明）
	if (newVNode.type === BOUNDARY) {
		const handle = oldVNode.island;

		// 同一のView関数の島 → 内部に一切触れない。ハンドルとDOM参照だけ引き継ぐ。
		// （親からのprops自動伝播はしない設計なので handle.props は更新しない）
		if (handle && handle.component === newVNode.component) {
			newVNode.island = handle;
			newVNode.dom = handle.oldVNode.dom;
			return handle.oldVNode.dom ?? null;
		}

		// 異なるView関数の島 → 古い島を撤去して新しい島に置き換える
		const ref = collectDoms(oldVNode)[0] ?? null;
		mount(newVNode, null);
		collectDoms(newVNode).forEach((dom) => parent.insertBefore(dom, ref));
		removeVNode(oldVNode);
		return newVNode.dom ?? null;
	}

	// Case 4: Update - 同じ要素 → DOM参照を引き継ぐ
	const element = (newVNode.dom = oldVNode.dom!) as HTMLElement;

	// Case 5: Update - テキストノード → 内容が変わっていれば更新
	if (newVNode.type == TEXT) {
		if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
			element.nodeValue = String(newVNode.props.nodeValue);
		}
		invokeUpdate(newVNode);
		return element;
	}

	// Case 6: Update - HTML要素 → 属性と子要素を差分更新
	patchProps(element, oldVNode.props, newVNode.props);

	// 二重防御: 対象DOMが島ルート(__redoIsland)なら、その内部は島が所有するので子には立ち入らない
	if ((element as any).__redoIsland) {
		invokeUpdate(newVNode);
		return element;
	}

	// 子要素を再帰的に差分更新
	patchChildren(element, oldVNode.children, newVNode.children);

	invokeUpdate(newVNode);

	return element;
}

/**
 * 要素の属性（props）を差分更新する
 * 変更があった属性のみを更新し、削除された属性を削除する
 *
 * @param element - 更新対象のDOM要素
 * @param oldProps - 前回の属性
 * @param newProps - 今回の属性
 */
function patchProps(element: HTMLElement, oldProps: ComponentProps, newProps: ComponentProps) {
	// 新しい属性を追加/更新（実際の反映ロジックはmount.tsと共通のapplyAttributeに一本化）
	for (const key in newProps) {
		if (key === "children") {
			continue;
		}

		const oldValue = oldProps[key];
		const newValue = newProps[key];

		// 値が変わっていなければスキップ
		if (oldValue === newValue) {
			continue;
		}

		applyAttribute(element, key, oldValue, newValue);
	}

	// 削除された属性を除去（newValueにundefinedを渡すことでapplyAttributeに削除させる）
	for (const key in oldProps) {
		if (key === "children") {
			continue;
		}
		if (!(key in newProps)) {
			applyAttribute(element, key, oldProps[key], undefined);
		}
	}
}

/**
 * 子VNodeのリストをkeyed diffで差分更新する
 *
 * 実DOMの位置を「VNodeのインデックス == childNodesのインデックス」で決め打ちせず、
 * 各VNodeが親に展開する実DOMノード（collectDoms）を基準に最終的な並びを組み立てる。
 * これによりFragment（1VNodeが複数DOMを親に直接ぶら下げる）や、Fragmentと兄弟要素の
 * 混在があっても位置がずれない。
 *
 * @param parent - 子が展開される実DOM親
 * @param oldChildren - 前回の子VNode配列
 * @param newChildren - 今回の子VNode配列
 */
function patchChildren(parent: HTMLElement, oldChildren: VNode[], newChildren: VNode[]) {
	const oldMap = new Map<string | number, VNode>();
	const oldUnKeyd: VNode[] = [];

	oldChildren.forEach((child) => {
		if (child.key != null) {
			oldMap.set(child.key, child);
		} else {
			oldUnKeyd.push(child);
		}
	});

	let unKeydIndex = 0;

	// 1. 各newChildをoldChildに対応付けて patch もしくは mount する
	//    （この時点では位置は気にせず、DOM参照が張られている状態にするだけ）
	newChildren.forEach((child) => {
		let oldChild: VNode | undefined;
		if (child.key != null) {
			oldChild = oldMap.get(child.key);
			if (oldChild) {
				oldMap.delete(child.key);
			}
		} else if (unKeydIndex < oldUnKeyd.length) {
			oldChild = oldUnKeyd[unKeydIndex];
			unKeydIndex++;
		}

		if (oldChild) {
			// 一致する場合はDOMを再利用しつつ中身を差分更新
			patch(parent, oldChild, child);
		} else {
			// 新規作成（DOMは切り離した状態で生成し、配置は後段のplaceChildrenに委ねる）
			mount(child, null);
		}
	});

	// 2. 対応が付かなかった古い子を削除する
	oldMap.forEach((child) => {
		removeVNode(child);
	});
	while (unKeydIndex < oldUnKeyd.length) {
		const child = oldUnKeyd[unKeydIndex];
		removeVNode(child);
		unKeydIndex++;
	}

	// 3. newChildrenの順序どおりに実DOMを並べ替える
	placeChildren(parent, newChildren);
}

/**
 * VNodeが親に直接ぶら下げる「トップレベルの実DOMノード」を出現順に収集する
 * Fragmentは自身のDOMを持たないため、子のDOMを再帰的にたどって集める
 *
 * @param vnode - 収集対象のVNode
 * @param out - 収集結果を書き込む配列（内部用）
 * @returns 収集された実DOMノードの配列
 */
function collectDoms(vnode: VNode, out: (HTMLElement | Text)[] = []): (HTMLElement | Text)[] {
	if (vnode.type === FRAGMENT) {
		vnode.children.forEach((child) => collectDoms(child, out));
	} else if (vnode.type === BOUNDARY) {
		// 境界の実DOMは島が所有する。現在の島ルートDOMをハンドル経由で辿る（唯一の真実）
		const root = vnode.island?.oldVNode.dom ?? vnode.dom;
		if (root) {
			out.push(root);
		}
	} else if (vnode.dom) {
		out.push(vnode.dom);
	}
	return out;
}

/**
 * VNodeサブツリーを撤去する
 * 境界(BOUNDARY)なら島を破棄し、それ以外は通常のライフサイクル＋DOM撤去を行う。
 *
 * @param vnode - 撤去対象のVNode
 */
function removeVNode(vnode: VNode) {
	if (vnode.type === BOUNDARY) {
		unmountIsland(vnode);
		return;
	}
	invokeUnmount(vnode);
	removeDoms(vnode);
}

/**
 * VNodeが親にぶら下げている実DOMノードを全て取り除く
 * Fragmentでは複数、通常要素では自身（＝サブツリーごと）が対象になる
 *
 * @param vnode - 削除対象のVNode
 */
function removeDoms(vnode: VNode) {
	collectDoms(vnode).forEach((dom) => dom.remove());
}

/**
 * newChildrenの順序どおりに実DOMを親要素内へ並べ替える
 *
 * 右から左へ insertBefore していくことで、各子（Fragmentなら複数DOM）のまとまりを
 * 崩さずに正しい順序へ配置する。既に正しい位置にあるノードは動かさない。
 *
 * @param parent - 子が展開される実DOM親
 * @param newChildren - 配置したい順序の子VNode配列
 */
function placeChildren(parent: HTMLElement, newChildren: VNode[]) {
	// ref = 「次に挿入する子の直後に来るべきDOMノード」。末尾はnull（= parentの末尾）
	let ref: Node | null = null;

	for (let i = newChildren.length - 1; i >= 0; i--) {
		const doms = collectDoms(newChildren[i]);
		for (let j = doms.length - 1; j >= 0; j--) {
			const node = doms[j];
			// 既に parent 内で ref の直前にあるなら動かさない
			// （新規マウント直後の切り離されたノードは parentNode が異なるので必ず挿入される）
			if (node.parentNode !== parent || node.nextSibling !== ref) {
				parent.insertBefore(node, ref);
			}
			ref = node;
		}
	}
}

function invokeUpdate(vnode: VNode) {
	if (vnode.props.onUpdate) {
		enqueue(vnode.props.onUpdate, vnode.dom!);
	}
}

/**
 * VNodeサブツリーの onUnmount を再帰的に enqueue する
 * 削除経路（removeVNode）と、島の撤去（island.ts の unmountIsland）から共有する。
 * 発火は enqueue 経由（マイクロタスク）。
 *
 * @param vnode - 撤去対象のVNode（島の場合は島内部の解決済みサブツリー）
 */
export function invokeUnmount(vnode: VNode) {
	if (vnode.props.onUnmount) {
		enqueue(vnode.props.onUnmount, vnode.dom!);
	}
	vnode.children.forEach((child) => invokeUnmount(child));
}
