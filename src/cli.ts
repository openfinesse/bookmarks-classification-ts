#!/usr/bin/env node
import { program } from "commander";
import { defaultConfig } from "./config/config";
import { processBookmarks } from "./index";
import type { BrowserType } from "./types/bookmark.types";

program
  .name("bookmark-organizer")
  .description("Organize your browser bookmarks using AI")
  .version("1.0.0");

program
  .command("organize")
  .description("Organize bookmarks from the data directory")
  .option("-k, --api-key <key>", "OpenAI API key")
  .option("-b, --browser <type>", "Browser type (chrome or firefox)", "chrome")
  .action(async (options) => {
    const config = {
      ...defaultConfig,
      openaiApiKey: options.apiKey || process.env.OPENAI_API_KEY || "",
      browserType: options.browser as BrowserType,
    };

    if (!config.openaiApiKey) {
      console.error(
        "Error: OpenAI API key is required. Use --api-key or set OPENAI_API_KEY environment variable."
      );
      process.exit(1);
    }

    try {
      await processBookmarks(config);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
