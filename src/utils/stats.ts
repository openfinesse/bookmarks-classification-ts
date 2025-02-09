import type { BookmarkTree } from "../types/bookmark.types";
import type { Config } from "../config/config";
import chalk from "chalk";

export interface BookmarkStats {
  bookmarkCount: number;
  folderCount: number;
}

export function countBookmarksAndFolders(tree: BookmarkTree): BookmarkStats {
  const stats: BookmarkStats = {
    bookmarkCount: 0,
    folderCount: 0,
  };

  function processFolder(folder: any) {
    stats.bookmarkCount += folder.bookmarks.length;
    stats.folderCount += 1;
    folder.subFolders.forEach(processFolder);
  }

  processFolder(tree.root);
  return stats;
}

export function printFinalStats(config: Config): void {
  if (config.maxFolders) {
    console.log(
      chalk.blue(
        `\n📊 Folder organization strategy: ${config.maxFolders} top-level folders maximum`
      )
    );
  } else {
    console.log(
      chalk.blue(
        "\n📊 Folder organization strategy: No limit on top-level folders"
      )
    );
  }
}
