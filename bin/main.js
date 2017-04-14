/**
 * Created by wujingtao on 2017/4/13.
 */

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmiter = require('events');
const PostStream = require('post-stream');

module.exports = class LimitedProcess extends EventEmiter {

    static runFile(filePath, option = {}) {
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            const file = fs.readFileSync(filePath, 'utf8');

            if (option.filename !== undefined) option.filename = filePath;

            LimitedProcess.runCode(file, option);
        } else {
            throw new Error(`path: ${filePath} is not a file`);
        }
    }

    static runCode(code = '', option = {}) {
        const startArgs = [path.resolve(__dirname, './child_process.js')];

        option = Object.assign({
            debug: false,
            filename: `cp:${Math.random()}`,
            require: [],
            uid: undefined,
            gid: undefined,
            cwd: undefined,
            env: undefined
        }, option);

        if (option.debug) {
            const debug = ['--inspect'];
            if ('string' === typeof option.debug) debug.push(option.debug);
            startArgs.unshift(debug.join('='));
        }

        const child = child_process.spawn(process.execPath, startArgs, {
            stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
            uid: option.uid,
            gid: option.gid,
            cwd: option.cwd,
            env: option.env
        });
        const ps = new PostStream(child.stdio[3], child.stdio[4]);
        ps.send('_start', option, code);
        return new LimitedProcess(child, ps, option);
    }

    get pid() {
        return this._childProcess.pid;
    }

    get stderr() {
        return this._childProcess.stderr;
    }

    get stdin() {
        return this._childProcess.stdin;
    }

    get stdout() {
        return this._childProcess.stdout;
    }

    constructor(childProcess, ps, option) {
        super();

        this.connected = false;
        this.ps = ps;
        this._childProcess = childProcess;

        if (option.debug) {
            childProcess.stderr.once('data', data => {
                data = data.toString();
                const match = data.match(/(?!\s)(chrome-devtools.+)(?!\b)/g);
                if (match.length > 0) {
                    this.debugAddress = match[0];
                    this.emit('debugStart');
                }
            });
        }

        ps.data.once('_start_finish', () => {
            this.connected = true;
            this.emit('connected');
        });

        childProcess.on('close', (...args) => {
            this.connected = false;
            this.emit('close', ...args);
        });

        childProcess.on('disconnect', (...args) => {
            this.emit('disconnect', ...args);
            this.connected = false;
        });

        childProcess.on('error', (...args) => {
            this.emit('error', ...args);
            this.connected = false;
        });

        childProcess.on('exit', (...args) => {
            this.emit('exit', ...args);
            this.connected = false;
        });
    }

    disconnect() {
        return this._childProcess.disconnect();
    }

    kill(signal) {
        return this._childProcess.kill(signal);
    }

    setTimeout(delay) {
        setTimeout(() => {
            this.kill();
        }, delay);
    }
};