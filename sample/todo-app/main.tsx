// sample/todo-app/main.tsx
// エントリポイント: TodoStore・ReDoRouter・ReDo本体(init)を配線する（機能6）
//
// 島(list/summary/nav island)は親からのprops自動伝播をしない設計（src/redo/island.tsのBOUNDARY
// 分岐を参照）なので、URLパス→filterの反映は「router.navigateをラップする」「popstateを
// 自前でも購読する」の2箇所で明示的に store.setFilter() と reRenderIsland(FilterNavView) を
// 呼んで同期する。router.ts自体は変更しない（サンプル側だけで完結させる）。

import { init, reRenderIsland } from "../../src/redo";
import { router, pathToFilter } from "./router";
import { store } from "./store";
import { TodoApp, FilterNavView } from "./TodoApp";

const syncFilterFromPath = (path: string): void => {
	store.setFilter(pathToFilter(path));
	// nav islandはstore.filterを読んで選択中のリンクをハイライトするが、
	// 親からの自動propagationがないので明示的に再描画する
	reRenderIsland(FilterNavView);
};

// 1. Linkクリック時の同期: router.navigateをラップし、実際のナビゲーション
//    （history更新 + アプリ全体のreRender）の前に filter を同期しておく
const originalNavigate = router.navigate;
router.navigate = (to: string) => {
	syncFilterFromPath(to);
	originalNavigate(to);
};

// 2. ブラウザバック/フォワード時の同期: ReDoRouterも内部でpopstateを購読しているが、
//    こちらは自分専用のリスナーとしてfilter同期だけを行う
window.addEventListener("popstate", () => {
	syncFilterFromPath(window.location.pathname);
});

// 初期表示をURLに合わせておく（island mount前なのでreRenderIsland呼び出し自体は
// 実質no-opだが、store.filterはここで正しくセットされ、初回マウント時のViewに反映される）
syncFilterFromPath(window.location.pathname);

const root = document.getElementById("root");

if (root) {
	const app = init(TodoApp, root);
	router.connect(app);
}
