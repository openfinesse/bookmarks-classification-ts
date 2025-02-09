export interface Config {
    openaiApiKey: string;
    inputFile: string;
    outputFile: string;
}

export const defaultConfig: Config = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    inputFile: process.env.INPUT_FILE || 'bookmarks.html',
    outputFile: process.env.OUTPUT_FILE || 'bookmarks_organized.html'
}; 