import type { BrowserType, AIModelType } from "../types/bookmark.types";
import path from "path";

export interface Config {
  aiModel: AIModelType;
  apiKey: string;
  browserType: BrowserType;
  dataDir: string;
  outputDir: string;
  maxFolders?: number;
}

export const defaultConfig: Config = {
  aiModel: (process.env.AI_MODEL || "openai") as AIModelType,
  apiKey: process.env.AI_API_KEY || "",
  browserType: (process.env.BROWSER_TYPE || "chrome") as BrowserType,
  dataDir: path.join(process.cwd(), "data"),
  outputDir: path.join(process.cwd(), "data", "output"),
};
