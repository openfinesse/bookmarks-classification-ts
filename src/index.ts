import { readFileSync, writeFileSync } from 'fs';
import { BookmarkParser } from './services/parser.service';
import { AIService } from './services/ai.service';
import { BookmarkGenerator } from './services/generator.service';
import { defaultConfig } from './config/config';
import type { Bookmark } from './types/bookmark.types';

async function main() {
    // Validate configuration
    if (!defaultConfig.openaiApiKey) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    try {
        // Initialize services
        const parser = new BookmarkParser();
        const ai = new AIService(defaultConfig.openaiApiKey);
        const generator = new BookmarkGenerator();

        // Read and parse input file
        console.log('Reading bookmark file...');
        const htmlContent = readFileSync(defaultConfig.inputFile, 'utf-8');
        const bookmarkTree = parser.parseHtmlFile(htmlContent);

        // Collect all bookmarks for classification
        const allBookmarks: Bookmark[] = [];
        const collectBookmarks = (bookmarks: Bookmark[]) => {
            allBookmarks.push(...bookmarks);
        };

        const processFolder = (folder: any) => {
            collectBookmarks(folder.bookmarks);
            folder.subFolders.forEach(processFolder);
        };

        processFolder(bookmarkTree.root);

        // Classify bookmarks
        console.log(`Classifying ${allBookmarks.length} bookmarks...`);
        const classifications = await ai.classifyBookmarks(allBookmarks);

        // Create classification map
        const classificationMap = new Map(
            classifications.map(c => [
                c.url,
                { tags: c.suggestedTags, folder: c.suggestedFolder }
            ])
        );

        // Reorganize bookmarks
        console.log('Reorganizing bookmarks...');
        const reorganizedTree = generator.reorganizeBookmarks(bookmarkTree, classificationMap);

        // Generate new HTML file
        console.log('Generating new bookmark file...');
        const newHtmlContent = generator.generateHtmlFile(reorganizedTree);
        writeFileSync(defaultConfig.outputFile, newHtmlContent, 'utf-8');

        console.log(`Done! New bookmark file created at ${defaultConfig.outputFile}`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();