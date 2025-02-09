import type { BookmarkTree } from "../types/bookmark.types";

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
