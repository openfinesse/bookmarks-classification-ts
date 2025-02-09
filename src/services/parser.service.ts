import { JSDOM } from 'jsdom';
import { Bookmark, BookmarkFolder, BookmarkTree } from '../types/bookmark.types';

export class BookmarkParser {
    private parseBookmark(element: Element): Bookmark {
        const link = element as HTMLAnchorElement;
        return {
            title: link.textContent || '',
            url: link.href,
            icon: link.getAttribute('ICON') || undefined,
            addDate: parseInt(link.getAttribute('ADD_DATE') || '0'),
            tags: [],
        };
    }

    private parseFolder(element: Element, parentTitle?: string): BookmarkFolder {
        const title = element.querySelector('h3')?.textContent || '';
        const addDate = parseInt(element.querySelector('h3')?.getAttribute('ADD_DATE') || '0');
        const lastModified = parseInt(element.querySelector('h3')?.getAttribute('LAST_MODIFIED') || '0');

        const bookmarks: Bookmark[] = [];
        const subFolders: BookmarkFolder[] = [];

        const dl = element.querySelector('dl');
        if (dl) {
            for (const child of dl.children) {
                if (child.tagName === 'DT') {
                    if (child.querySelector('h3')) {
                        subFolders.push(this.parseFolder(child, title));
                    } else if (child.querySelector('a')) {
                        const bookmark = this.parseBookmark(child.querySelector('a')!);
                        bookmark.parentFolder = title;
                        bookmarks.push(bookmark);
                    }
                }
            }
        }

        return {
            title,
            addDate,
            lastModified,
            bookmarks,
            subFolders,
            parentFolder: parentTitle
        };
    }

    public parseHtmlFile(htmlContent: string): BookmarkTree {
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;

        const rootElement = document.querySelector('dl');
        if (!rootElement) {
            throw new Error('Invalid bookmark file format');
        }

        const root = this.parseFolder(rootElement);
        return { root };
    }
} 