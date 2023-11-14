namespace AppMap {
  export interface Metadata {
    name?: string;
    labels?: string[];
    app?: string;
    language?: LanguageMetadata;
    frameworks?: FrameworkMetadata[];
    client: ClientMetadata;
    recorder: RecorderMetadata;
    recording?: RecordingMetadata;
    source_location?: SourceLocation;
    test_status?: TestStatus;
    test_failure?: TestFailure;
    exception?: ExceptionMetadata;
  }

  interface ExceptionMetadata {
    /* note this is different from Exception in an event */
    class: string;
    message?: string;
  }

  export interface LanguageMetadata {
    name: string;
    engine?: string;
    version: string;
  }

  export interface FrameworkMetadata {
    name: string;
    version: string;
  }

  export interface ClientMetadata {
    name: string;
    url: string;
    version?: string;
  }

  export interface RecorderMetadata {
    type: RecorderType;
    name: string;
  }

  export type RecorderType = "tests" | "requests" | "remote" | "process";

  export interface RecordingMetadata {
    defined_class: string;
    method_id: string;
  }

  export type SourceLocation = string;

  export type TestStatus = "succeeded" | "failed";

  export interface TestFailure {
    message: string;
    location?: SourceLocation;
  }

  export type ClassMap = Package[];

  export interface Package {
    name: string;
    type: "package";
    children?: (Package | Class)[];
  }

  export interface Class {
    name: string;
    type: "class";
    children?: (Class | FunctionInfo)[];
  }

  export interface FunctionInfo {
    name: string;
    type: "function";
    location?: SourceLocation;
    static: boolean;
    labels?: string[];
    comment?: string;
    source?: string;
  }

  export type SourceObject = Package | Class | FunctionInfo;

  interface EventBase {
    id: number;
    thread_id: number;
  }

  interface ReturnEventBase extends EventBase {
    event: "return";
    parent_id: number;
    elapsed?: number;
  }

  interface CallEventBase extends EventBase {
    event: "call";
  }

  export interface FunctionCallEvent extends CallEventBase {
    defined_class: string;
    method_id: string;
    path?: string;
    lineno?: number;
    receiver?: Parameter;
    parameters?: Parameter[];
    static: boolean;
  }

  export interface ParameterSchema {
    class: string;
    properties?: ({ name: string } & ParameterSchema)[];
    items?: ParameterSchema;
  }

  export interface Parameter extends ParameterSchema {
    name?: string;
    object_id?: ObjectID;
    value: string;
    size?: number;
  }

  export interface Exception {
    class: string;
    message: string;
    object_id: ObjectID;
    path?: string;
    lineno?: number;
  }

  export type ObjectID = string | number;

  export interface FunctionReturnEvent extends ReturnEventBase {
    return_value?: Parameter;
    exceptions?: Exception[];
  }

  interface HttpRequestBase {
    request_method: string;
    headers?: Record<string, string>;
  }

  export interface HttpServerRequestEvent extends CallEventBase {
    http_server_request: HttpRequestBase & {
      path_info: string;
      normalized_path_info?: string;
      protocol?: string;
    };
    message?: Parameter[];
  }

  export interface HttpClientRequestEvent extends CallEventBase {
    http_client_request: HttpRequestBase & {
      url: string;
    };
    message?: Parameter[];
  }

  interface HttpResponse {
    status_code: number;
    headers?: Record<string, string>;
    return_value?: Parameter;
  }

  export interface HttpServerResponseEvent extends ReturnEventBase {
    http_server_response: HttpResponse;
  }

  export interface HttpClientResponseEvent extends ReturnEventBase {
    http_client_response: HttpResponse;
  }

  export interface SqlQueryEvent extends CallEventBase {
    sql_query: {
      database_type: string;
      sql: string;
      explain_sql?: string;
      server_version?: string;
    };
  }

  export type CallEvent =
    | FunctionCallEvent
    | HttpClientRequestEvent
    | HttpServerRequestEvent
    | SqlQueryEvent;
  export type ReturnEvent = FunctionReturnEvent | HttpClientResponseEvent | HttpServerResponseEvent;
  export type Event = CallEvent | ReturnEvent;

  export interface AppMap {
    version: "1.12";
    metadata?: Metadata;
    classMap: ClassMap;
    events?: Event[];
    eventUpdates?: Record<number, Event>;
  }
}
export default AppMap;
