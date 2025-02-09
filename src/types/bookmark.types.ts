export interface Bookmark {
    title: string;
    url: string;
    icon?: string;
    addDate: number;
    tags?: string[];
    parentFolder?: string;
}

export interface BookmarkFolder {
    title: string;
    addDate: number;
    lastModified: number;
    bookmarks: Bookmark[];
    subFolders: BookmarkFolder[];
    parentFolder?: string;
}

export interface BookmarkTree {
    root: BookmarkFolder;
}

export interface AIClassificationResponse {
    url: string;
    suggestedTags: string[];
    suggestedFolder: string;
} 