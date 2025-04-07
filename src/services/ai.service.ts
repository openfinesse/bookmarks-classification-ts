import OpenAI from "openai";
import type {
  Bookmark,
  AIClassificationResponse,
  AIModelType,
  AIConfig,
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

  constructor(private config: AIConfig) {
    this.model = config.model;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL:
        config.model === "deepseek" ? "https://api.deepseek.com/v1" : undefined,
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
      const aiError = AIServiceError.fromOpenAIError(
        error,
        this.model.toUpperCase()
      );

      if (aiError.isQuotaError) {
        throw aiError;
      }

      if (this.retryCount < this.maxRetries && aiError.shouldRetry) {
        this.retryCount++;
        console.log(
          chalk.yellow(
            `\n⚠️ API call failed, retrying (${this.retryCount}/${this.maxRetries})...`
          )
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * this.retryCount)
        );
        return this.retryWithDelay(fn);
      }

      throw aiError;
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

Consider the content, purpose, and context of each bookmark.${
      this.config.customPrompt
        ? `\n\nAdditional instructions: ${this.config.customPrompt}`
        : ""
    }`;

    try {
      const response = await this.retryWithDelay(() =>
        this.openai.chat.completions.create({
          model: this.model === "openai" ? "gpt-4o-mini" : "deepseek-chat",
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

  async groupFolders(
    folders: string[],
    targetCount: number
  ): Promise<Map<string, string[]>> {
    const prompt = `You are organizing browser bookmarks into a hierarchical structure. 
Given these ${
      folders.length
    } folder names, create exactly ${targetCount} broad top-level categories.
Each category should be generic enough to accommodate multiple related topics.

Current folders to organize:
${folders.join("\n")}

Requirements:
1. Create exactly ${targetCount} broad, inclusive categories
2. Every folder MUST be assigned to a category
3. Categories should be clear and intuitive for a bookmark hierarchy
4. Avoid overlapping categories
5. Use generic names that can encompass related subcategories
6. Consider common bookmark organization patterns${
      this.config.customFolderPrompt
        ? `\n\nAdditional instructions: ${this.config.customFolderPrompt}`
        : ""
    }

Return the result as a JSON object where:
- Keys are the new top-level category names (exactly ${targetCount})
- Values are arrays of existing folder names that should go under each category
- Every existing folder must be assigned to exactly one category
- Category names should be clear and concise

Example format:
{
  "Technology & Development": ["Programming", "Web Development", "Software", "Tools"],
  "Business & Work": ["Projects", "Marketing", "Resources", "Professional"],
  "Media & Entertainment": ["Movies", "Music", "Games", "Videos"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model === "deepseek" ? "deepseek-chat" : "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a bookmark organization assistant. Return only valid JSON that matches the requested format exactly.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      let content = response.choices[0].message.content;
      if (!content) throw new Error("No content in response");

      // Sanitize the content to handle potential JSON parsing issues
      // 1. Remove backticks around JSON if present (e.g., ```json {...} ```)
      content = content.replace(/```(?:json)?\s*|\s*```/g, '');
      
      // 2. Make sure content is valid JSON
      content = content.trim();
      
      // Check if content starts with { and ends with }
      if (!content.startsWith('{') || !content.endsWith('}')) {
        console.log(chalk.yellow("\n⚠️ API response doesn't appear to be valid JSON. Attempting to extract JSON content..."));
        
        // Try to find JSON-like content between curly braces
        const jsonMatch = content.match(/{[\s\S]*}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        } else {
          throw new Error("Unable to extract valid JSON from API response");
        }
      }

      try {
        const groupings = JSON.parse(content);
        return new Map(Object.entries(groupings));
      } catch (parseError: any) {
        console.error(chalk.red("\n❌ Failed to parse JSON response:"), content);
        throw new Error(`JSON Parse error: ${parseError.message}`);
      }
    } catch (error: any) {
      throw AIServiceError.fromOpenAIError(error, this.model);
    }
  }
}
