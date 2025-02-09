import { BookmarkService } from "./services/bookmark.service";
import type { Config } from "./config/config";

export async function processBookmarks(config: Config): Promise<void> {
  const bookmarkService = new BookmarkService(config);
  await bookmarkService.process();
}
