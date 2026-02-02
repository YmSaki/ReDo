// src/redo/component.ts
// UI部品を定義するための関数の型

import type { JSXNode } from "./jsx-node";
import { BaseProps, LifecycleProps } from "./props";

/**
 * UI部品を定義するための関数の型
 * propsを受け取り、JSXNodeを返す純粋な関数
 *
 * @template P - propsの型（デフォルトはany）
 * @example
 * // サンプル: 文字を表示するためのUI部品
 * const Greeting: Component<{ name: string }> = (props) => {
 *   return <div>Hello {props.name}</div>;
 * };
 */
export type Component<P = any> = (props: P & BaseProps & LifecycleProps) => JSXNode;
