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

    async start(option = {debug: false}) {
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
        this._ps = new PostStream({
            readable: this._childProcess.stdio[3],
            writable: this._childProcess.stdio[4]
        });
        this._ps.data.on('_invoke', this._receivedInvoke.bind(this));

        //endregion

        let debugAddress;
        if (option.debug) {
            debugAddress = await new Promise((resolve, reject) => {
                this._childProcess.stderr.once('data', data => {
                    data = data.toString();
                    const match = data.match(/(?!\s)(chrome-devtools.+)(?!\b)/g);
                    if (match.length > 0) {
                        resolve(match[0]);
                    } else {
                        reject(new Error('parse debug path failed：' + data));
                    }
                });
            });
        }
        await this._sendInvoke(true, 'start', this.requireList, this.jsCode, this.fileName);

        return debugAddress;
    }

    invoke = new Proxy(this._sendInvoke.bind(this, false), {
        get(target, property){
            return target.bind(this, property);
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

    async _receivedInvoke(isInternal, functionName, args, callback) {
        const service = isInternal ? this._internalService : this.service;

        try {
            const result = await service[functionName](...args);
            this._ps.send(callback, undefined, result);
        } catch (e) {
            this._ps.send(callback, {message: e.message, stack: e.stack});
        }
    };

    _sendInvoke(isInternal, functionName, ...args) {
        const callback = '_' + Math.random();
        this._ps.send('_invoke', isInternal, functionName, args, callback);
        return new Promise((resolve, reject) => {
            this._ps.data.once(callback, function (err, data) {
                if (err !== undefined)
                    reject(err);
                else
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
        if (this.isRunning) {
            await  this._sendInvoke(true, 'close');
            this._childProcess.kill(signal);
        }
    }

    get pid() {
        if (this.isRunning) {
            return this._childProcess.pid;
        }
    };

    get stderr() {
        if (this.isRunning) {
            return this._childProcess.stderr;
        }
    };

    get stdin() {
        if (this.isRunning) {
            return this._childProcess.stdin;
        }
    };

    get stdout() {
        if (this.isRunning) {
            return this._childProcess.stdout;
        }
    };

    //endregion
};
