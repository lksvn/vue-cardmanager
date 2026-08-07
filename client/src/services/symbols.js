import { apiAssetUrl, serverService } from './server';

let symbolsMap = null;

export const symbolService = {
  async loadSymbols() {
    try {
      const symbols = await serverService.getSymbols();
      if (symbols && symbols.length > 0) {
        symbolsMap = new Map(symbols.map(s => [s.symbol, s.local_path]));
      }
    } catch (error) {
      console.error('Failed to load symbols map:', error);
    }
  },

  replaceSymbols(text) {
    if (!text) return '';
    if (!symbolsMap) return text;

    // Matches symbols like {T}, {W}, {2/B}, {10}, etc.
    return text.replace(/\{([^{}]+)\}/g, (match) => {
      const localPath = symbolsMap.get(match);
      if (localPath) {
        return `<img src="${apiAssetUrl(localPath)}" class="ms ms-cost" alt="${match}" style="height: 0.9em; vertical-align: middle; margin: 0 1px;" />`;
      }
      return match;
    });
  },

  tokenize(text) {
    if (!text) return [];
    const tokens = [];
    let cursor = 0;
    for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
      if (match.index > cursor) tokens.push({ type: 'text', value: text.slice(cursor, match.index) });
      const localPath = symbolsMap?.get(match[0]);
      tokens.push(localPath
        ? { type: 'symbol', value: match[0], src: apiAssetUrl(localPath) }
        : { type: 'text', value: match[0] });
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) tokens.push({ type: 'text', value: text.slice(cursor) });
    return tokens;
  }
};
