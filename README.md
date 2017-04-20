# limited-process

Safely run code in separate process. Limit child process requiring module.

`npm install --save limited-process`

### class constructor
`constructor(fileName[, jsCode])`

`fileName` : Js file\`s absolute path. If you provide `jsCode` parameter, the `fileName` will be this code\`s alias, use for stack trace.

`jsCode` : A javascript code string, it will be run in other process.

### class properties
* `fileName`: `jsCode` correspond `filename`, use for stack trace.
* `jsCode`: A javascript code string, it will be run in other process.
* `requireList`: A module name array, in child process all those module names will be required and exposed at `global.lp.requireList`.
* `service` A object consist of function, child process can use `global.lp.invoke` to invoke those functions.
 Note than, those function can not return a `function`. If you need running a async task, you can return a promise object.
* `cpuUsage` Child process cpu usage. If child process is not running, this property will be undefined.
* `memoryUsage` Child process memory usage. If child process is not running, this property will be undefined.
* `errors`: A array consist of child process uncaught exception.
* `isRunning`: Indicates whether the child process is running.
* `startTime`: Child process start time.
* `invoke`: you can use this to invoke child process `global.lp.service`. Like this, `invoke(functionName[,...args])` or `invoke.functionName([...args])`.

* `pid`, `stderr`, `stdin`, `stdout`: Same to `child_process` module

### class methods
* `async start(option = {debug: false})`: Start child process.
    * `debug`: Is using `--inspect` flag to run child process. If `debug` is true, `start()` will return a debug net address string.
* `setTimeout(delay)` How much time to turn off the child process
* `async kill([signal])` The child.kill() methods sends a signal to the child process. If no argument is given, the process will be sent the 'SIGTERM' signal.
Before child process close, child process\`s `global.lp.onClose` will be triggered.

### class events

* `childProcessError`: When child process generate a uncaught exception.
* `close`, `error`, `exit`: Same to `child_process` module
