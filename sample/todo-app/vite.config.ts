// sample/todo-app/vite.config.ts
// このサンプル専用のvite設定。
//
// なぜルート専用のvite.config.tsとは別に必要か:
// redo-router(ReDoRouter)は window.location.pathname をそのまま "/", "/active",
// "/completed" と比較する(サブパスに対応していない)。リポジトリルートのvite設定で
// sample/todo-app/index.html をネスト配信すると、実際のpathnameは
// "/sample/todo-app/index.html" になってしまい、どのルートにもマッチせずfallbackに
// 落ちる(実際にPlaywrightで確認して発覚)。
//
// そのためこのサンプルは「vite root = このディレクトリ」で単独のSPAとして起動する。
// こうすると index.html がこのルートの "/" となり、redo-routerの絶対パス前提と一致する。
// devサーバーはSPA(appType既定値)なので、/active や /completed への直接アクセスや
// ブラウザバックでも index.html にフォールバックされ、pushStateベースのルーティングが動く。
//
// 起動方法: このディレクトリで `npx vite` を実行する（README.md参照）。

import { defineConfig, searchForWorkspaceRoot } from "vite";

export default defineConfig({
	esbuild: {
		// JSX を何に変換するか(リポジトリルートのvite.config.tsと同じ設定)
		jsx: "transform",
		jsxFactory: "h",
		jsxFragment: "Fragment",

		// jsxInjectは各ファイルからの相対パスとして解決されるため、ルート直下の
		// vite.config.tsの絶対パス版("/src/redo/h")ではなく相対パスにする。
		// sample/todo-app配下のtsxファイルはすべて同じ深さにあるため、この相対パスで揃う。
		jsxInject: `import { h, Fragment } from "../../src/redo/h"`,
	},
	server: {
		port: 3001,
		fs: {
			// vite rootがsample/todo-appになるため、既定では../../src配下の読み取りが
			// 拒否される。ワークスペースルート(リポジトリルート)を明示的に許可する。
			allow: [searchForWorkspaceRoot(process.cwd())],
		},
	},
});
