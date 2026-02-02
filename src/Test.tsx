// src/Test.tsx
import { Context, Component, Event } from "./redo";

// --- グローバル状態 (簡易ストア) ---
const state = {
    list: [
        { id: 1, val: "Alpha" },
        { id: 2, val: "Bravo" },
        { id: 3, val: "Charlie" },
        { id: 4, val: "Delta" },
        { id: 5, val: "Echo" },
    ],
    lastShuffle: Date.now(),
};

// --- ロジック ---

// Fisher-Yates shuffle
const shuffle: Event<any> = (ctx) => {
    const arr = state.list;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.lastShuffle = Date.now();
    ctx.reRender();
};

// --- ライフサイクル ---

const onMountLog = (name: string) => (ctx: Context<HTMLElement>) => {
    const el = ctx.payload;
    if (el) {
        console.log(`[Mount] ${name}`);
        // マウント時（生成時）のみ青く光る
        // ※ もしシャッフルで光ったら、それは「移動」じゃなくて「再生成」されてる証拠（バグ）だ
        const originalBg = el.style.backgroundColor;
        el.style.backgroundColor = "#e0f7fa"; 
        setTimeout(() => (el.style.backgroundColor = originalBg), 500);
    }
};

// --- コンポーネント ---

const ListItem: Component<{ item: { id: number; val: string } }> = ({ item }) => {
    return (
        <div
            key={item.id} // DOMの同一性を保証するID
            class="list-item"
            style="margin: 5px; padding: 10px; border: 1px solid #ccc; display: flex; gap: 10px; align-items: center; background: white; transition: transform 0.2s;"
            onMount={onMountLog(`Item-${item.id}`)}
        >
            <div style="width: 150px; font-weight: bold;">
                ID: {item.id} ({item.val})
            </div>
            
            {/* Uncontrolled Input 
               ReDoがDOMを再利用していれば、ユーザーがタイプした内容は
               DOMプロパティとして残っているため、シャッフルしても消えないし移動する。
            */}
            <input 
                placeholder={`Type something for ${item.val}...`} 
                style="padding: 5px; flex-grow: 1; border: 1px solid #ddd; border-radius: 4px;"
                onInput={(ctx: Context<Event>) => console.log(`Typing in ${item.id}...`)}
            />
        </div>
    );
};

export const App: Component = () => {
    return (
        <div style="padding: 20px; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="border-bottom: 2px solid #333; padding-bottom: 10px;">
                ReDo v0.9: Keyed Diff Proof
            </h1>
            
            <div style="margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 8px;">
                <p style="margin-top: 0;">
                    <strong>実験手順:</strong>
                </p>
                <ol>
                    <li>下の入力欄に適当な文字を入れる（例: "Aのメモ", "Bのメモ"）</li>
                    <li><button onClick={shuffle} style="cursor: pointer; font-weight: bold;">🔀 Shuffle List</button> を押す</li>
                    <li><strong>期待値:</strong> 入力した文字が、IDと一緒に移動する。</li>
                    <li><strong>失敗例:</strong> 文字がその場に残る、または消える。</li>
                </ol>
            </div>

            <div class="list-container" style="display: flex; flex-direction: column;">
                {state.list.map((item) => (
                    <ListItem key={item.id} item={item} />
                ))}
            </div>

            <div style="margin-top: 20px; font-size: 0.8em; color: #666;">
                Last Render: {new Date(state.lastShuffle).toLocaleTimeString()}
            </div>
        </div>
    );
};
