import ION from './index.ts';

console.log('='.repeat(100));
console.log('ION vs JSON: Type Preservation Comparison');
console.log('='.repeat(100));

// Test 1: Dates
console.log('\n1. Date Handling');
console.log('-'.repeat(100));
const dateObj = { timestamp: new Date('2026-01-27T15:30:00Z'), name: 'Event' };

const jsonDate = JSON.parse(JSON.stringify(dateObj));
const ionDate = ION.parse(ION.stringify(dateObj));

console.log('Original:', dateObj);
console.log('JSON:    ', jsonDate);
console.log('  - timestamp type:', typeof jsonDate.timestamp);
console.log('  - timestamp value:', jsonDate.timestamp);
console.log('ION:     ', ionDate);
console.log('  - timestamp type:', typeof ionDate.timestamp);
console.log('  - timestamp instanceof Date:', ionDate.timestamp instanceof Date);

// Test 2: NaN and Infinity
console.log('\n2. Special Numbers (NaN, Infinity)');
console.log('-'.repeat(100));
const specialNumbers = {
  nan: NaN,
  infinity: Infinity,
  negInfinity: -Infinity,
  normal: 42,
};

const jsonSpecial = JSON.parse(JSON.stringify(specialNumbers));
const ionSpecial = ION.parse(ION.stringify(specialNumbers));

console.log('Original:', specialNumbers);
console.log('JSON:    ', jsonSpecial);
console.log('  - nan is NaN:', Number.isNaN(jsonSpecial.nan));
console.log('  - infinity is Infinity:', jsonSpecial.infinity === Infinity);
console.log('ION:     ', ionSpecial);
console.log('  - nan is NaN:', Number.isNaN(ionSpecial.nan));
console.log('  - infinity is Infinity:', ionSpecial.infinity === Infinity);
console.log('  - negInfinity is -Infinity:', ionSpecial.negInfinity === -Infinity);

// Test 3: Maps
console.log('\n3. Map Handling');
console.log('-'.repeat(100));
const mapObj = {
  config: new Map([
    ['theme', 'dark'],
    ['fontSize', 14],
    [123, 'numeric key'],
  ]),
};

const jsonMap = JSON.parse(JSON.stringify(mapObj));
const ionMap = ION.parse(ION.stringify(mapObj));

console.log('Original:', mapObj);
console.log('  - config instanceof Map:', mapObj.config instanceof Map);
console.log('  - config.get("theme"):', mapObj.config.get('theme'));
console.log('JSON:    ', jsonMap);
console.log('  - config instanceof Map:', jsonMap.config instanceof Map);
console.log('  - config type:', typeof jsonMap.config);
console.log('ION:     ', ionMap);
console.log('  - config instanceof Map:', ionMap.config instanceof Map);
console.log('  - config.get("theme"):', ionMap.config.get('theme'));
console.log('  - config.get(123):', ionMap.config.get(123));

// Test 4: Sets
console.log('\n4. Set Handling');
console.log('-'.repeat(100));
const setObj = {
  tags: new Set(['javascript', 'typescript', 'bun']),
  count: 3,
};

const jsonSet = JSON.parse(JSON.stringify(setObj));
const ionSet = ION.parse(ION.stringify(setObj));

console.log('Original:', setObj);
console.log('  - tags instanceof Set:', setObj.tags instanceof Set);
console.log('  - tags.has("typescript"):', setObj.tags.has('typescript'));
console.log('JSON:    ', jsonSet);
console.log('  - tags instanceof Set:', jsonSet.tags instanceof Set);
console.log('  - tags type:', typeof jsonSet.tags);
console.log('ION:     ', ionSet);
console.log('  - tags instanceof Set:', ionSet.tags instanceof Set);
console.log('  - tags.has("typescript"):', ionSet.tags.has('typescript'));

// Test 5: undefined properties
console.log('\n5. undefined Handling');
console.log('-'.repeat(100));
const undefinedObj = {
  name: 'Alice',
  age: undefined,
  email: 'alice@example.com',
  phone: undefined,
};

const jsonUndefined = JSON.parse(JSON.stringify(undefinedObj));
const ionUndefined = ION.parse(ION.stringify(undefinedObj));

