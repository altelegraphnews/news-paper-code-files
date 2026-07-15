'use strict';
// Renders every article's HTML with placeholder image URLs, for inspection.
const fs = require('fs');
const path = require('path');
const { ARTICLES, AUTHORS, buildHtml } = require('./content');

const urlFor = (key) => `https://IMG/${key}`;
let out = '';
for (const a of ARTICLES) {
  const html = buildHtml(a, urlFor);
  out += `\n\n${'='.repeat(90)}\n[${a.category}] ${a.title}\n  author: ${AUTHORS[a.author].name} | type: ${a.type} | hero: ${a.hero}\n  html length: ${html.length}\n${'-'.repeat(90)}\n${html}\n`;
}
const dest = path.join(__dirname, 'dry-run-output.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('wrote', dest, '(', out.length, 'chars )');
