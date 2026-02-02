// src/redo-router/types.ts
import { Component } from "../redo";

/**
 * ルート定義オブジェクト
 */
export type RouteDef = {
	path: string;
	component: Component<any>;
};

/**
 * URLパラメータ
 * /user/:id -> { id: "123" }
 */
export type RouteParams = Record<string, string>;

/**
 * RouterコンポーネントのProps
 */
export type RouterProps = {
	routes: RouteDef[];
	fallback?: Component;
};
