// src/redo/lifecycle.ts
// コンポーネントのライフサイクルイベントの型定義

import { ReDoEvent } from "./event";

export type LifecycleEvent = ReDoEvent<HTMLElement | Text>;

export type ReDoLifecycleEventsKey = "onMount" | "onUnmount" | "onUpdate";

/**
 * 実行時に参照できるライフサイクルpropsキーの一覧
 * ReDoLifecycleEventsKey 型と内容を一致させること
 */
export const LIFECYCLE_EVENT_KEYS: readonly ReDoLifecycleEventsKey[] = ["onMount", "onUpdate", "onUnmount"];

/**
 * 指定したキーがライフサイクルprops（onMount/onUpdate/onUnmount）かどうかを判定する
 * DOMイベントハンドラ（onClickなど）と区別するために使用する
 *
 * @param key - 判定対象のprop名
 * @returns ライフサイクルpropsのキーであればtrue
 */
export function isLifecycleEventKey(key: string): key is ReDoLifecycleEventsKey {
	return (LIFECYCLE_EVENT_KEYS as readonly string[]).includes(key);
}
