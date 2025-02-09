import type { BrowserType } from "../types/bookmark.types";
import path from "path";

export interface Config {
  openaiApiKey: string;
  browserType: BrowserType;
  dataDir: string;
  outputDir: string;
}

export const defaultConfig: Config = {
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  browserType: (process.env.BROWSER_TYPE || "chrome") as BrowserType,
  dataDir: path.join(process.cwd(), "data"),
  outputDir: path.join(process.cwd(), "data", "output"),
};
