/**
 * Created by wujingtao on 2017/4/13.
 */

const fs = require('fs');
const PostStream = require('post-stream');
const vm = require('vm');

const internalService = {
    async start(requireList, jsCode, fileName) {
        requireList.forEach(name => {
            global.lp.requireList[name] = require(name);
        });
        process.mainModule = undefined;

        vm.runInThisContext('debugger;\n' + jsCode, {
            filename: fileName
        });

        await global.lp.onStart();
    },
    async close() {
        await global.lp.onClose();
    }
};

let readable = fs.createReadStream(null, { fd: 4 });
let writable = fs.createWriteStream(null, { fd: 3 });
const ps = new PostStream(readable, writable);

//receive Invoke
ps.data.on('_invoke', async function (isInternal, functionName, args, callback) {
    const service = isInternal ? internalService : global.lp.service;

    try {
        const result = await service[functionName](...args);
        ps.send(callback, undefined, result);
    } catch (e) {
        ps.send(callback, { message: e.message, stack: e.stack });
    }
});

function sendInvoke(isInternal, functionName, ...args) {
    const callback = '_' + Math.random();
    ps.send('_invoke', isInternal, functionName, args, callback);

    return new Promise((resolve, reject) => {
        ps.data.once(callback, function (err, data) {
            if (err !== undefined) reject(err);else resolve(data);
        });
    });
}

setInterval(function () {
    sendInvoke(true, 'updateCPUMemory', process.cpuUsage(), process.memoryUsage());
}, 500);

//region error handle

async function errorHandler(err) {
    let resolve = false;
    try {
        resolve = await global.lp.onError(err);
    } catch (e) {
        err = e;
    }
    if (resolve === false) sendInvoke(true, 'uncaughtException', { message: err.message, stack: err.stack });
}

process.on('uncaughtException', errorHandler);
process.on('unhandledRejection', errorHandler);

//endregion

global.lp = {
    invoke: new Proxy(sendInvoke.bind(null, false), {
        get(target, property) {
            return target.bind(null, property);
        }
    }),
    requireList: {},
    service: {},
    onClose: () => Promise.resolve(),
    onStart: () => Promise.resolve(),
    onError: () => false
};