# limited-process

Safely run code in separate process. Limit child process requiring module.

`npm install --save limited-process`

### runFile(filePath, option)
Run a js file in separate process, return `LimitedProcess` object.

* option
    * debug: \<boolean\> | \<string\> Is running in debug mode? Use `--inspect` flag to start node. If pass string can indicate debug port.
    * filename: \<string\> js file name ,default is filePath.
    * require: \<Array\> module name array. In child process those module will be required and exposed at `global.requireList`.
    * uid: \<number\> Sets the user identity of the process.
    * gid: \<number\> Sets the group identity of the process.
    * cwd: \<string\> Current working directory of the child process
    * env: \<Object\> Environment key-value pairs

### runCode(code, option)
Run a js code in separate process, return `LimitedProcess` object.

* option : same with `runFile`

### LimitedProcess

#### class properties
* `connected`: \<boolean\> Indicates whether the child process has been connected.
* `ps`: \<[PostStream](https://github.com/mx601595686/post-stream)\> message exchanging channel. In child process will also has a `ps` property at `global`.
* `debugAddress`: \<string\> If run in debug mode, this will be debug net address.
* `pid`, `stderr`, `stdin`, `stdout`: Same to `child_process` module

#### class methods

* `setTimeout(delay)` How much time to turn off the child process
* `kill([signal])` The child.kill() methods sends a signal to the child process. If no argument is given, the process will be sent the 'SIGTERM' signal.

#### class events

* `connected`: When child process ready.
* `debugStart`: When child process debug is ready.
* `close`, `error`, `exit`: Same to `child_process` module
