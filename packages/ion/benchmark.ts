import ION from './index.ts';

interface BenchmarkResult {
  name: string;
  jsonStringify: number;
  ionStringify: number;
  jsonParse: number;
  ionParse: number;
  jsonSize: number;
  ionSize: number;
}

function benchmark(name: string, data: unknown, iterations = 10000): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 100; i++) {
    JSON.stringify(data);
    ION.stringify(data);
  }

  // Benchmark JSON.stringify
  const jsonStringifyStart = performance.now();
  let jsonStr = '';
  for (let i = 0; i < iterations; i++) {
    jsonStr = JSON.stringify(data);
  }
  const jsonStringifyTime = performance.now() - jsonStringifyStart;

  // Benchmark ION.stringify
  const ionStringifyStart = performance.now();
  let ionStr = '';
  for (let i = 0; i < iterations; i++) {
    ionStr = ION.stringify(data);
  }
  const ionStringifyTime = performance.now() - ionStringifyStart;

  // Benchmark JSON.parse
  const jsonParseStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    JSON.parse(jsonStr);
  }
  const jsonParseTime = performance.now() - jsonParseStart;

  // Benchmark ION.parse
  const ionParseStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    ION.parse(ionStr);
  }
  const ionParseTime = performance.now() - ionParseStart;

  return {
    name,
    jsonStringify: jsonStringifyTime,
    ionStringify: ionStringifyTime,
    jsonParse: jsonParseTime,
    ionParse: ionParseTime,
    jsonSize: jsonStr.length,
    ionSize: ionStr.length,
  };
}

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  }
  return `${ms.toFixed(2)}ms`;
}

function formatRatio(ion: number, json: number): string {
  const ratio = ion / json;
  if (ratio < 1) {
    return `${(1 / ratio).toFixed(2)}x faster`;
  } else {
    return `${ratio.toFixed(2)}x slower`;
  }
}

function printResults(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(100));
  console.log('ION vs JSON Benchmark Results');
  console.log('='.repeat(100));

  for (const result of results) {
    console.log(`\n${result.name}`);
    console.log('-'.repeat(100));

    console.log('\nStringify:');
    console.log(`  JSON:  ${formatTime(result.jsonStringify)}`);
    console.log(`  ION:   ${formatTime(result.ionStringify)} (${formatRatio(result.ionStringify, result.jsonStringify)})`);

    console.log('\nParse:');
    console.log(`  JSON:  ${formatTime(result.jsonParse)}`);
    console.log(`  ION:   ${formatTime(result.ionParse)} (${formatRatio(result.ionParse, result.jsonParse)})`);

    console.log('\nSize:');
    console.log(`  JSON:  ${result.jsonSize} bytes`);
    console.log(`  ION:   ${result.ionSize} bytes (${result.ionSize > result.jsonSize ? '+' : ''}${result.ionSize - result.jsonSize} bytes)`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('Summary');
  console.log('='.repeat(100));

  const avgJsonStringify = results.reduce((sum, r) => sum + r.jsonStringify, 0) / results.length;
  const avgIonStringify = results.reduce((sum, r) => sum + r.ionStringify, 0) / results.length;
  const avgJsonParse = results.reduce((sum, r) => sum + r.jsonParse, 0) / results.length;
  const avgIonParse = results.reduce((sum, r) => sum + r.ionParse, 0) / results.length;

  console.log(`\nAverage Stringify: JSON ${formatTime(avgJsonStringify)}, ION ${formatTime(avgIonStringify)}`);
  console.log(`Average Parse:     JSON ${formatTime(avgJsonParse)}, ION ${formatTime(avgIonParse)}`);
  console.log(`\nION is ${formatRatio(avgIonStringify, avgJsonStringify)} for stringify`);
  console.log(`ION is ${formatRatio(avgIonParse, avgJsonParse)} for parse`);
  console.log('='.repeat(100) + '\n');
}

// Test data
const smallObject = {
  name: 'Alice',
  age: 30,
  active: true,
};

const mediumObject = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
    { id: 2, name: 'Bob', email: 'bob@example.com', active: false },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', active: true },
  ],
  metadata: {
    version: '1.0.0',
    created: '2026-01-27',
    count: 3,
  },
};

const largeArray = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  email: `user${i}@example.com`,
  score: Math.random() * 100,
  active: i % 2 === 0,
}));

const deepNesting = {
  level1: {
    level2: {
      level3: {
        level4: {
          level5: {
            data: 'deep value',
            numbers: [1, 2, 3, 4, 5],
          },
        },
      },
    },
  },
};

const stringHeavy = {
  description: 'This is a longer description with multiple sentences. '.repeat(10),
  comments: Array.from({ length: 20 }, (_, i) => `Comment number ${i} with some text content`),
};

// Run benchmarks
console.log('Running benchmarks...\n');

const results: BenchmarkResult[] = [];

console.log('[1/5] Small object...');
results.push(benchmark('Small Object (3 properties)', smallObject, 50000));

console.log('[2/5] Medium object...');
results.push(benchmark('Medium Object (users array + metadata)', mediumObject, 20000));

console.log('[3/5] Large array...');
results.push(benchmark('Large Array (100 objects)', largeArray, 5000));

console.log('[4/5] Deep nesting...');
results.push(benchmark('Deep Nesting (5 levels)', deepNesting, 50000));

console.log('[5/5] String heavy...');
results.push(benchmark('String Heavy (long strings + array)', stringHeavy, 10000));

printResults(results);
