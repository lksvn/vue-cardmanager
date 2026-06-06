import { serverService } from './server';

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
        return `<img src="http://localhost:3001${localPath}" class="ms ms-cost" alt="${match}" style="height: 0.9em; vertical-align: middle; margin: 0 1px;" />`;
      }
      return match;
    });
  }
};
