import * as stream from "node:stream";
import { EventEmitter } from "node:events";

export type ErrorHandler = (err: Error, ...params: unknown[]) => void;

interface ConfigEvents {
  errorHandler: [ErrorHandler];
  debug: [boolean];
}

class Config extends EventEmitter<ConfigEvents> {
  protected _highWaterMark?: number;
  protected _highWaterMarkObjectMode?: number;
  protected _debug: boolean;
  public captureStackTrace: boolean;
  public captureISOTime: boolean;
  public errorHandler: ErrorHandler;

  constructor() {
    super();
    this.captureStackTrace = true;
    this.captureISOTime = true;
    this.errorHandler = console.error;
    this._debug = false;
  }

  public get highWaterMark(): number {
    return this._highWaterMark ?? stream.getDefaultHighWaterMark(false);
  }

  public set highWaterMark(highWaterMark: number) {
    this._highWaterMark = highWaterMark;
  }

  public get highWaterMarkObjectMode(): number {
    return this._highWaterMarkObjectMode ?? stream.getDefaultHighWaterMark(true);
  }

  public set highWaterMarkObjectMode(highWaterMarkObjectMode: number) {
    this._highWaterMarkObjectMode = highWaterMarkObjectMode;
  }

  public getWritableOptions = (objectMode = true): stream.WritableOptions => {
    return {
      highWaterMark: objectMode ? this.highWaterMarkObjectMode : this.highWaterMark,
    };
  };

  public getReadableOptions = (objectMode = true): stream.ReadableOptions => {
    return {
      highWaterMark: objectMode ? this.highWaterMarkObjectMode : this.highWaterMark,
    };
  };

  public getDuplexOptions = (writableObjectMode = true, readableObjectMode = true): stream.DuplexOptions => {
    return {
      writableHighWaterMark: writableObjectMode ? this.highWaterMarkObjectMode : this.highWaterMark,
      readableHighWaterMark: readableObjectMode ? this.highWaterMarkObjectMode : this.highWaterMark,
    };
  };

  get debug() {
    return this._debug;
  }

  set debug(debug: boolean) {
    this._debug = debug;
    this.emit("debug", this._debug);
  }
}

export default new Config();
