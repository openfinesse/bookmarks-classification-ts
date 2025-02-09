import arg from "arg";
import type { AIModelType, BrowserType } from "./types/bookmark.types";

export interface Config {
  apiKey: string;
  model: AIModelType;
  browser: BrowserType;
  maxFolders?: number;
}

export function getConfig(): Config {
  const args = arg({
    "--api-key": String,
    "--browser": String,
    "--model": String,
    "--max-folders": Number,
  });

  const apiKey = args["--api-key"] || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "API key is required. Set AI_API_KEY environment variable or use --api-key option."
    );
  }

  const model = (args["--model"] ||
    process.env.AI_MODEL ||
    "openai") as AIModelType;
  const browser = (args["--browser"] || "chrome") as BrowserType;
  const maxFolders = args["--max-folders"];

  return {
    apiKey,
    model,
    browser,
    maxFolders,
  };
}
