export type BrowserType = "chrome" | "firefox";
export type AIModelType = "openai" | "deepseek";

export interface AIConfig {
  apiKey: string;
  model: AIModelType;
}

export interface Bookmark {
  title: string;
  url: string;
  icon?: string;
  addDate: number;
  tags?: string[];
  parentFolder?: string;
  browserType: BrowserType;
}

export interface BookmarkFolder {
  title: string;
  addDate: number;
  lastModified: number;
  bookmarks: Bookmark[];
  subFolders: BookmarkFolder[];
  parentFolder?: string;
  browserType: BrowserType;
}

export interface BookmarkTree {
  root: BookmarkFolder;
  browserType: BrowserType;
}

export interface AIClassificationResponse {
  url: string;
  suggestedTags: string[];
  suggestedFolder: string;
}
