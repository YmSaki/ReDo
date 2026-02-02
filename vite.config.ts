// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
	esbuild: {
		// JSX を何に変換するか
		jsx: 'transform',
		jsxFactory: "h",
		jsxFragment: "Fragment",

		// 毎回 import { h, Fragment } from... と書かなくていいように自動注入する
		// ※ パスはあなたのフォルダ構成に合わせてね
		jsxInject: `import { h, Fragment } from "/src/redo/h"`,
	},
	server: {
		port: 3000,
	},
});
