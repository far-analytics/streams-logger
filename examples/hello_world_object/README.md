# _An Instance of Object "Hello, World!"_

## Introduction

In this example you will use Streams in order to log "Hello, World!" to the console as an object.

## Implement the example

### Implement the `index.ts` module

#### Import the Logger, Formatter, ConsoleHandler, and SyslogLevel enum.

```ts
import { Logger, Formatter, ConsoleHandler, SyslogLevel } from "streams-logger";
```

#### Create an instance of a Logger, Formatter, and ConsoleHandler.

```ts
const logger = new Logger<string>({ name: "hello-logger", level: SyslogLevel.DEBUG });
const formatter = new Formatter<string, Record<string, unknown>>({
  format: ({ isotime, message, name, level, func, line, col }) => {
    return { name, isotime, level, func, line, col, message };
  },
});

const consoleHandler = new ConsoleHandler<Record<string, unknown>>({ level: SyslogLevel.DEBUG });
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
}

setInterval(sayHello, 3e3);

sayHello();

const greeter = new Greeter();

greeter.speak();
```

## Run the example

### How to run the example

#### Clone the _Streams_ repository.

```bash
git clone https://github.com/far-analytics/streams-logger.git
```

#### Change directory into the relevant example directory.

```bash
cd streams-logger/examples/hello_world_object
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

```bash
{"name":"hello-logger","isotime":"2026-01-06T23:04:45.338Z","level":"INFO","func":"sayHello","line":"11","col":"9","message":"Hello, World!"}{"name":"hello-logger","isotime":"2026-01-06T23:04:45.340Z","level":"INFO","func":"Greeter.speak","line":"19","col":"13","message":"Hello, World!"}{"name":"hello-logger","isotime":"2026-01-06T23:04:48.342Z","level":"INFO","func":"Timeout.sayHello","line":"11","col":"9","message":"Hello, World!"}
...
```
