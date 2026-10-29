'use strict';

/**
 * Check the Buffer connection before trusting it with a real article.
 *
 * Lists every channel the API key can see and says which ones the announcer
 * will post to. With --draft it also builds the posts for the most recently
 * published article and saves them in Buffer as DRAFTS: each network's rules
 * are checked, nothing goes public. Delete the drafts in Buffer afterwards.
 *
 * Usage:
 *   railway run --service backend node scripts/buffer-check.js [--draft]
 *
 * Railway injects BUFFER_API_KEY and FRONTEND_URL, so the key never has to be
 * pasted anywhere. The article is read from the public API rather than the
 * database, so this runs from any machine.
 */

require('dotenv').config();

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

(async () => {
  const draft = process.argv.includes('--draft');
  const api = (arg('api') || 'https://api.al-telegraph.com/api/v1').replace(/\/$/, '');

  const { isConfigured, listChannels, createPost, NETWORKS, articleUrl } =
    require('../src/services/bufferService');
  if (!isConfigured()) {
    console.error('BUFFER_API_KEY not set — nothing to check.');
    process.exit(1);
  }

  const channels = await listChannels();
  console.log(`${channels.length} channel(s) on this Buffer account:\n`);

  const usable = [];
  for (const channel of channels) {
    const network = NETWORKS[channel.service];
    let note;
    if (!network) note = 'not used — the announcer only posts to X, Facebook and Instagram';
    else if (channel.isDisconnected) note = 'DISCONNECTED — reconnect it in Buffer';
    else if (channel.isLocked) note = 'LOCKED — over the plan\'s channel limit';
    else {
      note = `→ ${network.label}`;
      usable.push(channel);
    }
    console.log(`  ${usable.includes(channel) ? '✓' : '·'} ${channel.service.padEnd(10)} ${channel.name}  ${note}`);
    if (network && channel.linkShortening?.isEnabled) {
      console.log('      link shortening is ON — posts will show a buff.ly link instead of al-telegraph.com;');
      console.log('      turn it off in this channel\'s settings in Buffer');
    }
  }

  const missing = Object.entries(NETWORKS)
    .filter(([service]) => !usable.some((c) => c.service === service))
    .map(([, network]) => network.label);
  if (missing.length) console.log(`\nNot connected: ${missing.join(', ')} — those will be skipped.`);

  if (!draft) {
    console.log('\nRun again with --draft to save a test post on each channel as a Buffer draft.');
    return;
  }

  const res = await fetch(`${api}/articles?limit=1`);
  const body = await res.json();
  const article = body.data?.[0];
  if (!article) throw new Error(`no published article came back from ${api}/articles`);

  const link = articleUrl(article);
  console.log(`\nSaving drafts for «${article.title}»\n  ${link}\n`);

  let failed = 0;
  for (const channel of usable) {
    const network = NETWORKS[channel.service];
    const payload = network.build(article, link);
    if (!payload) {
      console.log(`  · ${network.label}: skipped — this article has no cover picture`);
      continue;
    }
    try {
      const post = await createPost(channel.id, payload, { draft: true });
      console.log(`  ✓ ${network.label}: draft saved (${post.status})`);
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${network.label}: ${err.message}`);
    }
  }

  console.log(failed
    ? `\n${failed} channel(s) refused the post — fix those before relying on it.`
    : '\nAll accepted. Look them over in Buffer, then delete the drafts.');
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
