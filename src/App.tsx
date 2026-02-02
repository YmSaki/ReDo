// src/App.tsx

import { Context } from "./redo";

let count = 0;
let text = "Hello ReDo";

const incriment = (ctx: Context) => {
	count++;
	ctx.reRender();
};

const changeText = (ctx: Context) => {
	text = (document.getElementById("testInput") as HTMLInputElement).value;
	ctx.reRender();
};

export const App = () => {
  return (
    <div className="app">
		  <h1>{text}</h1>
		  <p>Count: {count}</p>
      <button onClick={incriment}>+</button>

      <input id="testInput" value={text} onInput={changeText} />
    </div>
  );
};
