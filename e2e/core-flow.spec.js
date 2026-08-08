const { test, expect } = require('@playwright/test');

test('saved query, search, save, edit, filter, and delete lifecycle', async ({ page }) => {
  const searchCard = {
    id: '11111111-1111-4111-8111-111111111111',
    oracle_id: '22222222-2222-4222-8222-222222222222',
    name: 'Yawgmoth, Thran Physician',
    set: 'mh1',
    set_name: 'Modern Horizons',
    collector_number: '116',
    type_line: 'Legendary Creature — Human Cleric',
    oracle_text: 'Protection from Humans',
    layout: 'normal',
    rarity: 'mythic',
    image_uris: { large: 'https://images.example/yawgmoth.jpg' }
  };
  let savedCards = [];
  let savedQueries = [];

  await page.route('https://api.scryfall.com/cards/search**', route => route.fulfill({
    json: { object: 'list', total_cards: 1, has_more: false, data: [searchCard] }
  }));
  await page.route('https://images.example/**', route => route.fulfill({
    status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88" />'
  }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/tags') return route.fulfill({ json: { collections: [], groups: ['Commander'], types: ['Artifact', 'Creature'] } });
    if (pathname === '/api/queries' && request.method() === 'GET') return route.fulfill({ json: { queries: savedQueries } });
    if (pathname === '/api/queries' && request.method() === 'POST') {
      const { name, query } = request.postDataJSON();
      savedQueries.push({ name, query });
      return route.fulfill({ status: 201, json: { query: { name, query }, replaced: false } });
    }
    if (pathname.startsWith('/api/queries/') && request.method() === 'DELETE') {
      const name = decodeURIComponent(pathname.slice('/api/queries/'.length));
      savedQueries = savedQueries.filter(item => item.name.toLowerCase() !== name.toLowerCase());
      return route.fulfill({ json: { query: { name } } });
    }
    if (pathname === '/api/symbols') return route.fulfill({ json: [] });
    if (pathname === '/api/cards' && request.method() === 'GET') return route.fulfill({ json: savedCards });
    if (pathname === '/api/cards/save') {
      savedCards = [
        { filename: 'yawgmoth.md', name: searchCard.name, Name: searchCard.name, ScryfallId: searchCard.id, OracleId: searchCard.oracle_id, SetCode: 'MH1', CollectorNumber: '116', Collection: 'Modern Horizons (MH1)', Type: 'Creature', Groups: [], Group: [] },
        { filename: 'sol-ring.md', name: 'Sol Ring', Name: 'Sol Ring', SetCode: 'CMM', CollectorNumber: '396', Collection: 'Commander Masters (CMM)', Type: 'Artifact', Groups: [], Group: [] }
      ];
      return route.fulfill({ status: 200, json: { message: 'Card saved', filename: 'yawgmoth.md', scryfallId: searchCard.id } });
    }
    if (pathname === '/api/cards/sol-ring.md' && request.method() === 'PUT') {
      const updates = request.postDataJSON().updates;
      savedCards = savedCards.map(card => card.filename === 'sol-ring.md'
        ? { ...card, ...updates, Groups: updates.Groups, Group: updates.Groups }
        : card);
      return route.fulfill({ json: { message: 'Card updated successfully' } });
    }
    if (pathname === '/api/cards/sol-ring.md' && request.method() === 'DELETE') {
      savedCards = savedCards.filter(card => card.filename !== 'sol-ring.md');
      return route.fulfill({ json: { message: 'Card deleted successfully' } });
    }
    if (pathname.includes('/api/sets/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" />' });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_MOCKED', message: pathname } } });
  });

  await page.goto('/search');
  await page.getByPlaceholder('Search for cards').fill('Yawgmoth');
  await page.getByRole('button', { name: 'Save query' }).click();
  await page.getByPlaceholder('Query name').fill('Yawgmoth Search');
  await page.locator('.save-query-form').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Query "Yawgmoth Search" saved.')).toBeVisible();
  await page.getByLabel('Saved queries').selectOption({ label: 'Yawgmoth Search' });
  await expect(page.getByText('1 card found')).toBeVisible();
  await page.getByRole('button', { name: 'Delete query' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Query "Yawgmoth Search" deleted.')).toBeVisible();
  await page.getByRole('button', { name: 'Quick add' }).click();
  await expect(page.getByText('Yawgmoth, Thran Physician added to the collection.')).toBeVisible();

  await page.getByRole('link', { name: 'Collections' }).click();
  await expect(page.getByRole('heading', { name: 'My Collection (2)' })).toBeVisible();
  await page.getByPlaceholder('Card name...').fill('Sol Ring');
  await expect(page.locator('.saved-card-item')).toHaveCount(1);
  await expect(page.locator('.saved-card-item')).toContainText('Sol Ring');
  await page.getByTitle('Edit metadata').click();
  await page.getByLabel('Commander').check();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('.saved-card-item .tag')).toHaveText('Commander');
  await page.getByTitle('Delete from vault').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('No cards match your filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.saved-card-item')).toHaveCount(1);
  await expect(page.locator('.saved-card-item')).toContainText('Yawgmoth, Thran Physician');
});
