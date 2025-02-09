# Bookmark Organizer

A TypeScript tool that uses AI to automatically organize and classify your browser bookmarks.

## Features

- Supports Chrome and Firefox bookmarks
- OpenAI & DeepSeek model supported
- Automatically creates meaningful folder structures
- Adds relevant tags to bookmarks
- Preserves original bookmark metadata

## Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd bookmarks-classification-ts

# Install dependencies
bun install
```

## Usage

1. Export your bookmarks from Chrome or Firefox as HTML
2. Place the exported HTML file(s) in the `data` folder
3. Run the organizer using one of these methods:

```bash
# Using environment variable (OpenAI or DeepSeek)
export OPENAI_API_KEY='your-api-key'
bun run organize

# Or directly with the command
bun run organize --api-key 'your-api-key'

# Specify browser (chrome is default)
bun run organize --browser firefox

# Use all options
bun run organize --api-key 'your-api-key' --browser chrome
```

The organized bookmarks will be saved in `data/output` with a timestamp in the filename.

## Requirements

- Bun runtime
- OpenAI API key or DeepSeek API key
- Chrome or Firefox bookmarks exported as HTML
