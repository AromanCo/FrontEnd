import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fixtureConceptId,
  fixtureMobile,
  fixtureOtp,
  installGuidedSaveFixture,
  notes,
  sameConceptRecord,
} from '../scripts/guided-save-fixture.mjs';

test('two authenticated valid creates produce distinct records and both remain readable', async () => {
  let handleRoute;
  const context = {
    async route(pattern, handler) {
      assert.equal(pattern, '**/api/v1/**');
      handleRoute = handler;
    },
  };
  const fixture = await installGuidedSaveFixture(context);
  let cookie = '';
  const send = async (method, path, body, csrf = '') => {
    let response;
    const request = {
      url: () => `http://localhost:8000/api/v1/${path}`,
      method: () => method,
      headers: () => ({ cookie, origin: 'http://localhost:3000', 'x-csrf-token': csrf }),
      postDataJSON: () => body,
    };
    await handleRoute({ request: () => request, fulfill: async value => { response = value; } });
    assert.ok(response, `${method} ${path} should be fulfilled`);
    if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].split(';')[0];
    return { status: response.status, body: JSON.parse(response.body) };
  };

  assert.equal((await send('POST', 'auth/challenges', { mobile: fixtureMobile })).status, 202);
  const verification = await send('POST', 'auth/verify', { mobile: fixtureMobile, code: fixtureOtp });
  assert.equal(verification.status, 200);
  const payload = { name: 'Synthetic repeated create', notes: [{ note_id: notes[0].id, layer: 'top', position: 0 }] };
  const first = await send('POST', 'fragrance-concepts', payload, verification.body.csrf_token);
  const second = await send('POST', 'fragrance-concepts', payload, verification.body.csrf_token);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.body.id, fixtureConceptId);
  assert.notEqual(second.body.id, first.body.id);
  assert.deepEqual(second.body.name, first.body.name);
  assert.deepEqual(second.body.notes, first.body.notes);
  assert.equal(fixture.conceptCreates, 2);
  assert.equal(fixture.successfulConceptCreates, 2);
  assert.equal(fixture.savedConcepts.length, 2);

  const list = await send('GET', 'fragrance-concepts');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
  assert.deepEqual(new Set(list.body.map(concept => concept.id)), new Set([first.body.id, second.body.id]));
  for (const created of [first.body, second.body]) {
    const reopened = await send('GET', `fragrance-concepts/${created.id}`);
    assert.equal(reopened.status, 200);
    assert.equal(sameConceptRecord(reopened.body, created), true);
  }
  assert.equal((await send('GET', 'fragrance-concepts/missing')).status, 404);
  assert.deepEqual(fixture.unexpectedApiCalls, []);
});
