import * as stream from "node:stream";
import { LogContext } from "../commons/log_context.js";
import { Node } from "../commons/node.js";
import Config from "../commons/config.js";

export interface FilterOptions<MessageT> {
  filter: (logContext: LogContext<MessageT>) => Promise<boolean> | boolean;
}

export class Filter<MessageT = string> extends Node<
  LogContext<MessageT>,
  LogContext<MessageT>
> {
  constructor({ filter }: FilterOptions<MessageT>, streamOptions?: stream.TransformOptions) {
    super(
      new stream.Transform({
        ...Config.getDuplexOptions(true, true),
        ...streamOptions,
        ...{
          writableObjectMode: true,
          readableObjectMode: true,
          transform: (
            logContext: LogContext<MessageT>,
            encoding: BufferEncoding,
            callback: stream.TransformCallback
          ): void => {
            (async () => {
              if (await filter(logContext)) {
                callback(null, logContext);
              } else {
                callback();
              }
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
