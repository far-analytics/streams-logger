import * as net from "node:net";
import * as fs from "node:fs";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { test, after, suite } from "node:test";
import * as assert from "node:assert";
import {
  Logger,
  LogContext,
  Filter,
  SocketHandler,
  RotatingFileHandler,
  Formatter,
  SyslogLevel,
  SyslogLevelT,
  Config,
  Node,
} from "streams-logger";
import { AnyToEmitter } from "./any_to_emitter.js";
import { AnyToAnyEmitter } from "./any_to_any_emitter.js";
import { AnyTransformToAny } from "./any_transform_to_any.js";
import { AnyToVoid } from "./any_to_void.js";
import { AnyTemporalToAny } from "./any_temporal_to_any.js";
import { StringToBuffer } from "./string_to_buffer.js";
import { BufferToString } from "./buffer_to_string.js";
import { NodeSocketHandler } from "./node_socket_handler.js";

Config.debug = process.argv.some((value: string) => value.search(/verbose=true/) == 0);

const DATA = "0123456789";

await suite("Test the integrity of the underlying Node data propagation and error handling.", async () => {
  const temporalNode = new AnyTemporalToAny<string, string>({ time: 0 });
  const stringToBuffer = new StringToBuffer();
  const bufferToString = new BufferToString();
  const server = net
    .createServer((socket: net.Socket) => {
      const socketHandler1 = new NodeSocketHandler<string, string>({ socket });
      const socketHandler2 = new NodeSocketHandler<string, string>({ socket });
      socketHandler1.connect(socketHandler2);
    })
    .listen(3000);
  const socket = net.createConnection({ port: 3000 });
  await once(socket, "connect");
  const socketHandler = new NodeSocketHandler<string, string>({ socket });
  const anyToAnyEmitter = new AnyToAnyEmitter();

  const node = temporalNode.connect(
    stringToBuffer.connect(bufferToString.connect(socketHandler.connect(anyToAnyEmitter)))
  );

  await test("Write a `string` object and assert that it passed through the graph unscathed.", async () => {
    const result = once(anyToAnyEmitter.emitter, "data");
    node.write(DATA);
    assert.strictEqual((await result)[0], DATA);
  });

  await test("Throw an Error within a stream implementation and check for detachment from the graph.", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyToThrow = new AnyTransformToAny<any, any>({
      transform: () => {
        throw Error("AnyToThrow Error");
      },
    });
    const anyToVoid = new AnyToVoid();
    anyToThrow.connect(anyToVoid);
    socketHandler.connect(anyToThrow);
    assert.strictEqual(anyToThrow.writableCount, 1);
    assert.strictEqual(anyToVoid.writableCount, 1);
    const result = once(anyToThrow.stream, "error");
    node.write(DATA);
    await result;
    assert.strictEqual(anyToThrow.writableCount, 0);
    assert.strictEqual(anyToVoid.writableCount, 0);
  });

  await test("A Node has thrown an Error; check that the graph is still in flowing mode.", async () => {
    const result = once(anyToAnyEmitter.emitter, "data");
    node.write(DATA);
    assert.strictEqual((await result)[0], DATA);
  });

  await test("Attach a Node to the graph, exceed its `highWaterMark`, and check that it remains in flowing mode.", async () => {
    let i;
    const ITERATIONS = 1e3;
    const passThrough = new PassThrough({
      readableObjectMode: true,
      writableObjectMode: true,
      readableHighWaterMark: 1,
      writableHighWaterMark: 1,
    });
    socketHandler.connect(new Node<string, string>(passThrough));
    const result = new Promise<string[]>((r) => {
      const data: string[] = [];
      anyToAnyEmitter.emitter.on("data", (datum: string) => {
        data.push(datum);
        if (data.length == ITERATIONS) {
          r(data);
          anyToAnyEmitter.emitter.removeAllListeners("data");
        }
      });
    });
    for (i = 0; i < ITERATIONS; i++) {
      node.write(DATA);
    }
    const data = (await result).reduce((prev, curr) => prev + curr, "");
    assert.strictEqual(data.length, ITERATIONS * 10);
    assert.strictEqual(DATA.repeat(ITERATIONS), data);
    assert.strictEqual(i, ITERATIONS);
  });
  after(async () => {
    server.close();
    socket.destroy();
    await once(server, "close");
  });
});