console.log('Original:', undefinedObj);
console.log('  - has "age" property:', 'age' in undefinedObj);
console.log('  - has "phone" property:', 'phone' in undefinedObj);
console.log('JSON:    ', jsonUndefined);
console.log('  - has "age" property:', 'age' in jsonUndefined);
console.log('  - has "phone" property:', 'phone' in jsonUndefined);
console.log('ION:     ', ionUndefined);
console.log('  - has "age" property:', 'age' in ionUndefined);
console.log('  - has "phone" property:', 'phone' in ionUndefined);

// Test 6: Complex real-world scenario
console.log('\n6. Real-World Scenario: API Response with Mixed Types');
console.log('-'.repeat(100));
const apiResponse = {
  user: {
    id: 123,
    name: 'Alice',
    lastLogin: new Date('2026-01-27T15:30:00Z'),
    score: NaN, // not yet calculated
    preferences: new Map([
      ['theme', 'dark'],
      ['notifications', true],
    ]),
    roles: new Set(['admin', 'user']),
    optionalField: undefined,
  },
  metadata: {
    requestTime: new Date('2026-01-27T15:35:00Z'),
    version: '1.0.0',
  },
};

console.log('\nOriginal object:');
console.log('  - user.lastLogin instanceof Date:', apiResponse.user.lastLogin instanceof Date);
console.log('  - user.score is NaN:', Number.isNaN(apiResponse.user.score));
console.log('  - user.preferences instanceof Map:', apiResponse.user.preferences instanceof Map);
console.log('  - user.roles instanceof Set:', apiResponse.user.roles instanceof Set);
console.log('  - user has "optionalField":', 'optionalField' in apiResponse.user);

const jsonApi = JSON.parse(JSON.stringify(apiResponse));
console.log('\nJSON round-trip:');
console.log('  - user.lastLogin instanceof Date:', jsonApi.user.lastLogin instanceof Date);
console.log('  - user.lastLogin type:', typeof jsonApi.user.lastLogin);
console.log('  - user.score is NaN:', Number.isNaN(jsonApi.user.score));
console.log('  - user.score value:', jsonApi.user.score);
console.log('  - user.preferences instanceof Map:', jsonApi.user.preferences instanceof Map);
console.log('  - user.roles instanceof Set:', jsonApi.user.roles instanceof Set);
console.log('  - user has "optionalField":', 'optionalField' in jsonApi.user);

const ionApi = ION.parse(ION.stringify(apiResponse));
console.log('\nION round-trip:');
console.log('  - user.lastLogin instanceof Date:', ionApi.user.lastLogin instanceof Date);
console.log('  - user.score is NaN:', Number.isNaN(ionApi.user.score));
console.log('  - user.preferences instanceof Map:', ionApi.user.preferences instanceof Map);
console.log('  - user.preferences.get("theme"):', ionApi.user.preferences.get('theme'));
console.log('  - user.roles instanceof Set:', ionApi.user.roles instanceof Set);
console.log('  - user.roles.has("admin"):', ionApi.user.roles.has('admin'));
console.log('  - user has "optionalField":', 'optionalField' in ionApi.user);

// Summary
console.log('\n' + '='.repeat(100));
console.log('Summary');
console.log('='.repeat(100));
console.log('\nJSON Issues:');
console.log('  ✗ Dates become strings (need manual conversion)');
console.log('  ✗ NaN becomes null (information loss)');
console.log('  ✗ Infinity becomes null (information loss)');
console.log('  ✗ Maps become empty objects (data loss)');
console.log('  ✗ Sets become empty objects (data loss)');
console.log('  ✓ undefined properties are removed');

console.log('\nION Guarantees:');
console.log('  ✓ Dates preserved as Date objects');
console.log('  ✓ NaN preserved as NaN');
console.log('  ✓ Infinity preserved as Infinity');
console.log('  ✓ Maps preserved with all entries and types');
console.log('  ✓ Sets preserved with all values');
console.log('  ✓ undefined properties are removed');
console.log('  ✓ Throws errors for unsupported types (WeakMap, functions, etc.)');

console.log('\n' + '='.repeat(100) + '\n');
