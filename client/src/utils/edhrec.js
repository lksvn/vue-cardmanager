export function edhrecCommanderUrl(cardOrName) {
  const name = typeof cardOrName === 'string' ? cardOrName : cardOrName?.name || cardOrName?.Name || '';
  return `https://edhrec.com/route/?${new URLSearchParams({ cc: name })}`;
}

export function isCreatureCard(card) {
  const types = [card?.type_line, card?.Type, ...(card?.card_faces || []).map(face => face.type_line)];
  return types.some(type => /\bCreature\b/i.test(type || ''));
}
