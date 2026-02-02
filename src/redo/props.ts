// src/redo/props.ts
// コンポーネントや要素の属性（props）の型定義

import { ReDoEvent } from "./event";
import { JSXNode } from "./jsx-node";
import { LifecycleEvent } from "./lifecycle";

export type BaseProps = {
	/**
	 * 差分検知用
	 */
	key?: string | number;
	/**
	 * 子要素
	 */
	children?: JSXNode[];
}

export type LifecycleProps = {
	/**
	 * マウント時イベント
	 */
	onMount?: LifecycleEvent;

	/**
	 * 表示更新時イベント
	 * @experimental
	 */
	onUpdate?: LifecycleEvent;

	/**
	 * マウント解除時イベント
	 * @experimental
	 */
	onUnmount?: LifecycleEvent;
}

/**
 * VNodeの属性の型
 */
export type VNodeProps = {
	/**
	 * 任意の属性名と値
	 */
	[key: string]: string | number | boolean | Function | ReDoEvent<unknown> | undefined;
} & LifecycleProps;

/**
 * コンポーネントの属性の型
 * - children: 子要素
 * - その他の任意の属性を許容する
 * 
 * TODO: childrenの型と責務を再設計する
 * @internal
 */
export type ComponentProps<P = {}> = BaseProps & LifecycleProps & P & {
	/// 任意の属性名と値
	[key: string]: unknown;
};
