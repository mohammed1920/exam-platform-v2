/* Authenticated Firestore aggregation bridge using the existing Compat session. */
window.mizanFirestoreCount = async function mizanFirestoreCount(collectionName, filters = []) {
  const auth = window.publicAuth;
  if (!auth) throw new Error('Firebase authentication is not initialized.');

  let user = auth.user;
  if (!user && typeof auth.whenReady === 'function') user = await auth.whenReady();
  if (!user || typeof user.getIdToken !== 'function') {
    throw new Error('An authenticated administrator session is required.');
  }

  const app = window.firebase?.app?.();
  const projectId = app?.options?.projectId;
  const apiKey = app?.options?.apiKey;
  if (!projectId) throw new Error('Firebase project configuration is unavailable.');

  const operators = {
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'array-contains': 'ARRAY_CONTAINS',
    'in': 'IN',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
    'not-in': 'NOT_IN'
  };

  function encodeValue(value) {
    if (value === null) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
    throw new TypeError('Unsupported Firestore aggregation filter value.');
  }

  const fieldFilters = filters.map(([field, operator, value]) => {
    const op = operators[operator];
    if (!field || !op) throw new TypeError('Unsupported Firestore aggregation filter.');
    return {
      fieldFilter: {
        field: { fieldPath: field },
        op,
        value: encodeValue(value)
      }
    };
  });

  const structuredQuery = {
    from: [{ collectionId: String(collectionName) }]
  };
  if (fieldFilters.length === 1) {
    structuredQuery.where = fieldFilters[0];
  } else if (fieldFilters.length > 1) {
    structuredQuery.where = {
      compositeFilter: { op: 'AND', filters: fieldFilters }
    };
  }

  const token = await user.getIdToken();
  const endpoint = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runAggregationQuery`
  );
  if (apiKey) endpoint.searchParams.set('key', apiKey);

  const response = await fetch(endpoint.href, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ alias: 'count', count: {} }]
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Firestore aggregation request failed.');
    error.code = payload?.error?.status || 'unknown';
    throw error;
  }

  // Firestore REST returns one RunAggregationQueryResponse object
  // containing result.aggregateFields (not an array of AggregationResult).
  // Accept the streaming-array shape too, without silently converting an
  // unexpected response into a misleading zero.
  const responseItem = Array.isArray(payload)
    ? payload.find(item => item?.result?.aggregateFields?.count || item?.aggregateFields?.count)
    : payload;
  const aggregationResult = responseItem?.result || responseItem;
  const countValue = aggregationResult?.aggregateFields?.count;
  if (!countValue) {
    throw new Error('Firestore aggregation response did not contain the count result.');
  }
  const count = countValue.integerValue ?? countValue.doubleValue;
  const parsedCount = Number(count);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) {
    throw new Error('Firestore returned an invalid aggregation count.');
  }
  return parsedCount;
};
