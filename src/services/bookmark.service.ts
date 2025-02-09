import { BookmarkParser } from "./parser.service";
import { AIService } from "./ai.service";
import { BookmarkGenerator } from "./generator.service";
import { FileService } from "./file.service";
import type { Config } from "../config/config";
import type {
  Bookmark,
  BookmarkTree,
  BookmarkFolder,
} from "../types/bookmark.types";
import { countBookmarksAndFolders, printFinalStats } from "../utils/stats";
import { AIServiceError } from "../types/errors";
import chalk from "chalk";

export class BookmarkService {
  private fileService: FileService;
  private parser: BookmarkParser;
  private ai: AIService;
  private generator: BookmarkGenerator;

  constructor(private config: Config) {
    this.fileService = new FileService(config.dataDir, config.outputDir);
    this.parser = new BookmarkParser(config.browserType);
    this.ai = new AIService({ apiKey: config.apiKey, model: config.aiModel });
    this.generator = new BookmarkGenerator();
  }

  private collectBookmarks(tree: BookmarkTree): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    const processFolder = (folder: any) => {
      bookmarks.push(...folder.bookmarks);
      folder.subFolders.forEach(processFolder);
    };
    processFolder(tree.root);
    return bookmarks;
  }

  private async processBookmarkFile(filePath: string): Promise<void> {
    console.log(chalk.blue(`\n📂 Processing ${filePath}...`));

    const htmlContent = await this.fileService.readBookmarkFile(filePath);
    const bookmarkTree = this.parser.parseHtmlFile(htmlContent);

    const initialStats = countBookmarksAndFolders(bookmarkTree);
    console.log(
      chalk.green(
        `\n📊 Initial structure:
- ${initialStats.bookmarkCount} bookmarks
- ${initialStats.folderCount} folders`
      )
    );

    const allBookmarks = this.collectBookmarks(bookmarkTree);
    console.log(
      chalk.blue(`\n🤖 Classifying ${allBookmarks.length} bookmarks...`)
    );

    const classifications = await this.ai.classifyBookmarks(allBookmarks);
    if (classifications.length === 0) {
      console.log(
        chalk.yellow(
          "\n⚠️ No bookmarks were classified. Skipping reorganization."
        )
      );
      return;
    }

    if (classifications.length < allBookmarks.length) {
      console.log(
        chalk.yellow(
          `\n⚠️ Only ${classifications.length} out of ${allBookmarks.length} bookmarks were classified.`
        )
      );
    }

    let classificationMap = new Map(
      classifications.map((c) => [
        c.url,
        { tags: c.suggestedTags, folder: c.suggestedFolder },
      ])
    );

    if (this.config.maxFolders && this.config.maxFolders > 0) {
      console.log(
        chalk.blue(
          `\n🔄 Creating ${this.config.maxFolders} top-level categories...`
        )
      );

      const uniqueFolders = Array.from(
        new Set(classifications.map((c) => c.suggestedFolder))
      ).filter(Boolean);

      console.log(
        chalk.yellow(
          `\nℹ️ Found ${uniqueFolders.length} folders to organize into ${this.config.maxFolders} categories`
        )
      );

      const groupings = await this.ai.groupFolders(
        uniqueFolders,
        this.config.maxFolders
      );

      console.log(
        chalk.green(`\n✅ Created ${groupings.size} top-level categories:`)
      );

      const folderToCategory = new Map<string, string>();
      for (const [category, folders] of groupings) {
        console.log(chalk.blue(`\n📁 ${category}:`));
        folders.forEach((folder) => {
          console.log(chalk.gray(`  - ${folder}`));
          folderToCategory.set(folder, category);
        });
      }

      const updatedClassifications = classifications.map((classification) => {
        const suggestedFolder = classification.suggestedFolder.trim();
        if (!suggestedFolder) {
          return {
            ...classification,
            suggestedFolder: "Digital Resources/Uncategorized",
          };
        }

        let category = folderToCategory.get(suggestedFolder);

        if (!category) {
          for (const [
            existingFolder,
            mappedCategory,
          ] of folderToCategory.entries()) {
            if (
              suggestedFolder
                .toLowerCase()
                .includes(existingFolder.toLowerCase()) ||
              existingFolder
                .toLowerCase()
                .includes(suggestedFolder.toLowerCase())
            ) {
              category = mappedCategory;
              break;
            }
          }
        }

        if (category) {
          return {
            ...classification,
            suggestedFolder: `${category}/${suggestedFolder}`,
          };
        }

        for (const [mainCategory] of groupings) {
          if (
            suggestedFolder
              .toLowerCase()
              .includes(mainCategory.toLowerCase()) ||
            mainCategory.toLowerCase().includes(suggestedFolder.toLowerCase())
          ) {
            return {
              ...classification,
              suggestedFolder: `${mainCategory}/${suggestedFolder}`,
            };
          }
        }

        const generalCategory = this.findBestCategory(
          suggestedFolder,
          Array.from(groupings.keys())
        );
        console.log(
          chalk.yellow(
            `ℹ️ Assigning folder "${suggestedFolder}" to general category "${generalCategory}"`
          )
        );
        return {
          ...classification,
          suggestedFolder: `${generalCategory}/${suggestedFolder}`,
        };
      });

      classificationMap = new Map(
        updatedClassifications.map((c) => [
          c.url,
          { tags: c.suggestedTags, folder: c.suggestedFolder },
        ])
      );
    }

    console.log(chalk.blue("\n🔄 Reorganizing bookmarks..."));
    const reorganizedTree = this.generator.reorganizeBookmarks(
      bookmarkTree,
      classificationMap
    );

    const finalStats = countBookmarksAndFolders(reorganizedTree);
    this.logFinalStats(initialStats, finalStats);

    console.log(chalk.blue("\n📝 Generating new bookmark file..."));
    const newHtmlContent = this.generator.generateHtmlFile(reorganizedTree);
    const outputPath = this.fileService.writeBookmarkFile(
      newHtmlContent,
      filePath
    );

    console.log(
      chalk.green(`\n✅ Created organized bookmark file: ${outputPath}`)
    );
  }

  private logFinalStats(initialStats: any, finalStats: any): void {
    const topLevelFolders = finalStats.topLevelFolders;
    const expectedTopLevelCount = this.config.maxFolders || 0;

    console.log(
      chalk.green(
        `\n📊 Final structure:
- ${finalStats.bookmarkCount} bookmarks (${
          initialStats.bookmarkCount - finalStats.bookmarkCount
        } unclassified)
- ${finalStats.folderCount} total folders
- ${topLevelFolders.length} top-level categories:`
      )
    );

    topLevelFolders.forEach((folder: BookmarkFolder) => {
      console.log(chalk.blue(`\n📁 ${folder.title}:`));
      folder.subFolders.forEach((subFolder: BookmarkFolder) => {
        console.log(chalk.gray(`  - ${subFolder.title}`));
      });
    });

    if (
      this.config.maxFolders &&
      topLevelFolders.length !== this.config.maxFolders
    ) {
      console.log(
        chalk.red(
          `\n⚠️ Warning: Found ${topLevelFolders.length} top-level folders instead of the expected ${this.config.maxFolders}`
        )
      );
    }

    if (finalStats.bookmarkCount !== initialStats.bookmarkCount) {
      console.log(
        chalk.yellow(
          `\n⚠️ Warning: ${
            initialStats.bookmarkCount - finalStats.bookmarkCount
          } bookmarks could not be processed and were skipped.`
        )
      );
    }
  }

  private findBestCategory(folderName: string, categories: string[]): string {
    const categoryKeywords: { [key: string]: string[] } = {
      Technology: [
        "tech",
        "programming",
        "software",
        "dev",
        "code",
        "api",
        "web",
        "app",
        "tool",
      ],
      "Work & Business": [
        "business",
        "work",
        "job",
        "finance",
        "market",
        "company",
        "professional",
      ],
      "Digital Resources": [
        "resource",
        "online",
        "digital",
        "internet",
        "cloud",
        "service",
      ],
      "Design & Creativity": [
        "design",
        "art",
        "creative",
        "visual",
        "graphic",
        "photo",
        "portfolio",
      ],
      "Learning & Education": [
        "learn",
        "education",
        "course",
        "tutorial",
        "guide",
        "training",
      ],
      "Leisure & Lifestyle": [
        "entertainment",
        "game",
        "music",
        "movie",
        "sport",
        "hobby",
      ],
      "Security & Privacy": [
        "security",
        "privacy",
        "crypto",
        "blockchain",
        "protect",
      ],
      "E-commerce & Shopping": [
        "shop",
        "store",
        "commerce",
        "retail",
        "product",
      ],
      "Health & Wellness": [
        "health",
        "wellness",
        "fitness",
        "medical",
        "lifestyle",
      ],
      "Community & Communication": [
        "community",
        "social",
        "communication",
        "forum",
        "chat",
      ],
    };

    const folderLower = folderName.toLowerCase();

    let bestCategory = "Digital Resources";
    let maxMatches = 0;

    for (const category of categories) {
      const keywords = categoryKeywords[category] || [];
      const matches = keywords.filter((keyword) =>
        folderLower.includes(keyword)
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  public async process(): Promise<void> {
    try {
      console.log(
        chalk.blue("\n🔍 Initializing bookmark organization process...")
      );
      printFinalStats(this.config);
      console.log(
        chalk.blue(
          `Using ${this.config.aiModel.toUpperCase()} for bookmark classification...`
        )
      );

      const bookmarkFiles = this.fileService.getBookmarkFiles(
        this.config.browserType
      );
      if (bookmarkFiles.length === 0) {
        console.log(
          chalk.red(
            `\n❌ No ${this.config.browserType} bookmark files found in ${this.config.dataDir}`
          )
        );
        console.log(
          chalk.yellow(
            "Make sure to export your bookmarks as HTML and place them in the data directory."
          )
        );
        return;
      }

      console.log(
        chalk.green(
          `\n✅ Found ${bookmarkFiles.length} ${
            this.config.browserType
          } bookmark file${bookmarkFiles.length > 1 ? "s" : ""} to process...`
        )
      );

      for (const filePath of bookmarkFiles) {
        try {
          await this.processBookmarkFile(filePath);
        } catch (error) {
          if (error instanceof AIServiceError) {
            console.error(chalk.red(`\n❌ ${error.message}`));
            if (error.details.status === 402) {
              console.log(
                chalk.yellow(
                  `\nℹ️ Stopping process due to ${this.config.aiModel.toUpperCase()} API insufficient balance.`
                )
              );
              return;
            }
          } else {
            console.error(chalk.red("\n❌ Unexpected error:"), error);
          }
        }
      }

      console.log(
        chalk.green("\n🎉 All bookmark files have been processed successfully!")
      );
      printFinalStats(this.config);
    } catch (error: any) {
      console.error(chalk.red("\n❌ Fatal error:"), error);
      throw error;
    }
  }
}
