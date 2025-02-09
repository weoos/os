<!--
 * @Author: chenzhongsheng
 * @Date: 2025-01-20 15:30:07
 * @Description: Coding something
-->
# [@weoos/os](https://github.com/weoos/os)

Pure front-end OS on Browser

[visit](https://weoos.github.io/os)

- @weoos/os: Main lib. [typings](https://cdn.jsdelivr.net/npm/@weoos/os/index.d.ts)
- @weoos/disk: Disk support. [typings](https://cdn.jsdelivr.net/npm/@weoos/disk/index.d.ts)
- @weoos/cmd: Command support. [typings](https://cdn.jsdelivr.net/npm/@weoos/cmd/index.d.ts)
- @weoos/event: Event bus cross any environment. [typings](https://cdn.jsdelivr.net/npm/@weoos/event/index.d.ts)
- @weoos/utils: utils for @weoos/os. [typings](https://cdn.jsdelivr.net/npm/@weoos/utils/index.d.ts)

```
npm i @weoos/os
```

```js
import { WebOS } from '@weoos/os';
const os = new WebOS();
```

or use container

```js
const os1 = new WebOS({
	container: '#app',
});
const os2 = new WebOS({
	container: document.getElementById('app'),
});
```

```ts
export declare class WebOS {
	term: WebTerm;
	pwd: string;
	commandProvider: CommandProvider;
	get disk(): Disk;
	get header(): string;
	static instance: WebOS;
	constructor({ container, title, padding, enableSync, }?: {
		container?: string | HTMLElement;
		title?: string;
		padding?: number;
		enableSync?: boolean;
	});
	registerCommand(command: ICommand): IOprateResult;
	get removeCommand(): CommandProvider["removeCommand"];
}
```
