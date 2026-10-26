import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const { rules } = JSON.parse(html.match(/^const data = (\{[\s\S]*?\n\});/m)[1]);
const details = rules.find(rule => rule.id === 12).details;
const snippet = [...details.matchAll(/```js\n([\s\S]*?)\n```/g)]
  .map(match => match[1]).find(code => code.includes('function contains('));
assert.ok(snippet, 'the shared primitive must publish its reference example');
const contains = vm.runInNewContext(`${snippet}\ncontains;`, Object.create(null));

const vectors = [
  ['published example', 'see you yesterday', 'yesterday', true],
  ['substring rather than token', 'yesterdayish', 'yesterday', true],
  ['case remains significant', 'Yesterday', 'yesterday', false],
  ['no Unicode normalization', 'e\u0301', '\u00e9', false],
  ['empty word', 'text', '', true],
  ['both empty', '', '', true],
  ['nonempty word in empty observation', '', 'x', false],
  ['astral character', 'hi \u{1F41C}', '\u{1F41C}', true],
  ['literal punctuation rather than regexp', 'abc', '.*', false],
];

for (const [name, observed, word, expected] of vectors) {
  test(name, () => {
    const state = Object.freeze({ context: Object.freeze(Object.fromEntries(
      ['decide', 'intent', 'observe', 'reason', 'trace'].map(key => [key, Object.freeze([])]),
    )) });
    const params = Object.freeze([
      Object.freeze({ key: 'observed', value: observed }),
      Object.freeze({ key: 'word', value: word }),
    ]);
    const result = contains({ params, state });
    assert.equal(result.params.length, 1);
    assert.equal(result.params[0].key, 'result');
    assert.equal(result.params[0].value, expected);
    assert.equal(result.state, state, 'the primitive passes state through unchanged');
  });
}

const invalid = [
  ['missing inputs', []],
  ['missing word', [{ key: 'observed', value: 'today' }]],
  ['duplicate observed', [{ key: 'observed', value: 'today' }, { key: 'observed', value: 'yesterday' }]],
  ['extra parameter', [{ key: 'observed', value: 'today' }, { key: 'word', value: 'today' }, { key: 'extra', value: true }]],
  ['number observation', [{ key: 'observed', value: 123 }, { key: 'word', value: '123' }]],
  ['null word', [{ key: 'observed', value: 'today' }, { key: 'word', value: null }]],
  ['reversed inputs', [{ key: 'word', value: 'today' }, { key: 'observed', value: 'today' }]],
];

for (const [name, params] of invalid) {
  test(`invalid input: ${name}`, () => {
    const state = { context: { decide: [], intent: [], observe: [], reason: [], trace: [] } };
    assert.throws(() => contains({ params, state }), /observed and word strings in order/);
  });
}
