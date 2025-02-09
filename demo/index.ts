/*
 * @Author: chenzhongsheng
 * @Date: 2024-10-10 19:51:56
 * @Description: Coding something
 */

import { WebOS, OpenUrlCommand, Disk } from '@weoos/os';
// import { WebOS, OpenUrlCommand } from '../packages/os/dist';

function initOS () {
    const os = new WebOS({
        // enableSync: true,
    });
    os.registerCommand(OpenUrlCommand);
    // @ts-ignore
    window.os = os;

    os.disk.watch('/aa',  { recursive: true }, (event, filename) => {
        console.trace('watch', event, filename);
    });
}

initOS();

window.initDisk = () => {
    window.dd = new Disk({ enableSync: true });
};