import type { Parameter } from "./parameter.js";

interface BaseEvent {
  id: number;
}

interface CallEvent extends BaseEvent {
  type: "call";
  method_id: string;
  receiver?: Parameter;
  parameters?: Parameter[];
  static: boolean;
  path?: string;
  lineno?: number;
}

interface ReturnEvent extends BaseEvent {
  parent_id: number;
  return_value?: Parameter;
}

export type Event = CallEvent | ReturnEvent;
