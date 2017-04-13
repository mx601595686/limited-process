/**
 * Created by wujingtao on 2017/4/13.
 */

const net = require('net');
const PostStream = require('post-stream');
const vm = require('vm');

const st = new net.Socket({
    fd: 3,
    allowHalfOpen: false,
    readable: true,
    writable: true
});

global.ps = new PostStream(st, st);
ps.data.once('_start', (config, code) => {
    const requireList = Array.isArray(config.require) ? config.require : [];
    global.requireList = requireList.map(name => require(name));

    process.mainModule = undefined;
    vm.runInThisContext(code, {
        filename: config.filename
    });
    ps.send('_start_finish');
});
