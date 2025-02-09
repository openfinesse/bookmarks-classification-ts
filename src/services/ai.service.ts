import OpenAI from "openai";
import type {
  Bookmark,
  AIClassificationResponse,
  AIModelType,
} from "../types/bookmark.types";
import { AIServiceError } from "../types/errors";
import chalk from "chalk";

export class AIService {
  private openai: OpenAI;
  private model: AIModelType;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(apiKey: string, model: AIModelType) {
    this.model = model;
    this.openai = new OpenAI({
      apiKey,
      baseURL: model === "deepseek" ? "https://api.deepseek.com" : undefined,
    });
  }

  private async handleAPIError(error: any): Promise<never> {
    const provider = this.model.toUpperCase();
    throw AIServiceError.fromOpenAIError(error, provider);
  }

  private async retryWithDelay(fn: () => Promise<any>): Promise<any> {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 402) {
        throw AIServiceError.fromOpenAIError(error, this.model.toUpperCase());
      }

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(
          chalk.yellow(
            `\n⚠️ API call failed, retrying (${this.retryCount}/${this.maxRetries})...`
          )
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.retryWithDelay(fn);
      }

      throw error;
    }
  }

  public async classifyBookmark(
    bookmark: Bookmark
  ): Promise<AIClassificationResponse> {
    const prompt = `Analyze this bookmark and suggest appropriate tags and folder:
Title: ${bookmark.title}
URL: ${bookmark.url}

Please classify this bookmark and suggest:
1. A list of relevant tags
2. The most appropriate folder name for this bookmark

Consider the content, purpose, and context of the bookmark.`;

    try {
      const response = await this.retryWithDelay(() =>
        this.openai.chat.completions.create({
          model: this.model === "openai" ? "gpt-3.5-turbo" : "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "You are a bookmark classification assistant. You analyze URLs and their titles to suggest appropriate tags and folders for organization.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
        })
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const lines = content.split("\n");
      const tags =
        lines
          .find((line) => line.toLowerCase().includes("tags:"))
          ?.split(":")[1]
          ?.split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0) || [];

      const folder =
        lines
          .find((line) => line.toLowerCase().includes("folder:"))
          ?.split(":")[1]
          ?.trim() || "Uncategorized";

      return {
        url: bookmark.url,
        suggestedTags: tags,
        suggestedFolder: folder,
      };
    } catch (error: any) {
      await this.handleAPIError(error);
    }
  }

  public async classifyBookmarks(
    bookmarks: Bookmark[]
  ): Promise<AIClassificationResponse[]> {
    const results: AIClassificationResponse[] = [];
    let failedBookmarks: Bookmark[] = [];

    for (const bookmark of bookmarks) {
      try {
        const result = await this.classifyBookmark(bookmark);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        if (error instanceof AIServiceError) {
          console.error(chalk.red(`\n❌ ${error.message}`));
          if (error.details.status === 402) {
            console.log(
              chalk.yellow(
                "\nℹ️ Stopping classification process due to insufficient balance."
              )
            );
            break;
          }
        }
        failedBookmarks.push(bookmark);
        console.error(
          chalk.red(`\n❌ Failed to classify bookmark: ${bookmark.url}`)
        );
      }
    }

    if (failedBookmarks.length > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️ ${failedBookmarks.length} bookmarks could not be classified.`
        )
      );
    }

    return results;
  }
}
