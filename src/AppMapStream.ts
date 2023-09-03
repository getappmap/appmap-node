import { closeSync, mkdirSync, openSync, writeSync } from "fs";
import { dirname, join } from "path";
import { cwd } from "process";

export default class AppMapStream {
  private fd: number;
  private path_ = outputPath();
  private seenAny_ = false;

  constructor() {
    mkdirSync(dirname(this.path), { recursive: true });
    this.fd = openSync(this.path, "w");
    this.writePreamble();
  }

  public get path(): string {
    return this.path_;
  }

  public get seenAny(): boolean {
    return this.seenAny_;
  }

  private writePreamble() {
    writeSync(this.fd, '{ "events": [');
  }

  public close() {
    writeSync(this.fd, "]}");
    closeSync(this.fd);
  }

  public emit(event: unknown) {
    if (this.seenAny_) writeSync(this.fd, ",");
    this.seenAny_ = true;
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
