# _Implement a Transform_

## Introduction

In this example you will implement a custom _Streams_ `Node` that transforms a `LogContext` into a `Buffer` and writes the result to `process.stdout`.

## Implement the example

### Implement the `index.ts` module

#### Import `stream` and the Streams Logger, Node, Config, and LogContext types.

```ts
import * as stream from "node:stream";
import { Logger, Node, Config, LogContext } from "streams-logger";
```

#### Implement a `LogContextToBuffer` transform and connect it to the logger.

```ts
export class LogContextToBuffer extends Node<LogContext, Buffer> {
  public encoding: NodeJS.BufferEncoding = "utf-8";

  constructor(streamOptions?: stream.TransformOptions) {
    super(
      new stream.Transform({
        ...Config.getDuplexOptions(true, false),
        ...streamOptions,
        ...{
          writableObjectMode: true,
          readableObjectMode: false,
          transform: (chunk: LogContext, encoding: BufferEncoding, callback: stream.TransformCallback) => {
            try {
              if (chunk.message) {
                callback(null, Buffer.from(chunk.message, this.encoding));
              } else {
                callback();
              }
            } catch (err) {
              if (err instanceof Error) {
                callback(err);
              }
            }
          },
        },
      })
    );
  }
}

const log = new Logger<string>({ name: "main" });
const logContextToBuffer = new LogContextToBuffer();
const console = new Node<Buffer, never>(process.stdout);

log.connect(logContextToBuffer.connect(console));

log.warn("Hello, World!");
```

## Run the example

### How to run the example

#### Clone the _Streams_ repository.

```bash
git clone https://github.com/far-analytics/streams-logger.git
```

#### Change directory into the relevant example directory.

```bash
cd streams-logger/examples/implement_a_transform
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
Hello, World!
```
