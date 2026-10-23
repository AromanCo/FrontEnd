import { randomBytes } from 'node:crypto';
import { frontendOrigin } from './browser-utils.mjs';

// Synthetic DTO-shaped fixtures only; this in-memory API is not FastAPI data.
const testApiBase = (process.env.NEXT_PUBLIC_AROMAN_API_BASE_URL || process.env.AROMAN_BROWSER_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');
export const apiOrigin = new URL(testApiBase).origin;
export const fixtureMobile = '09121234567';
export const fixtureMobileE164 = '+989121234567';
export const fixtureOtp = '654321';
export const fixtureConceptId = '00000000-0000-4000-8000-000000000901';
export const syntheticFixtureLabel = 'Synthetic Guided journey fixture; not a real catalog.';
export const layerOrder = ['top', 'heart', 'base'];
export const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

export const families = [
  ['floral', 'گلی'], ['citrus', 'مرکباتی'], ['woody', 'چوبی'],
  ['amber', 'کهربایی'], ['fresh', 'تازه'], ['gourmand', 'خوراکی'],
].map(([slug, name], index) => ({
  id: uuid(index + 1), slug, name,
  description: `دادهٔ ساختگی آزمون برای خانوادهٔ ${name}`,
  is_demo: true,
}));

export const notes = [
  ['rose', 'رز', 1], ['jasmine', 'یاس', 1],
  ['bergamot', 'ترنج', 2], ['lemon', 'لیمو', 2],
  ['cedar', 'سدر', 3], ['sandalwood', 'چوب صندل', 3],
  ['amber', 'کهربا', 4], ['vanilla', 'وانیل', 4],
  ['mint', 'نعناع', 5], ['green-tea', 'چای سبز', 5],
  ['cocoa', 'کاکائو', 6], ['coffee', 'قهوه', 6],
].map(([slug, name, familyNumber], index) => ({
  id: uuid(index + 100), slug, name,
  description: `دادهٔ ساختگی آزمون برای نت ${name}`,
  is_demo: true, family_id: uuid(familyNumber),
}));

export const fixtureUserId = '00000000-0000-4000-8000-000000000304';
export const fixtureUser = { id: fixtureUserId, mobile_e164: fixtureMobileE164, role: 'customer' };

export function normalizedSelections(selections) {
  return [...selections].sort((left, right) =>
    layerOrder.indexOf(left.layer) - layerOrder.indexOf(right.layer) || left.position - right.position,
  );
}

function hasExactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

export function isValidConceptPayload(payload) {
  if (!hasExactKeys(payload, ['name', 'notes']) || typeof payload.name !== 'string' ||
      !payload.name.trim() || !Array.isArray(payload.notes) || payload.notes.length < 1 ||
      payload.notes.length > 6) return false;
  const ids = new Set();
  const positionsByLayer = new Map(layerOrder.map(layer => [layer, []]));
  for (const selection of payload.notes) {
    if (!hasExactKeys(selection, ['note_id', 'layer', 'position']) ||
        typeof selection.note_id !== 'string' || !notes.some(note => note.id === selection.note_id) ||
        ids.has(selection.note_id) || !positionsByLayer.has(selection.layer) ||
        !Number.isInteger(selection.position) || selection.position < 0) return false;
    ids.add(selection.note_id);
    positionsByLayer.get(selection.layer).push(selection.position);
  }
  return [...positionsByLayer.values()].every(positions => {
    positions.sort((left, right) => left - right);
    return positions.every((position, index) => position === index);
  });
}

export function conceptCreateIsValid(payload, visibleName, visibleSelections) {
  return isValidConceptPayload(payload) && payload.name === visibleName &&
    JSON.stringify(normalizedSelections(payload.notes)) ===
      JSON.stringify(normalizedSelections(visibleSelections));
}

export function sameConceptRecord(candidate, expected) {
  return Boolean(candidate && expected) && candidate.id === expected.id &&
    candidate.name === expected.name &&
    JSON.stringify(normalizedSelections(candidate.notes)) ===
      JSON.stringify(normalizedSelections(expected.notes));
}

export function statusAllowsWatcher(status, url) {
  return status === 401 && new URL(url).pathname === '/api/v1/auth/session';
}

export async function installGuidedSaveFixture(context) {
  const fixtureSession = randomBytes(32).toString('hex');
  let sessionActive = false;
  let currentCsrf = '';
  let challengeRequests = 0;
  let verificationRequests = 0;
  let conceptCreates = 0;
  let conceptReads = 0;
  let conceptUpdates = 0;
  let conceptDeletes = 0;
  let savedConcept = null;
  const unexpectedApiCalls = [];
  const apiRequests = [];
  const csrfValues = [];

  const requestHasSession = request => (request.headers().cookie || '').split(';')
    .some(part => part.trim() === `aroman_session=${fixtureSession}`);
  const authenticatedRequest = request => sessionActive && requestHasSession(request);
  const corsHeaders = request => ({
    'access-control-allow-origin': request.headers().origin || frontendOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, x-csrf-token',
    vary: 'Origin',
  });
  const jsonResponse = (request, status, payload, extraHeaders = {}) => ({
    status,
    headers: { ...corsHeaders(request), 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(payload),
  });

  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    apiRequests.push({ method, path, query: url.search });
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(request) });
      return;
    }
    if (path === '/api/v1/fragrance-families' && method === 'GET') {
      await route.fulfill(jsonResponse(request, 200, families));
      return;
    }
    if (path === '/api/v1/fragrance-notes' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase('fa');
      const familyId = url.searchParams.get('family_id');
      const filtered = notes.filter(note => (!familyId || note.family_id === familyId) &&
        (!query || `${note.name} ${note.slug}`.toLocaleLowerCase('fa').includes(query)));
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || 100);
      await route.fulfill(jsonResponse(request, 200, filtered.slice(offset, offset + limit)));
      return;
    }
    if (path === '/api/v1/auth/challenges' && method === 'POST') {
      challengeRequests += 1;
      let mobile;
      try { mobile = request.postDataJSON().mobile; } catch { mobile = undefined; }
      await route.fulfill(jsonResponse(request, mobile === fixtureMobile ? 202 : 422,
        mobile === fixtureMobile ? { message: 'If delivery is available, a code has been sent' } : { detail: 'Invalid mobile number' }));
      return;
    }
    if (path === '/api/v1/auth/verify' && method === 'POST') {
      verificationRequests += 1;
      let body;
      try { body = request.postDataJSON(); } catch { body = {}; }
      if (body.mobile !== fixtureMobile || body.code !== fixtureOtp) {
        await route.fulfill(jsonResponse(request, 400, { detail: 'Invalid or expired code' }));
        return;
      }
      sessionActive = true;
      currentCsrf = randomBytes(32).toString('hex');
      csrfValues.push(currentCsrf);
      await route.fulfill(jsonResponse(request, 200, { user_id: fixtureUserId, csrf_token: currentCsrf }, {
        'set-cookie': `aroman_session=${fixtureSession}; HttpOnly; Path=/api/v1; SameSite=Lax`,
      }));
      return;
    }
    if (path === '/api/v1/auth/session' && method === 'GET') {
      await route.fulfill(authenticatedRequest(request)
        ? jsonResponse(request, 200, { user_id: fixtureUserId, role: 'customer' })
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }
    if (path === '/api/v1/auth/csrf' && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      currentCsrf = randomBytes(32).toString('hex');
      csrfValues.push(currentCsrf);
      await route.fulfill(jsonResponse(request, 200, { csrf_token: currentCsrf }));
      return;
    }
    if (path === '/api/v1/users/me' && method === 'GET') {
      await route.fulfill(authenticatedRequest(request)
        ? jsonResponse(request, 200, fixtureUser)
        : jsonResponse(request, 401, { detail: 'Authentication required' }));
      return;
    }
    if (path === '/api/v1/fragrance-concepts' && method === 'POST') {
      conceptCreates += 1;
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      if (request.headers()['x-csrf-token'] !== currentCsrf) {
        await route.fulfill(jsonResponse(request, 403, { detail: 'CSRF token required' }));
        return;
      }
      let body;
      try { body = request.postDataJSON(); } catch { body = null; }
      if (!isValidConceptPayload(body)) {
        await route.fulfill(jsonResponse(request, 422, { detail: 'Invalid concept payload' }));
        return;
      }
      if (savedConcept || conceptCreates !== 1) {
        await route.fulfill(jsonResponse(request, 409, { detail: 'Concept create already accepted' }));
        return;
      }
      savedConcept = { id: fixtureConceptId, name: body.name, notes: body.notes.map(item => ({ ...item })) };
      await route.fulfill(jsonResponse(request, 201, savedConcept));
      return;
    }
    if (path === '/api/v1/fragrance-concepts' && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      conceptReads += 1;
      await route.fulfill(jsonResponse(request, 200, savedConcept ? [savedConcept] : []));
      return;
    }
    const conceptPath = path.match(/^\/api\/v1\/fragrance-concepts\/([^/]+)$/);
    if (conceptPath && method === 'GET') {
      if (!authenticatedRequest(request)) {
        await route.fulfill(jsonResponse(request, 401, { detail: 'Authentication required' }));
        return;
      }
      conceptReads += 1;
      await route.fulfill(savedConcept && decodeURIComponent(conceptPath[1]) === savedConcept.id
        ? jsonResponse(request, 200, savedConcept)
        : jsonResponse(request, 404, { detail: 'Concept not found' }));
      return;
    }
    if (path.startsWith('/api/v1/fragrance-concepts/') && method === 'PUT') conceptUpdates += 1;
    if (path.startsWith('/api/v1/fragrance-concepts/') && method === 'DELETE') conceptDeletes += 1;
    unexpectedApiCalls.push({ method, path });
    await route.fulfill(jsonResponse(request, 500, { detail: 'Unexpected isolated Guided Save API call' }));
  });

  return {
    get challengeRequests() { return challengeRequests; },
    get verificationRequests() { return verificationRequests; },
    get conceptCreates() { return conceptCreates; },
    get conceptReads() { return conceptReads; },
    get conceptUpdates() { return conceptUpdates; },
    get conceptDeletes() { return conceptDeletes; },
    get savedConcept() { return savedConcept; },
    get unexpectedApiCalls() { return unexpectedApiCalls; },
    get apiRequests() { return apiRequests; },
    get csrfValues() { return csrfValues; },
  };
}
