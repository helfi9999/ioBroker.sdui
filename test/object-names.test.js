'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {updateObjectName} = require('../lib/object-names');

test('updates outdated name with minimal patch', async () => {
  const existing = {
    common: {
      name: 'Fach',
      custom: {
        history: {enabled: true}
      }
    },
    native: {example: true}
  };

  let calls = 0;

  const adapter = {
    async extendObjectAsync(id, patch) {
      calls++;
      assert.equal(id, 'test.subject');
      assert.deepEqual(patch, {
        common: {name: 'Subject'}
      });
    }
  };

  const changed = await updateObjectName(
    adapter,
    'test.subject',
    existing,
    'Subject'
  );

  assert.equal(changed, true);
  assert.equal(calls, 1);
  assert.deepEqual(existing.common.custom, {
    history: {enabled: true}
  });
  assert.deepEqual(existing.native, {example: true});
});

test('skips already correct names', async () => {
  const adapter = {
    async extendObjectAsync() {
      assert.fail('Unexpected update');
    }
  };

  const changed = await updateObjectName(
    adapter,
    'test.subject',
    {common: {name: 'Subject'}},
    'Subject'
  );

  assert.equal(changed, false);
});

test('skips missing objects', async () => {
  const adapter = {
    async extendObjectAsync() {
      assert.fail('Unexpected update');
    }
  };

  const changed = await updateObjectName(
    adapter,
    'test.subject',
    null,
    'Subject'
  );

  assert.equal(changed, false);
});
