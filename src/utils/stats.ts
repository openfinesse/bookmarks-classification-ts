import type { BookmarkTree, BookmarkFolder } from "../types/bookmark.types";
import type { Config } from "../config/config";
import chalk from "chalk";

export function countBookmarksAndFolders(tree: BookmarkTree): {
  bookmarkCount: number;
  folderCount: number;
  topLevelFolders: BookmarkFolder[];
} {
  let bookmarkCount = 0;
  let folderCount = 0;
  const topLevelFolders: BookmarkFolder[] = [];

  const processFolder = (folder: BookmarkFolder) => {
    if (folder.title !== "Bookmarks") {
      folderCount++;
    }
    bookmarkCount += folder.bookmarks.length;

    if (folder.parentFolder === "Bookmarks") {
      topLevelFolders.push(folder);
    }

    folder.subFolders.forEach(processFolder);
  };

  processFolder(tree.root);

  return {
    bookmarkCount,
    folderCount,
    topLevelFolders,
  };
}

export function printFinalStats(config: Config): void {
  if (config.maxFolders) {
    console.log(
      chalk.blue(
        `📊 Folder organization strategy: ${config.maxFolders} top-level folders maximum`
      )
    );
  } else {
    console.log(
      chalk.blue(
        "📊 Folder organization strategy: No limit on top-level folders"
      )
    );
  }
}