await suite("Log a string that passes through a SocketHandler.", async () => {
  const serverRotatingFileHandler = new RotatingFileHandler({ path: "server.log" });
  const serverFormatter = new Formatter({ format: ({ message }) => message });
  const formatterNode = serverFormatter.connect(serverRotatingFileHandler);
  const server = net
    .createServer((socket: net.Socket) => {
      const socketHandler = new SocketHandler({ socket });
      socketHandler.connect(formatterNode.connect(socketHandler));
    })
    .listen(3000);
  const socket = net.createConnection({ port: 3000 });
  const anyToEmitter = new AnyToEmitter();
  const logger = new Logger({ name: "main", level: SyslogLevel.DEBUG });
  const formatter = new Formatter({
    format: ({ isotime, message, name, level, func, line, col }: LogContext<string, SyslogLevelT>) =>
      `${name ?? ""}:${isotime ?? ""}:${level}:${func ?? ""}:${line ?? ""}:${col ?? ""}:${message}\n`,
  });
  const filter = new Filter({ filter: (logContext: LogContext<string, SyslogLevelT>) => logContext.name == "main" });
  await once(socket, "connect");
  const socketHandler = new SocketHandler({ socket });
  const log = logger.connect(formatter.connect(filter.connect(socketHandler.connect(anyToEmitter))));

  await test("Log `Hello, World!` and assert that it passed through the graph.", async () => {
    const greeting = "Hello, World!";
    const result = once(anyToEmitter.emitter, "data") as Promise<LogContext<string, SyslogLevelT>[]>;
    log.warn(greeting);
    assert.match((await result)[0].message, new RegExp(`${greeting}\n$`));
  });

  await test('Log a long string, "Hello, World!" repeated 1e6 times, and assert that it passed through the graph.', async () => {
    const greeting = "Hello, World!".repeat(1e6);
    const result = once(anyToEmitter.emitter, "data") as Promise<LogContext<string, SyslogLevelT>[]>;
    log.warn(greeting);
    const message = (await result)[0].message;
    assert.strictEqual(message.trim().slice(-greeting.length), greeting);
  });

  await test("Log `Hello, World!` repeatedly, 1e4 iterations, and assert that each iteration passed through the graph.", async () => {
    for (let i = 0; i < 1e4; i++) {
      const greeting = "Hello, World!";
      const result = once(anyToEmitter.emitter, "data") as Promise<LogContext<string, SyslogLevelT>[]>;
      log.warn(greeting);
      const message = (await result)[0].message;
      assert.strictEqual(message.trim().slice(-greeting.length), greeting);
    }
  });

  await suite("Test error handling.", async () => {
    const logger = new Logger({ name: "main", level: SyslogLevel.DEBUG });
    const formatter = new Formatter({
      format: ({ isotime, message, name, level, func, line, col }: LogContext<string, SyslogLevelT>) =>
        `${name ?? ""}:${isotime ?? ""}:${level}:${func ?? ""}:${line ?? ""}:${col ?? ""}:${message}\n`,
    });
    const filter = new Filter({ filter: (logContext: LogContext<string, SyslogLevelT>) => logContext.name == "main" });
    const anyToAnyEmitter = new AnyToAnyEmitter();

    const log = logger.connect(formatter.connect(filter.connect(anyToAnyEmitter)));

    await test("Test selective detachment of inoperable graph components.", async () => {
      const greeting = "Hello, World!";
      const anyToThrow = new AnyTransformToAny<LogContext<string, SyslogLevelT>, LogContext<string, SyslogLevelT>>({
        transform: () => {
          throw Error("AnyToThrow Error");
        },
      });
      const anyToVoid = new AnyToVoid();
      anyToThrow.connect(anyToVoid);
      formatter.connect(anyToThrow);
      assert.strictEqual(anyToThrow.writableCount, 1);
      assert.strictEqual(anyToVoid.writableCount, 1);
      log.warn(greeting);
      await new Promise((r) => setTimeout(r));
      assert.strictEqual(anyToThrow.writableCount, 0);
      assert.strictEqual(anyToVoid.writableCount, 0);
    });

    await test("Test that the graph is operable after the error.", async () => {
      const greeting = "Hello, World!";
      const result = once(anyToAnyEmitter.emitter, "data") as Promise<LogContext<string, SyslogLevelT>[]>;
      log.warn(greeting);
      assert.match((await result)[0].message, new RegExp(`${greeting}\n$`));
    });
  });
  after(async () => {
    server.close();
    socket.destroy();
    await once(server, "close");
    fs.readdirSync(".", { withFileTypes: true }).forEach((value: fs.Dirent) => {
      if (/[^.]+.log(\.\d*)?/.exec(value.name)) {
        fs.rmSync(value.name);
      }
    });
  });
});

