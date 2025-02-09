import { BookmarkParser } from "./parser.service";
import { AIService } from "./ai.service";
import { BookmarkGenerator } from "./generator.service";
import { FileService } from "./file.service";
import type { Config } from "../config/config";
import type { Bookmark, BookmarkTree } from "../types/bookmark.types";
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

    const classificationMap = new Map(
      classifications.map((c) => [
        c.url,
        { tags: c.suggestedTags, folder: c.suggestedFolder },
      ])
    );

    console.log(chalk.blue("\n🔄 Reorganizing bookmarks..."));
    let reorganizedTree = this.generator.reorganizeBookmarks(
      bookmarkTree,
      classificationMap
    );

    if (this.config.maxFolders && this.config.maxFolders > 0) {
      console.log(
        chalk.blue(
          `\n🔄 Creating ${this.config.maxFolders} top-level categories...`
        )
      );

      const allFolders = this.generator.getAllFolderNames(reorganizedTree);
      console.log(
        chalk.yellow(
          `\nℹ️ Found ${allFolders.length} folders to organize into ${this.config.maxFolders} categories`
        )
      );

      const groupings = await this.ai.groupFolders(
        allFolders,
        this.config.maxFolders
      );

      console.log(
        chalk.green(`\n✅ Created ${groupings.size} top-level categories:`)
      );
      for (const [category, folders] of groupings) {
        console.log(chalk.blue(`\n📁 ${category}:`));
        folders.forEach((folder) => console.log(chalk.gray(`  - ${folder}`)));
      }

      // Update folder paths in classifications
      for (const [category, folders] of groupings) {
        for (const classification of classifications) {
          if (folders.includes(classification.suggestedFolder)) {
            classification.suggestedFolder = `${category}/${classification.suggestedFolder}`;
          }
        }
      }

      // Regenerate tree with updated classifications
      const updatedClassificationMap = new Map(
        classifications.map((c) => [
          c.url,
          { tags: c.suggestedTags, folder: c.suggestedFolder },
        ])
      );

      reorganizedTree = this.generator.reorganizeBookmarks(
        bookmarkTree,
        updatedClassificationMap
      );
    }

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
    console.log(
      chalk.green(
        `\n📊 Final structure:
- ${finalStats.bookmarkCount} bookmarks (${
          initialStats.bookmarkCount - finalStats.bookmarkCount
        } unclassified)
- ${finalStats.folderCount} folders`
      )
    );

    if (finalStats.bookmarkCount !== initialStats.bookmarkCount) {
      console.log(
        chalk.yellow(
          "\n⚠️ Warning: Some bookmarks could not be processed and were skipped."
        )
      );
    }
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
