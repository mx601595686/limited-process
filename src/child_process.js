/**
 * Created by wujingtao on 2017/4/13.
 */

const fs = require('fs');
const PostStream = require('post-stream');
const vm = require('vm');

let readable = fs.createReadStream(null, {fd: 4});
let writable = fs.createWriteStream(null, {fd: 3});

global.ps = new PostStream(readable, writable);
global.ps.data.once('_start', (config, code) => {
    const requireList = Array.isArray(config.require) ? config.require : [];
    global.requireList = requireList.map(name => require(name));

    process.mainModule = undefined;
    global.ps.send('_start_finish');

    vm.runInThisContext(code, {
        filename: config.filename
    });
});
