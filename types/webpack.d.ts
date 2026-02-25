/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

/* adapted from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/68a06dbd340bd1a6442f1d22d01ac071e7ec9dd1/types/webpack/v4/index.d.ts */

export interface Configuration {
  mode?: "development" | "production" | "none" | undefined;
  name?: string | undefined;
  context?: string | undefined;
  // entry?: string | string[] | Entry | EntryFunc | undefined;
  // devtool?: Options.Devtool | undefined;
  // output?: Output | undefined;
  module?: Module | undefined;
  // resolve?: Resolve | undefined;
  // resolveLoader?: ResolveLoader | undefined;
  // externals?: ExternalsElement | ExternalsElement[] | undefined;
  target?:
    | "web"
    | "webworker"
    | "node"
    | "async-node"
    | "node-webkit"
    | "atom"
    | "electron"
    | "electron-renderer"
    | "electron-preload"
    | "electron-main"
    | ((compiler?: any) => void)
    | undefined;
  bail?: boolean | undefined;
  profile?: boolean | undefined;
  cache?: boolean | object | undefined;
  watch?: boolean | undefined;
  // watchOptions?: Options.WatchOptions | undefined;
  // node?: Node | false | undefined;
  amd?: { [moduleName: string]: boolean } | undefined;
  recordsPath?: string | undefined;
  recordsInputPath?: string | undefined;
  recordsOutputPath?: string | undefined;
  // plugins?: Plugin[] | undefined;
  // stats?: Options.Stats | undefined;
  // performance?: Options.Performance | false | undefined;
  parallelism?: number | undefined;
  // optimization?: Options.Optimization | undefined;
  // infrastructureLogging?: Options.InfrastructureLogging | undefined;
}

interface Module {
  noParse?: RegExp | RegExp[] | ((content: string) => boolean) | undefined;
  unknownContextRequest?: string | undefined;
  unknownContextRecursive?: boolean | undefined;
  unknownContextRegExp?: RegExp | undefined;
  unknownContextCritical?: boolean | undefined;
  exprContextRequest?: string | undefined;
  exprContextRegExp?: RegExp | undefined;
  exprContextRecursive?: boolean | undefined;
  exprContextCritical?: boolean | undefined;
  wrappedContextRegExp?: RegExp | undefined;
  wrappedContextRecursive?: boolean | undefined;
  wrappedContextCritical?: boolean | undefined;
  strictExportPresence?: boolean | undefined;
  rules: RuleSetRule[];
}

interface RuleSetRule {
  enforce?: "pre" | "post" | undefined;
  exclude?: RuleSetCondition | undefined;
  include?: RuleSetCondition | undefined;
  issuer?: RuleSetCondition | undefined;
  loader?: RuleSetUse | undefined;
  loaders?: RuleSetUse | undefined;
  oneOf?: RuleSetRule[] | undefined;
  // options?: RuleSetQuery | undefined;
  parser?: { [k: string]: any } | undefined;
  // resolve?: Resolve | undefined;
  sideEffects?: boolean | undefined;
  // query?: RuleSetQuery | undefined;
  type?:
    | "javascript/auto"
    | "javascript/dynamic"
    | "javascript/esm"
    | "json"
    | "webassembly/experimental"
    | undefined;
  resource?: RuleSetCondition | undefined;
  resourceQuery?: RuleSetCondition | undefined;
  compiler?: RuleSetCondition | undefined;
  rules?: RuleSetRule[] | undefined;
  test?: RuleSetCondition | undefined;
  use?: RuleSetUse | undefined;
}

type RuleSetCondition =
  | RegExp
  | string
  | ((path: string) => boolean)
  | RuleSetConditions
  | {
      and?: RuleSetCondition[] | undefined;
      exclude?: RuleSetCondition | undefined;
      include?: RuleSetCondition | undefined;
      not?: RuleSetCondition[] | undefined;
      or?: RuleSetCondition[] | undefined;
      test?: RuleSetCondition | undefined;
    };

interface RuleSetConditions extends Array<RuleSetCondition> {}

type RuleSetUse =
  | RuleSetUseItem
  | RuleSetUseItem[]
  | ((data: any) => RuleSetUseItem | RuleSetUseItem[]);

interface RuleSetLoader {
  loader?: string | undefined;
  // options?: RuleSetQuery | undefined;
  ident?: string | undefined;
  // query?: RuleSetQuery | undefined;
}

type RuleSetUseItem = string | RuleSetLoader | ((data: any) => string | RuleSetLoader);

/* adapted from https://github.com/webpack/webpack/blob/0781eac69cf26af59b51513b3da9569f653ec64d/declarations/LoaderContext.d.ts */

export interface LoaderRunnerLoaderContext<OptionsType> {
  addContextDependency(context: string): void;
  addDependency(file: string): void;
  addMissingDependency(context: string): void;
  async(): (err: Error | null | undefined, result?: string | Buffer) => void;
  cacheable(flag?: boolean): void;
  // callback: WebpackLoaderContextCallback;
  clearDependencies(): void;
  context: string;
  readonly currentRequest: string;
  readonly data: any;
  dependency(file: string): void;
  getContextDependencies(): string[];
  getDependencies(): string[];
  getMissingDependencies(): string[];
  loaderIndex: number;
  readonly previousRequest: string;
  readonly query: string | OptionsType;
  readonly remainingRequest: string;
  readonly request: string;
  loaders: {
    request: string;
    path: string;
    query: string;
    fragment: string;
    options: object | string | undefined;
    ident: string;
    normal: Function | undefined;
    pitch: Function | undefined;
    raw: boolean | undefined;
    data: object | undefined;
    pitchExecuted: boolean;
    normalExecuted: boolean;
    type?: "commonjs" | "module" | undefined;
  }[];
  resourcePath: string;
  resourceQuery: string;
  resourceFragment: string;
  resource: string;
  target: string;
  // environment: Environment;
}

type LoaderContext<OptionsType> =
  /* NormalModuleLoaderContext<OptionsType> & */
  LoaderRunnerLoaderContext<OptionsType>; /*&
  LoaderPluginLoaderContext &
  HotModuleReplacementPluginLoaderContext;*/

type LoaderDefinitionFunction<OptionsType = {}, ContextAdditions = {}> = (
  this: LoaderContext<OptionsType> & ContextAdditions,
  content: string,
  // sourceMap?: string | SourceMap,
  // additionalData?: AdditionalData,
) => string | Buffer | Promise<string | Buffer> | void;

export type LoaderDefinition<OptionsType = {}, ContextAdditions = {}> = LoaderDefinitionFunction<
  OptionsType,
  ContextAdditions
> & {
  raw?: false;
  // pitch?: PitchLoaderDefinitionFunction<OptionsType, ContextAdditions>;
};
