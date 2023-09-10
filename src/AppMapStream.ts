import { closeSync, mkdirSync, openSync, writeSync } from "fs";
import { dirname, join } from "path";
import { cwd } from "process";

export default class AppMapStream {
  private fd?: number;
  private path_ = outputPath();

  public get path(): string {
    return this.path_;
  }

  public get seenAny(): boolean {
    return this.fd !== undefined;
  }

  private open(): number {
    mkdirSync(dirname(this.path), { recursive: true });
    const fd = openSync(this.path, "w");
    writeSync(fd, '{ "events": [');
    return fd;
  }

  public close(): boolean {
    if (this.fd === undefined) return false;
    writeSync(this.fd, "]}");
    closeSync(this.fd);
    return true;
  }

  public emit(event: unknown) {
    if (this.fd === undefined) this.fd = this.open();
    else writeSync(this.fd, ",");
    writeSync(this.fd, JSON.stringify(event));
  }
}

function outputPath(): string {
  // TODO configurable output path
  // TODO other recording types
  return join(
    cwd(),
    "tmp",
    "appmap",
    "process",
    timestampName() + ".appmap.json",
  );
}

function timestampName(): string {
  return new Date().toISOString();
}
