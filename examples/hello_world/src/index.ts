/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger, Formatter, ConsoleHandler, SyslogLevel } from "streams-logger";

const logger = new Logger({ name: "hello-logger", level: SyslogLevel.DEBUG });
const formatter = new Formatter({
  format: ({ isotime, message, name, level, func, line, col }) =>
    `${name ?? ""}:${isotime ?? ""}:${level}:${func ?? ""}:${line ?? ""}:${col ?? ""}:${message}\n`,
});
const consoleHandler = new ConsoleHandler({ level: SyslogLevel.DEBUG });

const log = logger.connect(formatter.connect(consoleHandler));

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

setInterval(sayHello, 1e3);

sayHello();

const greeter = new Greeter();

greeter.speak();
