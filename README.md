# Praat — Dutch flashcards

A small, dependency-free website for learning useful, everyday Dutch. It mixes Dutch recognition, English-to-Dutch production, sentence building, and grammar recall. Rate every review as easy, medium, or hard; harder cards return more often.

## Add a card

Edit `cards.json` and add an object with this shape:

```json
{
  "id": "unique-slug",
  "dutch": "Dutch phrase",
  "english": "English translation",
  "category": "Situation",
  "markdown": "## Main meaning\n\nExplanation with **Markdown**.",
  "direction": "nl-en",
  "sources": [{ "type": "manual" }]
}
```

For active production, set `direction` to `en-nl` and add an English `front`. For rule recall, use `concept`. IDs are immutable because browser progress is keyed by card ID.

Supported Markdown includes headings, paragraphs, unordered lists, bold, and italic text.

`notion-sync.json` records the Notion source pages and imported card IDs. Notion remains the writing source; the sync manifest is bookkeeping for later delta imports.

## Run locally

Because the site fetches `cards.json`, serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Hosting

The site is deployed with GitHub Pages from the repository's `main` branch.
