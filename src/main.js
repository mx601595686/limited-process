/**
 * Created by wujingtao on 2017/4/15.
 */

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmiter = require('events');
const PostStream = require('post-stream');

module.exports = class LimitedProcess extends EventEmiter {

    fileName = `tempJS:${Math.random()}`;
    jsCode = '';
    requireList = [];
    service = {};
    cpuUsage;
    memoryUsage;
    errors = [];
    isRunning = false;
    startTime;

    constructor(fileName, jsCode) {
        super();
        if ('string' === typeof jsCode) {
            this.jsCode = jsCode;
            if ('string' === typeof fileName) {
                this.fileName = fileName;
            }
        } else if ('string' === typeof fileName) {
            const stats = fs.statSync(fileName);
            if (stats.isFile()) {
                this.jsCode = fs.readFileSync(fileName, 'utf8');
                this.fileName = fileName;
            } else {
                throw new Error(`path: ${fileName} is not a file`);
            }
        }
    }

    start(option = {debug: false}) {
        if (this.isRunning) return;

        const startArgs = [path.resolve(__dirname, './child_process.js')];

        if (option.debug) {
            const debug = ['--inspect'];
            if ('string' === typeof option.debug)
                debug.push(option.debug);
            startArgs.unshift(debug.join('='))
        }

        //region create child process

        this._childProcess = child_process.spawn(process.execPath, startArgs, {
            stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
            uid: option.uid,
            gid: option.gid,
            cwd: option.cwd,
            env: option.env
        });

        this._childProcess.on('close', (...args) => {
            this._clear();
            this.emit('close', ...args);
        });

        this._childProcess.on('error', (...args) => {
            this._clear();
            this.emit('error', ...args);
        });

        this._childProcess.on('exit', (...args) => {
            this._clear();
            this.emit('exit', ...args);
        });

        this.isRunning = true;
        this.startTime = new Date();
        this._ps = new PostStream(this._childProcess.stdio[3], this._childProcess.stdio[4]);
        this._ps.data.on('__invoke', this._receivedInvoke);

        //endregion

        if (option.debug) {
            return new Promise((resolve, reject) => {
                this._childProcess.stderr.once('data', data => {
                    data = data.toString();
                    const match = data.match(/(?!\s)(chrome-devtools.+)(?!\b)/g);
                    if (match.length > 0) {
                        resolve({
                            address: match[0],
                            start: () => {
                                this._sendInvoke(true, 'start', this.requireList, this.jsCode, this.fileName);
                            }
                        })
                    } else {
                        reject(new Error('parse debug path failed：' + data));
                    }
                });
            });
        } else {
            this._sendInvoke(true, 'start', this.requireList, this.jsCode, this.fileName);
        }
    }

    invoke = new Proxy(this._sendInvoke.bind(null, false), {
        get(target, property){
            return target.bind(null, property);
        }
    });

    setTimeout(delay) {
        setTimeout(() => {
            this.kill();
        }, delay);
    }

    //region internal

    _childProcess;
    _ps;

    _internalService = {
        updateCPUMemory: (cpu, memory) => {
            this.cpuUsage = cpu;
            this.memoryUsage = memory;
        },
        uncaughtException: (err) => {
            this.errors.push(err);
            this.emit('childProcessError', err);
        }
    };

    _receivedInvoke = async (isInternal, functionName, args, callback) => {
        const service = isInternal ? this._internalService : this.service;

        try {
            const result = await service[name](...args);
            this._ps.send(callback, undefined, result);
        } catch (e) {
            this._ps.send(callback, {message: e.message, stack: e.stack});
        }
    };

    _sendInvoke = (isInternal, functionName, ...args) => {
        const callback = '_' + Math.random();
        this._ps.send('_invoke', isInternal, functionName, args, callback);
        return new Promise((resolve, reject) => {
            this._ps.data.once(callback, function (err, data) {
                if (err !== undefined)
                    reject(err);
                resolve(data)
            });
        });
    };

    _clear() {
        this.startTime = undefined;
        this.isRunning = false;
        this._childProcess = undefined;
        this._ps = undefined;
        this.cpuUsage = undefined;
        this.memoryUsage = undefined;
        this.errors = [];
    }

    //endregion

    //region wrap method

    async kill(signal) {
        await  this._sendInvoke(true, 'close');
        this._childProcess && this._childProcess.kill(signal);
    }

    get pid() {
        return this._childProcess && this._childProcess.pid;
    };

    get stderr() {
        return this._childProcess && this._childProcess.stderr;
    };

    get stdin() {
        return this._childProcess && this._childProcess.stdin;
    };

    get stdout() {
        return this._childProcess && this._childProcess.stdout;
    };

    //endregion
};
