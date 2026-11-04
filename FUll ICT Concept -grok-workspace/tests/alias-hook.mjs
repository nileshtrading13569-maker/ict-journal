import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";
import { existsSync } from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const raw = pathResolve(process.cwd(), "src", specifier.slice(2));
    let finalPath = raw;
    if (existsSync(raw + ".ts")) {
      finalPath = raw + ".ts";
    } else if (existsSync(raw + ".tsx")) {
      finalPath = raw + ".tsx";
    } else if (existsSync(raw + "/index.ts")) {
      finalPath = raw + "/index.ts";
    }
    return nextResolve(pathToFileURL(finalPath).href, context);
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentURL = context.parentURL;
    if (parentURL && parentURL.startsWith("file:")) {
      const parentDir = pathResolve(fileURLToPath(parentURL), "..");
      const raw = pathResolve(parentDir, specifier);
      if (!existsSync(raw)) {
        if (existsSync(raw + ".ts")) {
          return nextResolve(pathToFileURL(raw + ".ts").href, context);
        } else if (existsSync(raw + ".tsx")) {
          return nextResolve(pathToFileURL(raw + ".tsx").href, context);
        } else if (existsSync(raw + "/index.ts")) {
          return nextResolve(pathToFileURL(raw + "/index.ts").href, context);
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
