import * as net from "node:net";
import * as stream from "node:stream";
import { LogContext } from "../commons/log_context.js";
import { SyslogLevel } from "../commons/syslog.js";
import { Node } from "../commons/node.js";
import Config from "../commons/config.js";

export interface SocketHandlerOptions {
  socket: net.Socket;
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  space?: string | number;
  level?: SyslogLevel;
  payloadSizeLimit?: number;
  ingressQueueThreshold?: number;
}

export class SocketHandler<MessageT = string> extends Node<LogContext<MessageT>, LogContext<MessageT>> {
  public level: SyslogLevel;

  protected _space?: string | number;
  protected _replacer?: (this: unknown, key: string, value: unknown) => unknown;
  protected _reviver?: (this: unknown, key: string, value: unknown) => unknown;
  protected _socket: net.Socket;
  protected _ingressQueue: Buffer;
  protected _payloadSizeLimit: number;
  protected _ingressQueueThreshold?: number;

  constructor(
    {
      socket,
      reviver,
      replacer,
      space,
      level = SyslogLevel.WARN,
      payloadSizeLimit = 1e6,
      ingressQueueThreshold,
    }: SocketHandlerOptions,
    streamOptions?: stream.DuplexOptions
  ) {
    super(
      new stream.Duplex({
        ...streamOptions,
        ...{
          writableObjectMode: true,
          readableObjectMode: true,
          read: () => {
            this._push();
          },
          write: (logContext: LogContext<MessageT>, _encoding: BufferEncoding, callback: stream.TransformCallback) => {
            try {
              if (
                this._socket.destroyed ||
                this._socket.writableEnded ||
                this._socket.writableFinished ||
                this._socket.closed
              ) {
                callback(this._socket.errored ?? new Error("The `Socket` is not writable."));
                return;
              }
              if (SyslogLevel[logContext.level] <= this.level) {
                const data = this._serializeMessage(logContext);
                if (data.length == 0) {
                  callback();
                  return;
                }
                const size = Buffer.alloc(6, 0);
                size.writeUIntBE(data.length + 6, 0, 6);
                const buf = Buffer.concat([size, data]);
                if (!this._socket.write(buf)) {
                  this._socket.once("drain", callback);
                } else {
                  callback();
                  return;
                }
              } else {
                callback();
                return;
              }
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              callback(error);
              Config.errorHandler(error);
            }
          },
        },
      })
    );
    this.level = level;
    this._reviver = reviver;
    this._replacer = replacer;
    this._space = space;
    this._ingressQueue = Buffer.allocUnsafe(0);
    this._payloadSizeLimit = payloadSizeLimit;
    this._ingressQueueThreshold = ingressQueueThreshold;
    this._socket = socket;
    if (this._socket.listeners("error").length == 0) {
      this._socket.on("error", Config.errorHandler);
    }
    this._socket.on("data", (data: Buffer) => {
      this._ingressQueue = Buffer.concat([this._ingressQueue, data]);
      if (this._ingressQueueThreshold && this._ingressQueue.length > this._ingressQueueThreshold) {
        this._socket.pause();
      }
    });
  }

  protected _push = (): void => {
    try {
      if (this._socket.isPaused()) {
        if (this._ingressQueueThreshold) {
          if (this._ingressQueue.length < this._ingressQueueThreshold) {
            this._socket.resume();
          }
        } else {
          this._socket.resume();
        }
      }
      if (this._ingressQueue.length < 6) {
        this._socket.once("data", this._push);
        return;
      }
      const messageSize = this._ingressQueue.readUintBE(0, 6);
      if (messageSize - 6 > this._payloadSizeLimit) {
        this._stream.destroy(new Error(`The payload size limit was exceeded: ${this._payloadSizeLimit.toString()}`));
        this._socket.destroy();
        return;
      }
      if (messageSize < 6) {
        this._stream.destroy(new Error(`The frame length is invalid: ${messageSize.toString()}`));
        return;
      }
      if (this._ingressQueueThreshold && messageSize > this._ingressQueueThreshold) {
        this._stream.destroy(
          new Error(`The message size exceeded the ingress queue threshold: ${this._ingressQueueThreshold.toString()}`)
        );
        return;
      }
      if (this._ingressQueue.length < messageSize) {
        this._socket.once("data", this._push);
        return;
      }
      if (messageSize == 6) {
        this._ingressQueue = this._ingressQueue.subarray(6);
        this._push();
        return;
      }

      const buf = this._ingressQueue.subarray(6, messageSize);
      this._ingressQueue = this._ingressQueue.subarray(messageSize, this._ingressQueue.length);
      const message = this._deserializeMessage(buf);
      if (this._stream instanceof stream.Readable) {
        if (!this._stream.push(message)) {
          this._socket.pause();
          return;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Config.errorHandler(error);
      this._stream.destroy(error);
      this._socket.destroy();
    }
  };

  protected _serializeMessage = (message: LogContext<MessageT>): Buffer => {
    return Buffer.from(JSON.stringify(message, this._replacer, this._space), "utf-8");
  };

  protected _deserializeMessage = (data: Buffer): LogContext<MessageT> => {
    return JSON.parse(data.toString("utf-8"), this._reviver) as LogContext<MessageT>;
  };

  public setLevel = (level: SyslogLevel): void => {
    this.level = level;
  };
}
