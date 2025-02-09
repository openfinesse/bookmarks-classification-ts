import type {
  Bookmark,
  BookmarkFolder,
  BookmarkTree,
} from "../types/bookmark.types";

export class BookmarkGenerator {
  private generateBookmarkHtml(bookmark: Bookmark): string {
    const iconAttr = bookmark.icon ? ` ICON="${bookmark.icon}"` : "";
    return `        <DT><A HREF="${bookmark.url}" ADD_DATE="${bookmark.addDate}"${iconAttr}>${bookmark.title}</A>`;
  }

  private generateFolderHtml(
    folder: BookmarkFolder,
    indent: string = ""
  ): string {
    let html = `${indent}<DT><H3 ADD_DATE="${folder.addDate}" LAST_MODIFIED="${folder.lastModified}">${folder.title}</H3>\n`;
    html += `${indent}<DL><p>\n`;

    for (const bookmark of folder.bookmarks) {
      html += `${indent}${this.generateBookmarkHtml(bookmark)}\n`;
    }

    for (const subFolder of folder.subFolders) {
      html += this.generateFolderHtml(subFolder, indent + "    ");
    }

    html += `${indent}</DL><p>\n`;
    return html;
  }

  public generateHtmlFile(bookmarkTree: BookmarkTree): string {
    const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
`;

    const content = this.generateFolderHtml(bookmarkTree.root);
    return header + content;
  }

  public reorganizeBookmarks(
    bookmarkTree: BookmarkTree,
    aiClassifications: Map<string, { tags: string[]; folder: string }>
  ): BookmarkTree {
    const newRoot: BookmarkFolder = {
      title: "Bookmarks",
      addDate: Date.now(),
      lastModified: Date.now(),
      bookmarks: [],
      subFolders: [],
      browserType: bookmarkTree.browserType,
    };

    const folderMap = new Map<string, BookmarkFolder>();

    const getOrCreateFolder = (folderPath: string): BookmarkFolder => {
      if (!folderMap.has(folderPath)) {
        const parts = folderPath.split("/");
        let currentPath = "";
        let currentFolder = newRoot;

        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          if (!folderMap.has(currentPath)) {
            const newFolder: BookmarkFolder = {
              title: part,
              addDate: Date.now(),
              lastModified: Date.now(),
              bookmarks: [],
              subFolders: [],
              browserType: bookmarkTree.browserType,
            };
            folderMap.set(currentPath, newFolder);

            if (currentPath === part) {
              newRoot.subFolders.push(newFolder);
            } else {
              const parentPath = currentPath.substring(
                0,
                currentPath.lastIndexOf("/")
              );
              const parentFolder = folderMap.get(parentPath)!;
              parentFolder.subFolders.push(newFolder);
            }
          }
          currentFolder = folderMap.get(currentPath)!;
        }
      }
      return folderMap.get(folderPath)!;
    };

    const processFolder = (folder: BookmarkFolder) => {
      for (const bookmark of folder.bookmarks) {
        const classification = aiClassifications.get(bookmark.url);
        if (classification) {
          const targetFolder = getOrCreateFolder(classification.folder);
          bookmark.tags = classification.tags;
          targetFolder.bookmarks.push(bookmark);
        } else {
          getOrCreateFolder(folder.title).bookmarks.push(bookmark);
        }
      }

      for (const subFolder of folder.subFolders) {
        processFolder(subFolder);
      }
    };

    processFolder(bookmarkTree.root);

    // Sort folders and bookmarks alphabetically
    const sortFolderRecursively = (folder: BookmarkFolder) => {
      folder.subFolders.sort((a, b) => a.title.localeCompare(b.title));
      folder.bookmarks.sort((a, b) => a.title.localeCompare(b.title));
      folder.subFolders.forEach(sortFolderRecursively);
    };

    sortFolderRecursively(newRoot);

    return { root: newRoot, browserType: bookmarkTree.browserType };
  }

  public getAllFolderNames(bookmarkTree: BookmarkTree): string[] {
    const folderNames: string[] = [];

    const collectFolderNames = (folder: BookmarkFolder) => {
      if (folder.title !== "Bookmarks") {
        folderNames.push(folder.title);
      }
      folder.subFolders.forEach(collectFolderNames);
    };

    collectFolderNames(bookmarkTree.root);
    return folderNames;
  }
}
