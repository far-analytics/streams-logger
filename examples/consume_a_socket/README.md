# _Consume a Socket_

## Introduction

In this example you will use Streams in order to consume a `net.Socket` by wrapping it in a `Node`. This shows how any Node.js stream can be integrated into a _Streams_ logging graph.

## Implement the example

### Implement the `index.ts` module

#### Import `net`, `once`, and the Streams `Node` class.

```ts
import * as net from "node:net";
import { once } from "node:events";
import { Node } from "streams-logger";
```

#### Create an echo server, connect a client socket, and wrap the socket in a `Node`.

```ts
net.createServer((socket: net.Socket) => socket.pipe(socket)).listen(3000);
const socket = net.createConnection({ port: 3000 });
await once(socket, "connect");
const socketHandler = new Node<Buffer, Buffer>(socket);
```

## Run the example

### How to run the example

#### Clone the _Streams_ repository.

```bash
git clone https://github.com/far-analytics/streams-logger.git
```

#### Change directory into the relevant example directory.

```bash
cd streams-logger/examples/consume_a_socket
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

This example does not print output; it demonstrates how to wrap a `net.Socket` in a Streams `Node`.
