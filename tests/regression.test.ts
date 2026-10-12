import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCondition, validateSessionQuality, validateSessionEndReason } from '../src/utils/formatters';

test('validators retain valid and invalid branches after type narrowing repair', () => {
  const condition = { energy: 'HIGH', focus: 'DEEP', location: 'HOME', environment: 'QUIET' };
  assert.deepEqual(validateCondition(condition), { valid: true, value: condition });
  assert.equal(validateCondition({ ...condition, energy: 'INVALID' }).valid, false);
  for (const quality of ['POOR', 'FAIR', 'GOOD', 'EXCELLENT', null]) {
    assert.equal(validateSessionQuality(quality).valid, true);
  }
  assert.equal(validateSessionQuality('NORMAL').valid, false);
  assert.equal(validateSessionEndReason('NATURAL_COMPLETION').valid, true);
  assert.equal(validateSessionEndReason('INVALID').valid, false);
});

test('explicit data override isolates credentials and storage; round trip preserves synthetic evidence', async () => {
  const previous = process.env.PIST_DATA_DIR;
  const directory = path.resolve('.private/test-runs', randomUUID());
  process.env.PIST_DATA_DIR = directory;
  try {
    // Import only after isolation is established; never read original data.
    const storage = await import('../server/storage');
    const auth = await import('../server/auth');
    assert.equal(storage.getCanonicalStoragePath(), path.join(directory, 'pist_data.json'));
    const data = storage.readAppData();
    assert.equal(data.journeys.length, 0);
    data.journeys.push({ id: 'synthetic-thing', name: 'Synthetic baseline', status: 'ACTIVE',
      owner_id: 'test-owner', visibility: 'PRIVATE', created_at: '2026-10-11T00:00:00Z' });
    storage.appendEvent(data, { entity_type: 'Journey', entity_id: 'synthetic-thing', event_type: 'JOURNEY_CREATED', payload: { synthetic: true } });
    storage.writeAppData(data);
    const reloaded = storage.readAppData();
    assert.deepEqual(reloaded.journeys, data.journeys);
    assert.deepEqual(reloaded.event_log, data.event_log);
    const beforeCredentials = fs.readFileSync(storage.getCanonicalStoragePath());
    auth.writeUsers({ users: [{ username: 'synthetic', password_hash: 'test-only', created_at: '2026-10-11T00:00:00Z' }] });
    assert.equal(auth.readUsers().users[0].username, 'synthetic');
    assert.equal(fs.existsSync(path.join(directory, 'users.json')), true);
    assert.deepEqual(fs.readFileSync(storage.getCanonicalStoragePath()), beforeCredentials);
  } finally {
    if (previous === undefined) delete process.env.PIST_DATA_DIR;
    else process.env.PIST_DATA_DIR = previous;
  }
});
