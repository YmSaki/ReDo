// src/redo-router/index.ts
import { h } from "../redo";
import type { Component, App } from "../redo";
import type { RouteParams, RouterProps } from "./types";

/**
 * ReDo Router クラス
 * 複数のルーターインスタンスを作成可能にする（マルチウィンドウ対応なども視野）
 */
export class ReDoRouter {
	// 制御対象のAppインスタンス（最初は未接続）
	private app: App | null = null;

	// 現在のパス (Routerインスタンスごとに独立)
	private currentPath: string = window.location.pathname;

	constructor() {
		// ブラウザバック検知
		window.addEventListener("popstate", () => {
			this.currentPath = window.location.pathname;
			console.log(`[ReDo-Router] PopState: ${this.currentPath}`);
			// 接続されているアプリがあれば再描画
			this.app?.reRender();
		});
	}

	/**
	 * エンジン（App）と接続する
	 * これを呼ばないと navigate しても画面が変わらない
	 */
	connect(app: App) {
		this.app = app;
		console.log("[ReDo-Router] Engine Connected.");
	}

	/**
	 * 指定したパスに遷移する
	 */
	navigate = (to: string) => {
		if (this.currentPath === to) return;

		window.history.pushState({}, "", to);
		this.currentPath = to;
		console.log(`[ReDo-Router] Navigated to ${to}`);

		if (this.app) {
			this.app.reRender();
		} else {
			console.warn("[ReDo-Router] Engine not connected. Call router.connect(app) first.");
		}
	};

	/**
	 * 現在のパスを取得
	 */
	getPath = () => this.currentPath;

	// === Components (インスタンスメソッドとして提供) ===
	// こうすることで、<myRouter.Router /> のように特定のルーターに紐付いたコンポーネントを使える

	/**
	 * ルーターコンポーネント
	 */
	Router: Component<RouterProps> = ({ routes, fallback }) => {
		// this.currentPath を参照する（クロージャではなくクラスメンバ）
		const path = this.currentPath;

		for (const route of routes) {
			const params = this.matchRoute(route.path, path);
			if (params) {
				return h(route.component, { params });
			}
		}

		if (fallback) {
			return h(fallback, {});
		}
		return h("div", {}, "404 Not Found");
	};

	/**
	 * リンクコンポーネント
	 */
	Link: Component<{ to: string }> = (props) => {
		const onClick = (e: Event) => {
			e.preventDefault();
			this.navigate(props.to);
		};

		return h("a", {
			...props,
			href: props.to,
			onClick
		}, props.children);
	};

	// === Private Helpers ===

	private splitPath(path: string): string[] {
		return path.split("/").filter((p) => p.length > 0);
	}

	private matchRoute(routePath: string, actualPath: string): RouteParams | null {
		const routeSegs = this.splitPath(routePath);
		const actualSegs = this.splitPath(actualPath);

		if (routeSegs.length !== actualSegs.length) {
			return null;
		}

		const params: RouteParams = {};

		for (let i = 0; i < routeSegs.length; i++) {
			const r = routeSegs[i];
			const a = actualSegs[i];

			if (r.startsWith(":")) {
				params[r.slice(1)] = a;
				continue;
			}

			if (r !== a) {
				return null;
			}
		}
		return params;
	}
}
