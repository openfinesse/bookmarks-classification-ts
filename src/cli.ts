#!/usr/bin/env node
import { program } from "commander";
import { defaultConfig } from "./config/config";
import { processBookmarks } from "./index";
import type { BrowserType, AIModelType } from "./types/bookmark.types";

program
  .name("bookmark-organizer")
  .description("Organize your browser bookmarks using AI")
  .version("1.0.0");

program
  .command("organize")
  .description("Organize bookmarks from the data directory")
  .option("-k, --api-key <key>", "AI API key (OpenAI or DeepSeek)")
  .option("-m, --model <type>", "AI model (openai or deepseek)", "openai")
  .option("-b, --browser <type>", "Browser type (chrome or firefox)", "chrome")
  .option("-f, --max-folders <number>", "Maximum number of top-level folders")
  .action(async (options) => {
    const config = {
      ...defaultConfig,
      apiKey: options.apiKey || process.env.AI_API_KEY || "",
      aiModel: options.model as AIModelType,
      browserType: options.browser as BrowserType,
      maxFolders: options.maxFolders ? parseInt(options.maxFolders) : undefined,
    };

    if (!config.apiKey) {
      console.error(
        "Error: API key is required. Use --api-key or set AI_API_KEY environment variable."
      );
      process.exit(1);
    }

    if (!["openai", "deepseek"].includes(config.aiModel)) {
      console.error(
        "Error: Invalid AI model. Please use either 'openai' or 'deepseek'."
      );
      process.exit(1);
    }

    if (
      config.maxFolders !== undefined &&
      (isNaN(config.maxFolders) || config.maxFolders < 1)
    ) {
      console.error("Error: --max-folders must be a positive number.");
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
