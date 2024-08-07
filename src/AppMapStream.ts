import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";

const APPMAP_VERSION = "1.12";

export default class AppMapStream {
  constructor(public readonly path: string) {}

  private fd?: number;

  public get seenAny(): boolean {
    return this.fd !== undefined;
  }

  private open(): number {
    mkdirSync(dirname(this.path), { recursive: true });
    const fd = openSync(this.path, "w");
    writeSync(fd, `{"version":"${APPMAP_VERSION}","events":[`);
    return fd;
  }

  public close(extras = {}): boolean {
    if (this.fd === undefined) return false;
    writeSync(this.fd, "]");
    for (const [k, v] of Object.entries(extras))
      if (v) writeSync(this.fd, `,${JSON.stringify(k)}:${JSON.stringify(v)}`);
    writeSync(this.fd, "}");
    closeSync(this.fd);
    return true;
  }

  public push(event: unknown) {
    if (this.fd === undefined) this.fd = this.open();
    else writeSync(this.fd, ",");
    writeSync(this.fd, JSON.stringify(event));
  }
}
