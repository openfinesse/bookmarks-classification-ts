import type { Bookmark, BookmarkFolder, BookmarkTree } from '../types/bookmark.types';

export class BookmarkGenerator {
    private generateBookmarkHtml(bookmark: Bookmark): string {
        const iconAttr = bookmark.icon ? ` ICON="${bookmark.icon}"` : '';
        return `        <DT><A HREF="${bookmark.url}" ADD_DATE="${bookmark.addDate}"${iconAttr}>${bookmark.title}</A>`;
    }

    private generateFolderHtml(folder: BookmarkFolder, indent: string = ''): string {
        let html = `${indent}<DT><H3 ADD_DATE="${folder.addDate}" LAST_MODIFIED="${folder.lastModified}">${folder.title}</H3>\n`;
        html += `${indent}<DL><p>\n`;

        // Add bookmarks
        for (const bookmark of folder.bookmarks) {
            html += `${indent}${this.generateBookmarkHtml(bookmark)}\n`;
        }

        // Add subfolders
        for (const subFolder of folder.subFolders) {
            html += this.generateFolderHtml(subFolder, indent + '    ');
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
            title: 'Bookmarks',
            addDate: Date.now(),
            lastModified: Date.now(),
            bookmarks: [],
            subFolders: []
        };

        const folderMap = new Map<string, BookmarkFolder>();

        // Function to get or create a folder
        const getOrCreateFolder = (folderName: string): BookmarkFolder => {
            if (!folderMap.has(folderName)) {
                const newFolder: BookmarkFolder = {
                    title: folderName,
                    addDate: Date.now(),
                    lastModified: Date.now(),
                    bookmarks: [],
                    subFolders: []
                };
                folderMap.set(folderName, newFolder);
                newRoot.subFolders.push(newFolder);
            }
            return folderMap.get(folderName)!;
        };

        // Recursive function to process folders
        const processFolder = (folder: BookmarkFolder) => {
            // Process bookmarks in current folder
            for (const bookmark of folder.bookmarks) {
                const classification = aiClassifications.get(bookmark.url);
                if (classification) {
                    const targetFolder = getOrCreateFolder(classification.folder);
                    bookmark.tags = classification.tags;
                    targetFolder.bookmarks.push(bookmark);
                } else {
                    // Keep bookmark in its original folder if no classification
                    getOrCreateFolder(folder.title).bookmarks.push(bookmark);
                }
            }

            // Process subfolders
            for (const subFolder of folder.subFolders) {
                processFolder(subFolder);
            }
        };

        processFolder(bookmarkTree.root);

        // Sort folders and bookmarks alphabetically
        newRoot.subFolders.sort((a, b) => a.title.localeCompare(b.title));
        newRoot.subFolders.forEach(folder => {
            folder.bookmarks.sort((a, b) => a.title.localeCompare(b.title));
        });

        return { root: newRoot };
    }
} 