import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dataMatch = html.match(/^const data = (\{[\s\S]*?\n\});/m);
assert.ok(dataMatch, 'embedded rules must be present');
const { rules } = JSON.parse(dataMatch[1]);
const metadataScript = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => /^const meta = /m.test(script));
assert.ok(metadataScript, 'publication metadata must be present');
const metadata = vm.runInNewContext(`${metadataScript}\nmeta;`, Object.create(null));
const sharedNames = rules.find(rule => rule.id === 26);
const prefix = sharedNames.details.match(/`([^`]+\/rule\/)<id>`/)?.[1];
assert.equal(prefix, 'tcxp:/tcxp/rule/');

function checkDeclarations(meta) {
  assert.ok(meta.sotd.includes(`\`${prefix}<id>\``), 'status must use the reserved shared rule identity');
  assert.ok(meta.conformance.includes(`\`${prefix}\``), 'conformance must use the reserved shared rule namespace');
  assert.ok(!/tcxp:\/\/[^\s`]+\/rule\//.test(`${meta.sotd}\n${meta.conformance}`),
    'a network locator must not replace the virtual shared identifier');
}

test('publication metadata uses the rule identity reserved by rule 26', () => {
  checkDeclarations(metadata);
  assert.ok(metadata.sotd.includes('`#rule-N`'), 'document fragment links remain available');
});

test('the consistency gate rejects the former network identity', () => {
  const conflicting = {
    sotd: metadata.sotd.replace(`${prefix}<id>`, 'tcxp://tcxp.org/rule/N'),
    conformance: metadata.conformance.replace(prefix, 'tcxp://tcxp.org/rule/'),
  };
  assert.throws(() => checkDeclarations(conflicting), /reserved shared rule identity/);
});
