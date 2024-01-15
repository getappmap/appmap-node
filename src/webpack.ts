import type webpack from "webpack";

import transform from "./transform";
import { pathToFileURL } from "url";

const appMapWebpackLoader: webpack.LoaderDefinition = function (source) {
  return transform(source, pathToFileURL(this.resourcePath));
};

export default appMapWebpackLoader;
