import { BookmarkParser } from "./services/parser.service";
import { AIService } from "./services/ai.service";
import { BookmarkGenerator } from "./services/generator.service";
import { FileService } from "./services/file.service";
import type { Config } from "./config/config";
import type { Bookmark } from "./types/bookmark.types";
import { countBookmarksAndFolders } from "./utils/stats";
import chalk from "chalk";

export async function processBookmarks(config: Config): Promise<void> {
  try {
    console.log(
      chalk.blue("\n🔍 Initializing bookmark organization process...")
    );

    const fileService = new FileService(config.dataDir, config.outputDir);
    const parser = new BookmarkParser(config.browserType);
    const ai = new AIService(config.openaiApiKey);
    const generator = new BookmarkGenerator();

    const bookmarkFiles = fileService.getBookmarkFiles(config.browserType);

    if (bookmarkFiles.length === 0) {
      console.log(
        chalk.red(
          `\n❌ No ${config.browserType} bookmark files found in ${config.dataDir}`
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
          config.browserType
        } bookmark file${bookmarkFiles.length > 1 ? "s" : ""} to process...`
      )
    );

    for (const filePath of bookmarkFiles) {
      console.log(chalk.blue(`\n📂 Processing ${filePath}...`));

      let htmlContent;
      try {
        htmlContent = fileService.readBookmarkFile(filePath);
      } catch (error: any) {
        console.log(
          chalk.red(`\n❌ Error reading file ${filePath}: ${error.message}`)
        );
        continue;
      }

      let bookmarkTree;
      try {
        bookmarkTree = parser.parseHtmlFile(htmlContent);
      } catch (error: any) {
        console.log(
          chalk.red(
            `\n❌ Error parsing file ${filePath}: Invalid bookmark file format`
          )
        );
        continue;
      }

      const initialStats = countBookmarksAndFolders(bookmarkTree);
      console.log(
        chalk.green(
          `\n📊 Initial structure:
  - ${initialStats.bookmarkCount} bookmarks
  - ${initialStats.folderCount} folders`
        )
      );

      const allBookmarks: Bookmark[] = [];
      const collectBookmarks = (bookmarks: Bookmark[]) => {
        allBookmarks.push(...bookmarks);
      };

      const processFolder = (folder: any) => {
        collectBookmarks(folder.bookmarks);
        folder.subFolders.forEach(processFolder);
      };

      processFolder(bookmarkTree.root);

      console.log(
        chalk.blue(`\n🤖 Classifying ${allBookmarks.length} bookmarks...`)
      );
      const classifications = await ai.classifyBookmarks(allBookmarks);

      const classificationMap = new Map(
        classifications.map((c) => [
          c.url,
          { tags: c.suggestedTags, folder: c.suggestedFolder },
        ])
      );

      console.log(chalk.blue("\n🔄 Reorganizing bookmarks..."));
      const reorganizedTree = generator.reorganizeBookmarks(
        bookmarkTree,
        classificationMap
      );

      const finalStats = countBookmarksAndFolders(reorganizedTree);
      console.log(
        chalk.green(
          `\n📊 Final structure:
  - ${finalStats.bookmarkCount} bookmarks
  - ${finalStats.folderCount} folders`
        )
      );

      if (finalStats.bookmarkCount !== initialStats.bookmarkCount) {
        console.log(
          chalk.yellow(
            "\n⚠️ Warning: The number of bookmarks has changed during reorganization!"
          )
        );
      }

      console.log(chalk.blue("\n📝 Generating new bookmark file..."));
      const newHtmlContent = generator.generateHtmlFile(reorganizedTree);
      const outputPath = fileService.writeBookmarkFile(
        newHtmlContent,
        filePath
      );

      console.log(
        chalk.green(`\n✅ Created organized bookmark file: ${outputPath}`)
      );
    }

    console.log(
      chalk.green("\n🎉 All bookmark files have been processed successfully!")
    );
  } catch (error: any) {
    if (error.message?.includes("API key")) {
      console.error(
        chalk.red("\n❌ API Key Error: Please provide a valid API key")
      );
    } else {
      console.error(chalk.red("\n❌ Error:"), error);
    }
    throw error;
  }
}
