# Praat — Dutch flashcards

A small, dependency-free website for learning useful, everyday Dutch phrases. Study detailed flashcards, hear browser-based Dutch pronunciation, search the phrase library, and track progress locally.

## Add a card

Edit `cards.json` and add an object with this shape:

```json
{
  "id": "unique-slug",
  "dutch": "Dutch phrase",
  "english": "English translation",
  "category": "Situation",
  "markdown": "## Main meaning\n\nExplanation with **Markdown**."
}
```

Supported Markdown includes headings, paragraphs, unordered lists, bold, and italic text.

## Run locally

Because the site fetches `cards.json`, serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Hosting

The site is deployed with GitHub Pages from the repository's `main` branch.
