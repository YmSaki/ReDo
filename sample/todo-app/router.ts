// sample/todo-app/router.ts
// ReDoRouterのインスタンスと、URLパス⇔Filterの対応付け（機能6）

import { ReDoRouter } from "../../src/redo-router";
import type { Filter } from "./types";

/** このアプリ専用のルーターインスタンス（複数インスタンス作成が可能な設計なので、ここで1つ持つ） */
export const router = new ReDoRouter();

/** URLパス → フィルタ */
export const pathToFilter = (path: string): Filter => {
	if (path === "/active") return "active";
	if (path === "/completed") return "completed";
	return "all";
};

/** フィルタ → URLパス */
export const filterToPath = (filter: Filter): string => {
	if (filter === "active") return "/active";
	if (filter === "completed") return "/completed";
	return "/";
};
