import { Readable, Writable } from "node:stream";
import { once } from "node:events";
import Config from "./config.js";
import { ErrorHandler } from "./config.js";
import * as crypto from "node:crypto";

const $streams = Symbol("nodes");

export interface NodeOptions {
  id: string;
  errorHandler?: ErrorHandler;
}

export class Node<InT, OutT, StreamT extends Writable | Readable = Writable | Readable> {
  static [$streams] = new WeakSet<Writable | Readable>();

  protected _stream: StreamT;
  protected _queue: InT[];
  protected _size: number;
  protected _id: string;
  protected _errorHandler?: ErrorHandler;

  constructor(stream: StreamT, options?: NodeOptions) {
    this._stream = stream;
    this._queue = [];
    this._size = 0;
    this._id = options?.id ?? crypto.randomUUID();
    this._errorHandler = options?.errorHandler ?? Config.errorHandler;

    Node[$streams].add(stream);

    if (this._stream instanceof Writable) {
      this._stream.on("pipe", (readable: Readable) => {
        this._stream.setMaxListeners(this._stream.getMaxListeners() + 1);
        if (Node[$streams].has(readable)) {
          readable.setMaxListeners(readable.getMaxListeners() + 1);
        }
      });

      this._stream.on("unpipe", (readable: Readable) => {
        readable.resume();
        this._stream.setMaxListeners(this._stream.getMaxListeners() - 1);
        if (Node[$streams].has(readable)) {
          readable.setMaxListeners(readable.getMaxListeners() - 1);
        }
      });
    }

    this._stream.on("error", (err: Error) => {
      if (Config.debug && this._errorHandler) {
        this._errorHandler(err);
      }
      if (this._stream instanceof Readable) {
        this._stream.unpipe();
      }
    });
  }

  public connect(...nodes: Node<OutT, unknown>[]): this {
    for (const node of nodes) {
      if (this._stream instanceof Readable && node._stream instanceof Writable) {
        this._stream.pipe(node._stream);
        if (node._stream instanceof Readable) {
          node._stream.resume();
        }
        if (Config.debug) {
          console.log(`Connected ${this._id} to ${node._id}.`);
        }
      }
    }
    return this;
  }

  public disconnect(...nodes: Node<OutT, unknown>[]): this {
    for (const node of nodes) {
      if (this._stream instanceof Readable && node._stream instanceof Writable) {
        this._stream.unpipe(node._stream);
        this._stream.resume();
        if (Config.debug) {
          console.log(`Disconnected ${this._id} from ${node._id}.`);
        }
      }
    }
    return this;
  }

  protected async _write(data: InT, encoding?: NodeJS.BufferEncoding): Promise<void> {
    if (this._stream.closed || !(this._stream instanceof Writable)) return;

    if (this._stream.writableNeedDrain) {
      this._queue.push(data);
      this._size += this._stream.writableObjectMode
        ? 1
        : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          ((data as string | Buffer).length ?? (data as DataView).byteLength ?? 0);
      return;
    }

    if (this._stream.write(data, encoding ?? "utf-8")) return;

    await once(this._stream, "drain");

    while (this._queue.length) {
      const data = this._queue.shift();
      this._size -= this._stream.writableObjectMode
        ? 1
        : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          ((data as string | Buffer).length ?? (data as DataView).byteLength ?? 0);
      if (!this._stream.write(data, encoding ?? "utf-8")) {
        await once(this._stream, "drain");
      }
    }
  }
}
