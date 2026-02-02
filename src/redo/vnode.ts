// redo/vnode.ts
// Virtual DOMノードの型定義

import { FRAGMENT, TEXT } from "./constants";
import { ReDoLifecycleEventsKey } from "./lifecycle";
import type { VNodeProps } from "./props";

/**
 * Virtual DOMノード（VNode）
 * コンポーネント関数が解決された後の、実際にDOMとして生成される要素を表現する
 * - HTML要素（"div", "span"など）
 * - Fragment（Symbol）
 * - テキストノード（TEXT Symbol）
 * - Key属性 (ライフサイクルイベント, 文字列, 数値, null)
 */
export type VNode = {
	/// 要素の型（HTML要素名またはシンボル）
	type: string | typeof FRAGMENT | typeof TEXT;
	/// 要素の属性
	props: VNodeProps;
	/// 子要素（すべて解決済みのVNode）
	children: VNode[];
	/// 対応する実際のDOM要素（差分検出用、mountまたはpatchで設定される）
	dom?: HTMLElement | Text;
	/// key属性
	key?: string | number;
};
