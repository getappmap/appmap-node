import type { Parameter } from "./parameter.js";

interface BaseEvent {
  id: number;
  thread_id: number;
}

export interface CallEvent extends BaseEvent {
  event: "call";
  method_id: string;
  defined_class?: string;
  receiver?: Parameter;
  parameters?: Parameter[];
  static: boolean;
  path?: string;
  lineno?: number;
}

export interface ReturnEvent extends BaseEvent {
  event: "return";
  parent_id: number;
  return_value?: Parameter;
}

export type Event = CallEvent | ReturnEvent;
