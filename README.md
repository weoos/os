<!--
 * @Author: chenzhongsheng
 * @Date: 2025-01-20 15:30:07
 * @Description: Coding something
-->
# [@weoos/os](https://github.com/weoos/os)

Pure front-end OS on Browser

[visit](https://weoos.github.io/os)

- @weoos/os: Main lib.
- @weoos/disk: Disk support
- @weoos/cmd: Command support
- @weoos/event: Event bus cross any environment
- @weoos/utils: utils for @weoos/os

```
npm i @weoos/os
```

```js
import { WebOS } from '@weoos/os';
const os = new WebOS();
```

or use container

```js
const os1 = new WebOS('#app');
const os2 = new WebOS(document.getElementById('app'));
```

[typings](https://cdn.jsdelivr.net/npm/@weoos/os/index.d.ts)

```ts
export declare class WebOS {
	term: WebTerm;
	pwd: string;
	commandProvider: CommandProvider;
	get disk(): Disk;
	get header(): string;
	static instance: WebOS;
	constructor(container?: string | HTMLElement);
	get registerCommand(): CommandProvider["registerCommand"];
	get removeCommand(): CommandProvider["removeCommand"];
}
```
