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
  private batchSize: number = 50;

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

  private async classifyBookmarkBatch(
    bookmarks: Bookmark[]
  ): Promise<AIClassificationResponse[]> {
    const prompt = `Analyze these bookmarks and suggest appropriate tags and folders for each:

${bookmarks
  .map(
    (b, i) => `[${i + 1}]
Title: ${b.title}
URL: ${b.url}`
  )
  .join("\n\n")}

For each bookmark, provide the classification in this exact format:
[Number]
Tags: tag1, tag2, tag3
Folder: folder_name

Consider the content, purpose, and context of each bookmark.`;

    try {
      const response = await this.retryWithDelay(() =>
        this.openai.chat.completions.create({
          model: this.model === "openai" ? "gpt-3.5-turbo" : "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "You are a bookmark classification assistant. Analyze URLs and titles to suggest tags and folders for organization. Be concise and follow the exact format requested.",
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

      const sections = content
        .split(/\[\d+\]/)
        .filter((section: string) => section.trim());

      return bookmarks.map((bookmark, index) => {
        const section = sections[index] || "";
        const lines = section.split("\n").map((line: string) => line.trim());

        const tags =
          lines
            .find((line: string) => line.toLowerCase().startsWith("tags:"))
            ?.substring(5)
            .split(",")
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag.length > 0) || [];

        const folder =
          lines
            .find((line: string) => line.toLowerCase().startsWith("folder:"))
            ?.substring(7)
            .trim() || "Uncategorized";

        return {
          url: bookmark.url,
          suggestedTags: tags,
          suggestedFolder: folder,
        };
      });
    } catch (error: any) {
      await this.handleAPIError(error);
      return [];
    }
  }

  public async classifyBookmarks(
    bookmarks: Bookmark[]
  ): Promise<AIClassificationResponse[]> {
    const results: AIClassificationResponse[] = [];
    let failedBookmarks: Bookmark[] = [];

    for (let i = 0; i < bookmarks.length; i += this.batchSize) {
      const batch = bookmarks.slice(i, i + this.batchSize);
      try {
        console.log(
          chalk.blue(
            `\n📦 Processing batch ${i / this.batchSize + 1}/${Math.ceil(
              bookmarks.length / this.batchSize
            )} (${batch.length} bookmarks)...`
          )
        );

        const batchResults = await this.classifyBookmarkBatch(batch);
        results.push(...batchResults);

        if (i + this.batchSize < bookmarks.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
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
        failedBookmarks.push(...batch);
        console.error(
          chalk.red(
            `\n❌ Failed to classify batch of ${batch.length} bookmarks`
          )
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
