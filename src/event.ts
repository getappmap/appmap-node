import type { Parameter } from "./parameter.js";

type BaseEvent = {
  id: number;
};

type CallEvent = BaseEvent & {
  type: "call";
  method_id: string;
  receiver?: Parameter;
  parameters?: Parameter[];
  static: boolean;
};

type ReturnEvent = BaseEvent & {
  parent_id: number;
  return_value?: Parameter;
};

export type Event = CallEvent | ReturnEvent;
