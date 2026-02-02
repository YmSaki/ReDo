// src/index.tsx

import { App } from "./Test";
import { init } from "./redo";

// --- ここで実行する (HTMLから移動してきた部分) ---
const root = document.getElementById("root");

if (root) {
    init(App, root);
}
