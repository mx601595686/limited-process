/**
 * Created by wujingtao on 2017/4/14.
 */
const LimitedProcess = require('..');
const expect = require('expect.js');
const os = require('os');
const child_process = require("child_process");

describe('test create new process', function () {
    it('test connection', function (done) {
        const child = LimitedProcess.runCode();
        child.on('connected', function () {
            expect(child.connected).to.be.ok();
            done();
        });
    });

    it('test excute code', function (done) {
        const child = LimitedProcess.runCode('console.log("test child")');
        child.stdout.on('data', data => {
            expect(data.toString()).to.be('test child\n');
            done();
        });
    });

    it('test parameter', function (done) {
        const child = LimitedProcess.runCode(`
            let ok = 0;
            if(global.requireList.length === 1){
                if(global.requireList[0].fstat !== undefined){
                    ok++;
                }
            }
            if((new Error).stack.includes('test.js'))
                ok++;
            console.log(ok);
        `, {
            filename: 'test.js',
            require: ['fs'],
            cwd: os.homedir()
        });
        child.stdout.on('data', data => {
            expect(data.toString()).to.be('2\n');
            done();
        });

        /* child.stderr.on('data',data => {
         console.log(data.toString())
         });*/
    });

    it('test debug', function (done) {
        const child = LimitedProcess.runCode(``, {
            debug: true,
            filename: 'test.js',
            require: ['fs'],
            cwd: os.homedir()
        });

        child.on('debugStart', () => {
            expect(child.debugAddress.startsWith('chrome-devtools:')).to.be.ok();
            done();
        })
    })
});