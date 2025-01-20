/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-05 22:48:36
 * @Description: Coding something
 */

async function main () {
    const root = await navigator.storage.getDirectory();
    window.root = root;
    // return;
    // debugger;

    // console.log(await navigator.permissions.query({ name: 'persistent-storage' }));

    const fileHandle = await root.getFileHandle('draft.txt', { create: true });
    // Get sync access handle
    const file = await fileHandle.getFile();
    // fileHandle.requestPermission().then(d => {console.log(d);});
    // debugger;


    // Get size of the file.
    const fileSize = file.size;
    // Read file content to a buffer.
    const readBuffer = await file.arrayBuffer();

    console.log(`size=${fileSize}; buffer=`, new Uint8Array(readBuffer));


    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode('hello2');
    const write = await fileHandle.createWritable();

    // await write.write({ type: 'write', position: 0, data: encodedMessage });
    // await write.write({ type: 'write', position: 6, data: encodedMessage });
    // await write.close();


    // // 将文件大小调整为 size 字节长
    // await write.write({ type: 'truncate', size: 12 });
    // // 将当前文件游标偏移更新到指定的位置
    // await write.write({ type: 'seek', position: 6 });
    // await write.write({ type: 'write', position: 6, data: encodedMessage });

    // write.

    // // // await write.write(encodedMessage);
    // // await write.seek(6);
    // await write.write({ type: 'write', position: 6, data: encodedMessage });

    // // // // close the file and write the contents to disk.
    // await write.close();

}
main();