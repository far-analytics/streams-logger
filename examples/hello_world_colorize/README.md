# _An Instance of Colorized "Hello, World!"_

## Introduction

In this example you will use Streams in order to log "Hello, World!" to the console.

## Implement the example

### Implement the `index.ts` module

#### Import the Logger, Formatter, ConsoleHandler, SyslogLevel enum and the external Chalk library.

```ts
import { Logger, Formatter, ConsoleHandler, SyslogLevel } from "streams-logger";
import chalk from "chalk"; // https://www.npmjs.com/package/chalk
```

#### Create an instance of a Logger, Formatter, and ConsoleHandler.

The external library [Chalk](https://www.npmjs.com/package/chalk) is used in order to add color each component of the log message.

```ts
const logger = new Logger({ name: "hello-logger", level: SyslogLevel.DEBUG });

const formatter = new Formatter({
  format: ({ isotime, message, name, level, func, line, col }) => {
    const _level = level != "ERROR" ? chalk.green(level) : chalk.red(level);
    name = chalk.blue(name);
    isotime = chalk.grey(isotime);
    func = chalk.magenta(func);
    line = chalk.cyan(line);
    col = chalk.cyan(col);
    message = chalk.white(message);
    const data = `${name}:${isotime}:${_level}:${func}:${line}:${col}:${message}\n`;
    return data;
  },
});

const consoleHandler = new ConsoleHandler({ level: SyslogLevel.DEBUG });
```

#### Connect the Logger to the Formatter and connect the Formatter to the ConsoleHandler.

```ts
const log = logger.connect(formatter.connect(consoleHandler));
```

#### Log "Hello, World!" to the console.

```ts
function sayHello() {
  log.info("Hello, World!");
}

class Greeter {
  public greeting: string;
  constructor(greeating = "Hello, World!", repeat = 1) {
    this.greeting = greeating.repeat(repeat);
  }

  speak() {
    log.info(this.greeting);
  }

  shout() {
    log.error(this.greeting);
  }
}

setTimeout(sayHello, 1e3);

sayHello();

const greeter = new Greeter();

greeter.speak();

greeter.shout(); // Greeter.shout invokes an ERROR message.
```

## Run the example

### How to run the example

#### Clone the _Streams_ repository.

```bash
git clone https://github.com/far-analytics/streams-logger.git
```

#### Change directory into the relevant example directory.

```bash
cd streams-logger/examples/hello_world_colorize
```

#### Install the example dependencies.

```bash
npm install && npm update
```

#### Build the application.

```bash
npm run clean:build
```

#### Run the application.

```bash
npm start
```

##### Output

![Output](https://raw.githubusercontent.com/far-analytics/streams-logger/refs/heads/main/examples/hello_world_colorize/output.png)
