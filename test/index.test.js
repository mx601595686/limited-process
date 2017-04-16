/**
 * Created by wujingtao on 2017/4/14.
 */
const LimitedProcess = require('..');
const expect = require('expect.js');
const os = require('os');
const child_process = require("child_process");

function printStdio(child) {
    child.stdout.on('data', data => console.log('child:', data.toString()));
    child.stderr.on('data', data => console.log('child:', data.toString()));
    process.on('unhandledRejection', err => console.log(err));
}

describe('test create new process', function () {
    describe('test constructor', function () {
        it('wrong parameter 1', function (done) {
            try {
                new LimitedProcess('console.log("test child")');
            }
            catch (e) {
                done();
            }
        });

        it('wrong parameter 2', function (done) {
            try {
                new LimitedProcess(__dirname);
            }
            catch (e) {
                expect(e.message.startsWith('path')).to.be.ok();
                done();
            }
        });

        it('right parameter', function () {
            new LimitedProcess();
            new LimitedProcess(__filename);
            new LimitedProcess('test.js', 't');
        });
    });

    it('test empty process', function (done) {
        const child = new LimitedProcess();
        child.start();
        expect(child.fileName).to.not.be(undefined);
        expect(child.jsCode).to.not.be(undefined);
        expect(child.requireList).to.be.empty();
        expect(child.service).to.be.empty();
        expect(child.isRunning).to.be.ok();
        expect(child.startTime).to.not.be(undefined);

        setTimeout(function () {
            expect(child.cpuUsage).to.not.be(undefined);
            expect(child.memoryUsage).to.not.be(undefined);
            expect(child.errors).to.be.empty();
            done();
        }, 1000);
    });

    describe('test excute code', function () {
        it('run code', function (done) {
            const child = new LimitedProcess('test.js', 'console.log("test child")');
            child.start();
            child.stdout.on('data', data => {
                expect(data.toString()).to.be('test child\n');
                done();
            });
        });

        it('test child process onClose,onStart', function (done) {
            const child = new LimitedProcess('test.js', `
                global.lp.onStart = function(){
                    console.log('child:onStart');
                }
                
                global.lp.onClose = function(){
                    console.log('child:onClose');
                }
            `);
            child.start().then(child.kill.bind(child));
            const output = ['child:onStart', 'child:onClose'];
            child.stdout.on('data', data => {
                expect(data.toString().trim()).to.be(output.shift());
            });
            child.on('exit', done);
        });

        describe('test child process error', function () {
            it('throw error when starting', function (done) {
                const child = new LimitedProcess('test.js', 'throw new Error("test")');
                child.start().catch(e => {
                    expect(e.message).to.be('test');
                    done();
                });
            });

            it('throw error when running', function (done) {
                const child = new LimitedProcess('test.js', `
                setTimeout(function () {
                    throw new Error("test")
                },10);`);
                child.start();
                child.on('childProcessError', err => {
                    expect(err.message).to.be('test');
                    done();
                });
            });

            it('test child process onError', function (done) {
                const child = new LimitedProcess('test.js', `
                    global.lp.onError = function(){
                        console.log('child:onError');
                    }
                    setTimeout(function () {
                        throw new Error("test")
                    },10);
                `);
                child.start();
                child.stdout.on('data', data => {
                    expect(data.toString()).to.be('child:onError\n');
                    done();
                });
            });
        });

        it('test invoke child process services', async function () {
            const child = new LimitedProcess('test.js', `
                global.lp.service.test = function(arg){
                    return 'child:'+ arg;
                }
            `);
            await child.start();
            expect(await child.invoke.test(123)).to.be('child:123');
            expect(await child.invoke('test', 456)).to.be('child:456');
        });

        it('test Invoke parent process services', function (done) {
            const child = new LimitedProcess('test.js', `
                (async function(){
                    await global.lp.invoke.test(123);
                    await global.lp.invoke.test(456);
                    console.log('child finish');
                })()
            `);
            let result = [];
            child.service.test = function (args) {
                result.push(args);
            };
            child.service.test2 = function (args) {
                result.push(args);
            };
            child.start();
            child.stdout.on('data', data => {
                expect(data.toString()).to.be('child finish\n');
                expect(result).to.be.eql([123, 456]);
                done();
            });
        });

        it('test requireList', async function () {
            const child = new LimitedProcess('test.js', `
                const fs = global.lp.requireList['fs'];
                
                if(Object.keys(global.lp.requireList).length !== 1)
                    throw new Error('requireList length greater than 1');
                    
                global.lp.service.test = function(arg){
                    return fs.readdirSync(process.cwd());
                }
            `);
            child.requireList.push('fs');
            await child.start({cwd: __dirname});
            expect(await child.invoke.test()).to.be.eql(require('fs').readdirSync(__dirname));
        });

        it('test debug', async function () {
            const child = new LimitedProcess('test.js', 'console.log("test child")');
            const debugAddress = await child.start({debug: true});
            expect(debugAddress).to.be.a('string');
        });
    });
});