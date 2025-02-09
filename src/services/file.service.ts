import fs from "fs";
import path from "path";
import type { BrowserType } from "../types/bookmark.types";

export class FileService {
  constructor(private dataDir: string, private outputDir: string) {
    this.ensureDirectoryExists(this.outputDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public getBookmarkFiles(browserType: BrowserType): string[] {
    const files = fs.readdirSync(this.dataDir);
    return files
      .filter((file) => file.endsWith(".html"))
      .filter((file) => {
        const content = fs.readFileSync(path.join(this.dataDir, file), "utf-8");
        if (browserType === "chrome") {
          return content.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
        } else {
          return content.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
        }
      })
      .map((file) => path.join(this.dataDir, file));
  }

  public readBookmarkFile(filePath: string): string {
    return fs.readFileSync(filePath, "utf-8");
  }

  public writeBookmarkFile(content: string, originalFileName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = path.basename(originalFileName, ".html");
    const outputPath = path.join(
      this.outputDir,
      `${fileName}_organized_${timestamp}.html`
    );

    fs.writeFileSync(outputPath, content, "utf-8");
    return outputPath;
  }
}
