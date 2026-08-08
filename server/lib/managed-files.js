const path = require('path');

function managedNoteNames(config = {}) {
  const names = ['groups.md', 'types.md', 'collections.md'];
  for (const key of ['groupsFile', 'typesFile', 'collectionsFile', 'queriesFile']) {
    if (config[key]) names.push(path.basename(config[key]));
  }
  return new Set(names.map(name => name.toLowerCase()));
}

function isManagedNote(config, filename) {
  return managedNoteNames(config).has(String(filename).toLowerCase());
}

module.exports = { isManagedNote, managedNoteNames };
