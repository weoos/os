/*
 * @Author: chenzhongsheng
 * @Date: 2024-10-10 19:51:56
 * @Description: Coding something
 */

import { WebOS, OpenUrlCommand } from '@weoos/os';

const os = new WebOS();
os.registerCommand(OpenUrlCommand);

window.os = os;

os.disk.watch('/aa',  { recursive: true }, (event, filename) => {
    console.trace('watch', event, filename);
});