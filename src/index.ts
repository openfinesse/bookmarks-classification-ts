import { BookmarkParser } from "./services/parser.service";
import { AIService } from "./services/ai.service";
import { BookmarkGenerator } from "./services/generator.service";
import { FileService } from "./services/file.service";
import type { Config } from "./config/config";
import type { Bookmark } from "./types/bookmark.types";

export async function processBookmarks(config: Config): Promise<void> {
  try {
    const fileService = new FileService(config.dataDir, config.outputDir);
    const parser = new BookmarkParser(config.browserType);
    const ai = new AIService(config.openaiApiKey);
    const generator = new BookmarkGenerator();

    const bookmarkFiles = fileService.getBookmarkFiles(config.browserType);

    if (bookmarkFiles.length === 0) {
      console.log(
        `No ${config.browserType} bookmark files found in ${config.dataDir}`
      );
      return;
    }

    console.log(`Found ${bookmarkFiles.length} bookmark files to process...`);

    for (const filePath of bookmarkFiles) {
      console.log(`\nProcessing ${filePath}...`);

      const htmlContent = fileService.readBookmarkFile(filePath);
      const bookmarkTree = parser.parseHtmlFile(htmlContent);

      const allBookmarks: Bookmark[] = [];
      const collectBookmarks = (bookmarks: Bookmark[]) => {
        allBookmarks.push(...bookmarks);
      };

      const processFolder = (folder: any) => {
        collectBookmarks(folder.bookmarks);
        folder.subFolders.forEach(processFolder);
      };

      processFolder(bookmarkTree.root);

      console.log(`Classifying ${allBookmarks.length} bookmarks...`);
      const classifications = await ai.classifyBookmarks(allBookmarks);

      const classificationMap = new Map(
        classifications.map((c) => [
          c.url,
          { tags: c.suggestedTags, folder: c.suggestedFolder },
        ])
      );

      console.log("Reorganizing bookmarks...");
      const reorganizedTree = generator.reorganizeBookmarks(
        bookmarkTree,
        classificationMap
      );

      console.log("Generating new bookmark file...");
      const newHtmlContent = generator.generateHtmlFile(reorganizedTree);
      const outputPath = fileService.writeBookmarkFile(
        newHtmlContent,
        filePath
      );

      console.log(`Created organized bookmark file: ${outputPath}`);
    }

    console.log("\nAll bookmark files have been processed successfully!");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