await suite("Log an object that passes through a SocketHandler.", async () => {
  class Greeter {
    public greeting: string;
    public isotime?: string;
    public name?: string;
    public level?: string;
    public func?: string;
    public url?: string;
    public line?: string;
    public col?: string;
    constructor(greeating = "Hello, World!", repeat = 1) {
      this.greeting = greeating.repeat(repeat);
    }
  }
  const serverRotatingFileHandler = new RotatingFileHandler<string>({ path: "server.log" });
  const serverFormatter = new Formatter<Greeter, string>({ format: ({ message }) => `${JSON.stringify(message)}\n` });
  const formatterNode = serverFormatter.connect(serverRotatingFileHandler);
  const server = net
    .createServer((socket: net.Socket) => {
      const socketHandler = new SocketHandler<Greeter>({ socket });
      socketHandler.connect(formatterNode, socketHandler);
    })
    .listen(3000);
  const socket = net.createConnection({ port: 3000 });
  await once(socket, "connect");
  const greeter = new Greeter("Hello, World!", 1);
  const anyToAnyEmitter = new AnyToAnyEmitter();
  const logger = new Logger<Greeter>({ name: "main", level: SyslogLevel.DEBUG });
  const formatter = new Formatter<Greeter, Greeter>({
    format: ({ message, isotime, name, level, func, url, line, col }: LogContext<Greeter, SyslogLevelT>) => {
      message.isotime = isotime;
      message.name = name;
      message.level = level;
      message.func = func;
      message.url = url;
      message.line = line;
      message.col = col;
      return message;
    },
  });
  const socketHandler = new SocketHandler<Greeter>({ socket });
  const log = logger.connect(formatter.connect(socketHandler.connect(anyToAnyEmitter)));

  await test("Log a `Greeter` object and assert that it passed through the graph.", async () => {
    const result = once(anyToAnyEmitter.emitter, "data") as Promise<LogContext<{ greeting: string }, SyslogLevelT>[]>;
    (function sayHello() {
      log.warn(greeter);
    })();
    assert.strictEqual((await result)[0].message.greeting, greeter.greeting);
  });

  await test("Log a `Greeter` object and assert that the function name was captured.", async () => {
    const result = once(anyToAnyEmitter.emitter, "data") as Promise<LogContext<{ greeting: string }, SyslogLevelT>[]>;
    (function sayHello() {
      log.warn(greeter);
    })();
    assert.strictEqual((await result)[0].func, "sayHello");
  });

  after(async () => {
    server.close();
    socket.destroy();
    await once(server, "close");
    fs.readdirSync(".", { withFileTypes: true }).forEach((value: fs.Dirent) => {
      if (/[^.]+.log(\.\d*)?/.exec(value.name)) {
        fs.rmSync(value.name);
      }
    });
  });
});

await suite("Log a string that passes through a rotating file handler.", async () => {
  const MAX_SIZE = (1e5 * 50) / 5;
  const logger = new Logger<string>({ name: "main" });
  const formatter = new Formatter<string, string>({
    format: ({ isotime, message, name, level, func }: LogContext<string, SyslogLevelT>) =>
      `${name ?? ""}:${isotime ?? ""}:${level}:${func ?? ""}:${message}\n`,
  });
  const rotatingFileHandler = new RotatingFileHandler<string>({
    path: "message.log",
    rotationLimit: 5,
    maxSize: MAX_SIZE,
  });
  const anyToAnyEmitter = new AnyToAnyEmitter();

  const log = logger.connect(formatter.connect(anyToAnyEmitter, rotatingFileHandler));

  await test("Log 1e5 messages to a `RotatingFileHandler` and assert that it rotated 5 times and that each file is MAX_SIZE.", async () => {
    const iterations = 1e5;
    for (let i = 0; i < iterations; i++) {
      (function sayHello() {
        log.warn("01234"); // The message is 50 bytes once the timestamp and other contextual data is added to message.
      })();
    }
    await new Promise((r) => setTimeout(r, 10000));
    const results = fs
      .readdirSync(".", { withFileTypes: true })
      .filter((value) => /[^.]+.log(\.\d*)?/.exec(value.name))
      .map((value: fs.Dirent) => fs.statSync(value.name));
    assert.strictEqual(results.length, 5);
    for (const result of results) {
      assert.strictEqual(result.size, MAX_SIZE);
    }
  });
  after(() => {
    fs.readdirSync(".", { withFileTypes: true }).forEach((value: fs.Dirent) => {
      if (/[^.]+.log(\.\d*)?/.exec(value.name)) {
        fs.rmSync(value.name);
      }
    });
  });
});
