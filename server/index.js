const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const grayMatter = require('gray-matter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SYMBOLS_DIR = path.join(__dirname, 'public', 'symbols');
const SETS_DIR = path.join(__dirname, 'public', 'sets');

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/symbols', express.static(SYMBOLS_DIR));
// app.use('/sets', express.static(SETS_DIR)); 

// Initialize folders
async function ensureFolders() {
  await fs.ensureDir(SYMBOLS_DIR);
  await fs.ensureDir(SETS_DIR);
}
ensureFolders();

// Initialize config file if it doesn't exist
const initialConfig = {
  vaultPath: '',
  imagesPath: '',
  groupsFile: '',
  typesFile: '',
  collectionsFile: '',
  typeMapping: {}
};

async function ensureConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    await fs.writeJson(CONFIG_FILE, initialConfig, { spaces: 2 });
  }
}

// --- Sets ---

app.get('/api/sets/:code/icon', async (req, res) => {
  const { code } = req.params;
  const iconPath = path.join(SETS_DIR, `${code}.svg`);

  try {
    if (await fs.pathExists(iconPath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      return res.sendFile(iconPath);
    }

    // Download from Scryfall
    const response = await axios.get(`https://api.scryfall.com/sets/${code}`);
    const svgUri = response.data.icon_svg_uri;

    if (!svgUri) {
      return res.status(404).json({ error: 'Icon not found for set' });
    }

    await downloadImage(svgUri, iconPath);
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.sendFile(iconPath);
  } catch (error) {
    console.error('Failed to fetch set icon:', error.message);
    res.status(500).json({ error: 'Failed to fetch set icon' });
  }
});

// --- Symbology ---

app.get('/api/symbols', async (req, res) => {
  try {
    const symbolsFile = path.join(SYMBOLS_DIR, 'symbols.json');
    if (await fs.pathExists(symbolsFile)) {
      const symbols = await fs.readJson(symbolsFile);
      res.json(symbols);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read symbols' });
  }
});

app.post('/api/symbols/sync', async (req, res) => {
  try {
    console.log('Received request to sync symbology from Scryfall...');
    const response = await axios.get('https://api.scryfall.com/symbology');
    console.log('Successfully fetched symbology from Scryfall.');
    
    const symbology = response.data.data;
    console.log(`Found ${symbology.length} symbols.`);

    for (const item of symbology) {
      const filename = item.symbol.replace(/[/{}]/g, '') + '.svg';
      const filepath = path.join(SYMBOLS_DIR, filename);
      
      console.log(`Processing symbol: ${item.symbol} (URI: ${item.svg_uri})`);
      // Only download if it doesn't exist or force update
      if (item.svg_uri) {
        await downloadImage(item.svg_uri, filepath);
        console.log(`Downloaded ${filename}`);
      } else {
        console.log(`No SVG URI found for ${item.symbol}`);
      }
    }

    // Save mapping to JSON
    const mapping = symbology.map(item => ({
      symbol: item.symbol,
      loose_variant: item.loose_variant,
      english: item.english,
      local_path: `/symbols/${item.symbol.replace(/[/{}]/g, '')}.svg`
    }));

    await fs.writeJson(path.join(SYMBOLS_DIR, 'symbols.json'), mapping, { spaces: 2 });
    console.log(`Successfully wrote ${mapping.length} symbol mappings to symbols.json.`);

    res.json({ message: 'Symbology synced successfully', count: mapping.length });
  } catch (error) {
    console.error('Symbology sync failed:', error.message); // Log only the message for brevity in output
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    } else if (error.request) {
      console.error('Error request:', error.request);
    } else {
      console.error('Error config:', error.config);
    }
    res.status(500).json({ error: 'Failed to sync symbology' });
  }
});

// --- Tag Helpers ---

async function readTagFile(filePath) {
  if (!filePath || !await fs.pathExists(filePath)) return [];
  const content = await fs.readFile(filePath, 'utf8');
  return content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
}

async function writeTagFile(filePath, tags) {
  if (!filePath) return;
  await fs.writeFile(filePath, tags.join('\n') + '\n', 'utf8');
}

async function appendTagIfMissing(filePath, tag) {
  if (!filePath || !tag) return;
  const tags = await readTagFile(filePath);
  if (!tags.includes(tag)) {
    tags.push(tag);
    await writeTagFile(filePath, tags);
  }
}

// --- API Endpoints ---

// Get a card image from the vault
app.get('/api/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const config = await fs.readJson(CONFIG_FILE);
    if (!config.imagesPath) {
      return res.status(400).json({ error: 'Images path not configured' });
    }
    const imgPath = path.join(config.imagesPath, filename);
    if (await fs.pathExists(imgPath)) {
      res.sendFile(imgPath);
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Get all saved cards from vault
app.get('/api/cards', async (req, res) => {
  try {
    const config = await fs.readJson(CONFIG_FILE);
    if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) {
      return res.json([]);
    }

    const files = await fs.readdir(config.vaultPath);
    const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'groups.md' && f !== 'types.md' && f !== 'collections.md');

    const cards = [];
    for (const file of mdFiles) {
      const filePath = path.join(config.vaultPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      const { data } = grayMatter(content);
      
      // Normalize groups: Prefer Groups (array), fallback to Group (string)
      let cardGroups = [];
      if (Array.isArray(data.Group)) {
        cardGroups = data.Group;
      } else if (data.Group) {
        cardGroups = [data.Group];
      }

      cards.push({
        filename: file,
        name: file.replace('.md', ''),
        ...data,
        Group: cardGroups // Always provide an array to the frontend
      });
    }

    res.json(cards);
  } catch (error) {
    console.error('Failed to list cards:', error);
    res.status(500).json({ error: 'Failed to list cards' });
  }
});

// Update a card's metadata
app.put('/api/cards/:filename', async (req, res) => {
  const { filename } = req.params;
  const { updates } = req.body;
  
  try {
    const config = await fs.readJson(CONFIG_FILE);
    const mdPath = path.join(config.vaultPath, filename);
    
    if (!await fs.pathExists(mdPath)) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const content = await fs.readFile(mdPath, 'utf8');
    const parsed = grayMatter(content);
    
    // Merge updates
    const newData = { ...parsed.data, ...updates };
    
    // Clean up old singular Group if we are using Groups plural
    if (updates.Groups && newData.Group) {
      delete newData.Group;
    }

    const newContent = grayMatter.stringify(parsed.content, newData);
    await fs.writeFile(mdPath, newContent, 'utf8');
    
    if (updates.Collection) await appendTagIfMissing(config.collectionsFile, updates.Collection);
    if (updates.Type) await appendTagIfMissing(config.typesFile, updates.Type);
    
    if (updates.Groups && Array.isArray(updates.Groups)) {
      for (const g of updates.Groups) {
        await appendTagIfMissing(config.groupsFile, g);
      }
    }

    res.json({ message: 'Card updated successfully' });
  } catch (error) {
    console.error('Failed to update card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// Delete a card
app.delete('/api/cards/:filename', async (req, res) => {
  const { filename } = req.params;
  try {
    const config = await fs.readJson(CONFIG_FILE);
    const mdPath = path.join(config.vaultPath, filename);
    
    if (!await fs.pathExists(mdPath)) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Try to find and delete the image as well
    try {
      const content = await fs.readFile(mdPath, 'utf8');
      const { data } = grayMatter(content);
      if (data.Cover) {
        const imgMatch = data.Cover.match(/\[\[(.*?)\]\]/);
        if (imgMatch && imgMatch[1]) {
          const imgPath = path.join(config.imagesPath, imgMatch[1]);
          if (await fs.pathExists(imgPath)) {
            await fs.remove(imgPath);
          }
        }
      }
    } catch (imgErr) {
      console.warn('Could not delete associated image:', imgErr.message);
    }

    await fs.remove(mdPath);
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Failed to delete card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// Rebuild the collections list from existing cards
app.post('/api/tags/rebuild', async (req, res) => {
  try {
    const config = await fs.readJson(CONFIG_FILE);
    if (!config.vaultPath || !await fs.pathExists(config.vaultPath)) {
      return res.status(400).json({ error: 'Vault path not configured' });
    }

    const files = await fs.readdir(config.vaultPath);
    const mdFiles = files.filter(f => f.endsWith('.md') && 
      f !== 'groups.md' && f !== 'types.md' && f !== 'collections.md');

    const collections = new Set();

    for (const file of mdFiles) {
      const filePath = path.join(config.vaultPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      const { data } = grayMatter(content);
      
      if (data.Collection) collections.add(data.Collection);
    }

    // Write back to collections file
    if (config.collectionsFile) {
      await writeTagFile(config.collectionsFile, Array.from(collections).sort());
    }

    res.json({ 
      message: 'Collections rebuilt successfully', 
      count: collections.size
    });
  } catch (error) {
    console.error('Failed to rebuild collections:', error);
    res.status(500).json({ error: 'Failed to rebuild collections' });
  }
});

// Get all tags
app.get('/api/tags', async (req, res) => {
  try {
    const config = await fs.readJson(CONFIG_FILE);
    const collections = await readTagFile(config.collectionsFile);
    const groups = await readTagFile(config.groupsFile);
    const types = await readTagFile(config.typesFile);
    res.json({ collections, groups, types });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read tag files' });
  }
});

// Add a tag
app.post('/api/tags/:type', async (req, res) => {
  const { type } = req.params;
  const { tag } = req.body;
  try {
    const config = await fs.readJson(CONFIG_FILE);
    let filePath;
    if (type === 'collections') filePath = config.collectionsFile;
    else if (type === 'groups') filePath = config.groupsFile;
    else if (type === 'types') filePath = config.typesFile;

    if (!filePath) return res.status(400).json({ error: `Path for ${type} not configured` });
    
    await appendTagIfMissing(filePath, tag);
    res.json({ message: `Tag added to ${type}` });
  } catch (error) {
    res.status(500).json({ error: `Failed to add tag to ${type}` });
  }
});

// Update a tag (rename)
app.put('/api/tags/:type', async (req, res) => {
  const { type } = req.params;
  const { oldTag, newTag } = req.body;
  try {
    const config = await fs.readJson(CONFIG_FILE);
    let filePath;
    if (type === 'collections') filePath = config.collectionsFile;
    else if (type === 'groups') filePath = config.groupsFile;
    else if (type === 'types') filePath = config.typesFile;

    if (!filePath) return res.status(400).json({ error: `Path for ${type} not configured` });
    
    let tags = await readTagFile(filePath);
    tags = tags.map(t => t === oldTag ? newTag : t);
    await writeTagFile(filePath, tags);
    res.json({ message: `Tag updated in ${type}` });
  } catch (error) {
    res.status(500).json({ error: `Failed to update tag in ${type}` });
  }
});

// Delete a tag
app.delete('/api/tags/:type', async (req, res) => {
  const { type } = req.params;
  const { tag } = req.body;
  try {
    const config = await fs.readJson(CONFIG_FILE);
    let filePath;
    if (type === 'collections') filePath = config.collectionsFile;
    else if (type === 'groups') filePath = config.groupsFile;
    else if (type === 'types') filePath = config.typesFile;

    if (!filePath) return res.status(400).json({ error: `Path for ${type} not configured` });
    
    let tags = await readTagFile(filePath);
    tags = tags.filter(t => t !== tag);
    await writeTagFile(filePath, tags);
    res.json({ message: `Tag deleted from ${type}` });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete tag from ${type}` });
  }
});

// Get current configuration
app.get('/api/config', async (req, res) => {
  try {
    await ensureConfig();
    const config = await fs.readJson(CONFIG_FILE);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// Update configuration
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    await fs.writeJson(CONFIG_FILE, newConfig, { spaces: 2 });
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Helper: Download Image
async function downloadImage(url, filepath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  return new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(filepath))
      .on('error', reject)
      .on('finish', () => resolve());
  });
}

// Save Card
app.post('/api/cards/save', async (req, res) => {
  try {
    const { card, groups, collection: customCollection, type: customType } = req.body;
    const config = await fs.readJson(CONFIG_FILE);

    if (!config.vaultPath || !config.imagesPath) {
      return res.status(400).json({ error: 'Vault path or Images path not configured' });
    }

    // 1. Prepare Data
    const filename = card.name;
    const clearName = card.name
      .replace(/[<>:"/\\|?*#%&{}'@!`~$+(),]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const cardNumber = card.collector_number;
    const imgFilename = `${card.set}-${cardNumber}-${clearName}.jpg`;
    
    // Collection Name: custom override or automated set_name (set_code)
    const collectionName = customCollection || `${card.set_name} (${card.set.toUpperCase()})`;

    // Type: custom override or automated translation
    let cardType = customType;
    if (!cardType) {
      cardType = card.type_line;
      if (config.typeMapping) {
        const parts = card.type_line.split(/[—\s]+/);
        const translatedParts = parts.map(part => config.typeMapping[part] || part);
        cardType = translatedParts.join(' ');
      }
    }

    // 2. Update Tag Files
    await appendTagIfMissing(config.collectionsFile, collectionName);
    if (groups && Array.isArray(groups)) {
      for (const g of groups) {
        await appendTagIfMissing(config.groupsFile, g);
      }
    }
    // Also append the custom type if it's new
    if (customType) {
      await appendTagIfMissing(config.typesFile, customType);
    }

    // 3. Download Image
    const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
    if (imgUrl) {
      const imgPath = path.join(config.imagesPath, imgFilename);
      await downloadImage(imgUrl, imgPath);
    }

    // 4. Generate Markdown with gray-matter for clean YAML
    const frontmatter = {
      Collection: collectionName,
      Type: cardType,
      Number: cardNumber,
      Group: groups || [],
      Cover: `[[${imgFilename}]]`
    };

    const content = card.oracle_text || '';
    const mdContent = grayMatter.stringify(content, frontmatter);

    // 5. Save to Vault
    const mdPath = path.join(config.vaultPath, `${filename}.md`);
    await fs.writeFile(mdPath, mdContent, 'utf8');

    res.json({ message: `Card ${card.name} saved successfully`, filename: `${filename}.md` });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ error: 'Failed to save card' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MTG Card Manager Server is running' });
});

app.listen(PORT, async () => {
  await ensureConfig();
  console.log(`Server is running on http://localhost:${PORT}`);
});
