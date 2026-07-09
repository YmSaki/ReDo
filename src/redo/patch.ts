// src/redo/patch.ts
// VNode間の差分を検出してDOMを効率的に更新する

import { FRAGMENT, TEXT } from "./constants";
import { mount } from "./mount";
import { ComponentProps } from "./props";
import { enqueue } from "./queue";
import type { VNode } from "./vnode";
import { updateEvent } from "./domeventmanager";
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
			invokeUnmount(oldVNode);
			removeDoms(oldVNode);
		}
		return null;
	}

	// Case 2: Insert - 旧VNodeがnull → 新規マウント
	if (!oldVNode) {
		return mount(newVNode, parent);
	}

	// Case 3: Replace - 型が変わった → 要素を置き換え
	// Fragment ⇔ 通常要素の入れ替えにも耐えるよう、DOMノードのリスト単位で差し替える
	if (oldVNode.type !== newVNode.type) {
		invokeUnmount(oldVNode);

		// 新VNodeをマウント（Fragmentなら複数DOM、通常要素なら単一DOMになる）
		mount(newVNode, null);

		// 旧DOMの先頭位置に新DOMを差し込んでから、旧DOMを取り除く
		const ref = collectDoms(oldVNode)[0] ?? null;
		collectDoms(newVNode).forEach((dom) => parent.insertBefore(dom, ref));
		removeDoms(oldVNode);

		invokeUpdate(newVNode);
		return newVNode.dom ?? null;
	}

	// Case 4a: Fragment - 自身のDOMを持たず、子を同じ実DOM親に対して差分更新する
	if (newVNode.type === FRAGMENT) {
		patchChildren(parent, oldVNode.children, newVNode.children);
		return null;
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
	// 新しい属性を追加/更新
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

		// イベントハンドラ（onXxx）の差分更新
		if (key.startsWith("on")) {
			updateEvent(element, key, oldValue as Function, newValue as Function);
		} else {
			element.setAttribute(key, String(newValue));
		}

		// style属性の差分更新
		if (key === "style") {
			if (typeof newValue === "string") {
				element.style.cssText = newValue;
			}
			else if (typeof newValue === "object" && newValue !== null) {
				if (typeof oldValue === "object" && oldValue !== null) {
					for (const sKey in oldValue) {
						// @ts-ignore
						if (!(sKey in newValue)) element.style[sKey] = "";
					}
				}

				// 新しいスタイルを適用
				for (const sKey in newValue) {
					// @ts-ignore
					element.style[sKey] = newValue[sKey];
				}
			}
			continue;
		}

		// class / className の正規化
		if (key === "className") {
			element.setAttribute("class", String(newValue));
			continue;
		}

		// それ以外は通常の属性として設定
		// null/undefined/falseの場合は属性を削除（boolean属性対応）
		if (newValue == null || newValue === false) {
			element.removeAttribute(key);
		} else {
			// trueの場合は属性名のみ設定（<input disabled />）
			const attrValue = newValue === true ? "" : String(newValue);
			element.setAttribute(key, attrValue);
		}
	}

	// 削除された属性を除去
	for (const key in oldProps) {
		if (key === "children") {
			continue;
		}
		if (!(key in newProps)) {
			if (key.startsWith("on")) {
				updateEvent(element, key, oldProps[key] as Function, undefined);
			} else {
				element.removeAttribute(key);
			}
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
		invokeUnmount(child);
		removeDoms(child);
	});
	while (unKeydIndex < oldUnKeyd.length) {
		const child = oldUnKeyd[unKeydIndex];
		invokeUnmount(child);
		removeDoms(child);
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
	} else if (vnode.dom) {
		out.push(vnode.dom);
	}
	return out;
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

function invokeUnmount(vnode: VNode) {
	if (vnode.props.onUnmount) {
		enqueue(vnode.props.onUnmount, vnode.dom!);
	}
	vnode.children.forEach((child) => invokeUnmount(child));
}
