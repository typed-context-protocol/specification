import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';

test('QUERY moves JSON out of the target but retains HTTP parser limits', { timeout: 10000 }, async () => {
  const received = [];
  let dispatched = 0;
  // An explicit finite header limit keeps this regression deterministic and small.
  const server = http.createServer({ maxHeaderSize: 1024 }, (req, res) => {
    dispatched++;
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ target: req.url, method: req.method, body });
      res.end('ok');
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const context = { decide: [], intent: [], observe: [], reason: [], trace: [] };
  const body = JSON.stringify({ params: [{ key: 'text', value: 'a'.repeat(8192) }], state: { context } });
  const options = { method: 'QUERY', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(5000) };
  try {
    const accepted = await fetch(`${base}/@echo`, options);
    assert.equal(accepted.status, 200);
    assert.equal(await accepted.text(), 'ok');
    assert.deepEqual(received, [{ target: '/@echo', method: 'QUERY', body }]);

    const rejected = await fetch(`${base}/@${'a'.repeat(8192)}`, { ...options, signal: AbortSignal.timeout(5000) });
    assert.equal(rejected.status, 431);
    await rejected.text();
    assert.equal(received.length, 1, 'the oversized target never reaches application dispatch');
    assert.equal(dispatched, 1, 'the HTTP parser rejects before invoking the request listener');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
