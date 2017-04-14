/**
 * Created by wujingtao on 2017/4/14.
 */
const LimitedProcess = require('..');
const expect = require('expect.js');

describe('test create new process',function () {
    it('test connection',function (done) {
        const child = LimitedProcess.runCode();
        child.on('connected',function () {
            expect(child.connected).to.be.ok();
            done();
        });
    });

    it('test excute code',function (done) {
        const child = LimitedProcess.runCode('console.log("test child")');
        child.stdout.on('data',data => {
            expect(data.toString()).to.be('test child\n');
            done();
        });
    });

    
});