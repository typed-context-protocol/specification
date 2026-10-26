import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const match = source.match(/^const data = (\{[\s\S]*?\n\});/m);
assert.ok(match, 'the specification must contain its rule data');
const { rules } = JSON.parse(match[1]);

// This checks published examples, not a production tcxp parser or native resolver.
function checkExample(address) {
  const path = address.split('?')[0];
  const ground = path.match(/^tcxp:(\/{1,3})/);
  assert.ok(ground, `missing ground: ${address}`);
  const segments = path.slice(ground[0].length).split('/');
  for (const [index, segment] of segments.entries()) {
    const name = index === 1 && segment.startsWith('@') ? segment.slice(1) : segment;
    const decoded = decodeURIComponent(name);
    assert.notEqual(decoded, '.', `dot segment: ${address}`);
    assert.notEqual(decoded, '..', `dot segment: ${address}`);
    if (ground[1] === '///') {
      assert.ok(!decoded.includes('/'), `local separator: ${address}`);
      assert.ok(!decoded.includes('\0'), `local NUL: ${address}`);
    }
  }
}

test('concrete address examples preserve component boundaries', () => {
  let checked = 0;
  for (const rule of rules) {
    for (const [, code] of `${rule.rule}\n${rule.details}`.matchAll(/`([^`\n]+)`/g)) {
      // Namespace prefixes, template addresses and ellipses are not complete examples.
      if (!/^tcxp:\/{1,3}/.test(code) || /[<>…]/.test(code) || code.endsWith('/')) continue;
      checkExample(code);
      checked++;
    }
  }
  assert.ok(checked >= 20, `expected a useful example corpus, checked ${checked}`);
});

test('the example check rejects literal and encoded dot segments', () => {
  for (const name of ['.', '..', '%2e', '%2E%2E', '.%2e', '%2e.']) {
    assert.throws(() => checkExample(`tcxp://example.com/@safe/${name}/admin`), /dot segment/);
  }
  checkExample('tcxp://example.com/@safe/release..txt');
});

test('the example check rejects local separators and NUL, with one decoding pass', () => {
  assert.throws(() => checkExample('tcxp:///reports/Q3%2FQ4%20summary'), /local separator/);
  assert.throws(() => checkExample('tcxp:///reports/name%00.txt'), /local NUL/);
  checkExample('tcxp:///reports/Q3%20summary');
  checkExample('tcxp:///reports/literal%252F.txt');
  checkExample('tcxp:/reports/Q3%2FQ4%20summary');
});

test('HTTPS normalization changes admitted dot-segment paths', () => {
  for (const name of ['..', '%2E%2E', '.%2e']) {
    assert.equal(new URL(`https://example.com/@safe/${name}/admin`).pathname, '/admin');
  }
  assert.equal(new URL('https://example.com/@safe/child').pathname, '/@safe/child');
});

test('native file URL conversion cannot represent the old single-component example', () => {
  assert.throws(() => fileURLToPath('file:///reports/Q3%2FQ4%20summary'), { code: 'ERR_INVALID_FILE_URL_PATH' });
  assert.ok(fileURLToPath('file:///reports/Q3%20summary').endsWith('Q3 summary'));
});
