import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const { rules } = JSON.parse(html.match(/^const data = (\{[\s\S]*?\n\});/m)[1]);
const rule = rules.find(rule => rule.id === 12);
const snippet = [...`${rule.rule}\n${rule.details}`.matchAll(/```js\n([\s\S]*?)\n```/g)]
  .map(match => match[1]).find(code => code.includes('function bindObserved('));
assert.ok(snippet, 'rule 12 must publish the observation-binding reference example');
const bindObserved = vm.runInNewContext(`${snippet}\nbindObserved;`, Object.create(null));

test('the former ambiguous parameter array selects opposite branches', () => {
  const params = [{ key: 'observed', value: 'today' }, { key: 'observed', value: 'yesterday' }];
  assert.equal(params.find(param => param.key === 'observed').value.includes('yesterday'), false);
  assert.equal(Object.fromEntries(params.map(({ key, value }) => [key, value])).observed.includes('yesterday'), true);
});

test('the published binding rejects template observations before invoking a trigger', () => {
  for (const params of [
    [{ key: 'observed', value: 'yesterday' }],
    [{ key: 'word', value: 'yesterday' }, { key: 'observed', value: null }],
  ]) {
    const before = JSON.stringify(params);
    assert.throws(() => bindObserved('today', params), /reserved for the sensor/);
    assert.equal(JSON.stringify(params), before);
  }
});

test('the binding preserves actual JSON values and ordered template entries', () => {
  const observed = { reading: 0 };
  const params = Object.freeze([
    Object.freeze({ key: 'word', value: 'x' }),
    Object.freeze({ key: 'other', value: 1 }),
    Object.freeze({ key: 'other', value: 2 }),
  ]);
  const result = bindObserved(observed, params);
  assert.equal(result[0].key, 'observed');
  assert.equal(result[0].value, observed);
  assert.equal(result.length, 4);
  for (let i = 0; i < params.length; i++) assert.equal(result[i + 1], params[i]);
  assert.notEqual(result, params);
  assert.equal(params.length, 3);
});

test('an empty template receives exactly one actual observation', () => {
  const result = bindObserved(false, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, 'observed');
  assert.equal(result[0].value, false);
});
