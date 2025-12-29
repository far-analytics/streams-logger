import * as stream from "node:stream";
import { LogContext } from "../commons/log_context.js";
import { Node } from "../commons/node.js";
import Config from "../commons/config.js";

export interface FormatterOptions<MessageInT, MessageOutT> {
  format: (record: LogContext<MessageInT>) => Promise<MessageOutT> | MessageOutT;
}

export class Formatter<MessageInT = string, MessageOutT = string> extends Node<
  LogContext<MessageInT>,
  LogContext<MessageOutT>
> {
  constructor({ format }: FormatterOptions<MessageInT, MessageOutT>, streamOptions?: stream.TransformOptions) {
    super(
      new stream.Transform({
        ...Config.getDuplexOptions(true, true),
        ...streamOptions,
        ...{
          writableObjectMode: true,
          readableObjectMode: true,
          transform: (
            logContext: LogContext<MessageInT>,
            encoding: BufferEncoding,
            callback: stream.TransformCallback
          ) => {
            (async () => {
              const message = await format(logContext);
              const logContextOut = { ...logContext, ...{ message: message } };
              callback(null, logContextOut);
            })().catch((err: unknown) => {
              const error = err instanceof Error ? err : new Error(String(err));
              callback(error);
              Config.errorHandler(error);
            });
          },
        },
      })
    );
  }
}
