import { describe, test, expect } from 'bun:test';
import ION from './index.ts';

describe('ION', () => {
  describe('Round-trip tests (stringify → parse)', () => {
    test('primitives: strings', () => {
      const values = ['hello', '', 'with spaces', 'with\nnewlines', 'with\ttabs'];
      for (const val of values) {
        expect(ION.parse(ION.stringify(val))).toBe(val);
      }
    });

    test('primitives: numbers', () => {
      const values = [0, 1, -1, 123.456, -123.456, 1e10, 1e-10];
      for (const val of values) {
        expect(ION.parse(ION.stringify(val))).toBe(val);
      }
    });

    test('primitives: booleans', () => {
      expect(ION.parse(ION.stringify(true))).toBe(true);
      expect(ION.parse(ION.stringify(false))).toBe(false);
    });

    test('primitives: null', () => {
      expect(ION.parse(ION.stringify(null))).toBe(null);
    });

    test('special numbers: NaN', () => {
      expect(Number.isNaN(ION.parse(ION.stringify(NaN)))).toBe(true);
    });

    test('special numbers: Infinity', () => {
      expect(ION.parse(ION.stringify(Infinity))).toBe(Infinity);
    });

    test('special numbers: -Infinity', () => {
      expect(ION.parse(ION.stringify(-Infinity))).toBe(-Infinity);
    });

    test('dates: various ISO 8601 formats', () => {
      const dates = [
        new Date('2026-01-27T15:30:00Z'),
        new Date('2020-01-01T00:00:00Z'),
        new Date('1999-12-31T23:59:59.999Z'),
      ];

      for (const date of dates) {
        const result = ION.parse(ION.stringify(date));
        expect(result).toBeInstanceOf(Date);
        expect((result as Date).getTime()).toBe(date.getTime());
      }
    });

    test('collections: Map with string keys', () => {
      const map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      const result = ION.parse(ION.stringify(map));
      expect(result).toBeInstanceOf(Map);
      expect((result as Map<unknown, unknown>).get('key1')).toBe('value1');
      expect((result as Map<unknown, unknown>).get('key2')).toBe('value2');
    });

    test('collections: Map with number keys', () => {
      const map = new Map([
        [1, 'one'],
        [2, 'two'],
      ]);

      const result = ION.parse(ION.stringify(map));
      expect(result).toBeInstanceOf(Map);
      expect((result as Map<unknown, unknown>).get(1)).toBe('one');
      expect((result as Map<unknown, unknown>).get(2)).toBe('two');
    });

    test('collections: Set with various values', () => {
      const set = new Set(['a', 'b', 'c', 1, 2, 3]);

      const result = ION.parse(ION.stringify(set));
      expect(result).toBeInstanceOf(Set);
      expect((result as Set<unknown>).has('a')).toBe(true);
      expect((result as Set<unknown>).has('b')).toBe(true);
      expect((result as Set<unknown>).has('c')).toBe(true);
      expect((result as Set<unknown>).has(1)).toBe(true);
      expect((result as Set<unknown>).has(2)).toBe(true);
      expect((result as Set<unknown>).has(3)).toBe(true);
    });

    test('collections: empty Map', () => {
      const map = new Map();
      const result = ION.parse(ION.stringify(map));
      expect(result).toBeInstanceOf(Map);
      expect((result as Map<unknown, unknown>).size).toBe(0);
    });

    test('collections: empty Set', () => {
      const set = new Set();
      const result = ION.parse(ION.stringify(set));
      expect(result).toBeInstanceOf(Set);
      expect((result as Set<unknown>).size).toBe(0);
    });

    test('nested structures: object in array', () => {
      const obj = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
      const result = ION.parse(ION.stringify(obj));
      expect(result).toEqual(obj);
    });

    test('nested structures: map in object', () => {
      const obj = {
        data: new Map([['key', 'value']]),
        count: 5,
      };

      const result = ION.parse(ION.stringify(obj)) as typeof obj;
      expect(result.count).toBe(5);
      expect(result.data).toBeInstanceOf(Map);
      expect(result.data.get('key')).toBe('value');
    });

    test('nested structures: set in array', () => {
      const arr = [1, 2, new Set([3, 4, 5])];
      const result = ION.parse(ION.stringify(arr)) as unknown[];
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBeInstanceOf(Set);
      expect((result[2] as Set<number>).has(3)).toBe(true);
      expect((result[2] as Set<number>).has(4)).toBe(true);
      expect((result[2] as Set<number>).has(5)).toBe(true);
    });

    test('nested structures: complex nesting', () => {
      const obj = {
        users: [
          {
            name: 'Alice',
            metadata: new Map<string, Date | Set<string>>([
              ['lastLogin', new Date('2026-01-27T15:30:00Z')],
              ['roles', new Set(['admin', 'user'])],
            ]),
          },
        ],
        stats: {
          count: 42,
          ratio: NaN,
        },
      };

      const result = ION.parse(ION.stringify(obj)) as typeof obj;
      expect(result.users[0]?.name).toBe('Alice');
      expect(result.users[0]?.metadata).toBeInstanceOf(Map);
      expect(result.users[0]?.metadata.get('lastLogin')).toBeInstanceOf(Date);
      expect(result.users[0]?.metadata.get('roles')).toBeInstanceOf(Set);
      expect(result.stats.count).toBe(42);
      expect(Number.isNaN(result.stats.ratio)).toBe(true);
    });

    test('edge cases: empty object', () => {
      const obj = {};
      expect(ION.parse(ION.stringify(obj))).toEqual(obj);
    });

    test('edge cases: empty array', () => {
      const arr: unknown[] = [];
      expect(ION.parse(ION.stringify(arr))).toEqual(arr);
    });
  });

  describe('JSON compatibility', () => {
    test('parses valid JSON objects', () => {
      const json = '{"name": "Alice", "age": 30}';
      const result = ION.parse(json);
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    test('parses valid JSON arrays', () => {
      const json = '[1, 2, 3, "four", true, null]';
      const result = ION.parse(json);
      expect(result).toEqual([1, 2, 3, 'four', true, null]);
    });

    test('parses JSON primitives', () => {
      expect(ION.parse('"hello"')).toBe('hello');
      expect(ION.parse('123')).toBe(123);
      expect(ION.parse('true')).toBe(true);
      expect(ION.parse('false')).toBe(false);
      expect(ION.parse('null')).toBe(null);
    });

    test('parses nested JSON', () => {
      const json = '{"users": [{"name": "Alice"}, {"name": "Bob"}], "count": 2}';
      const result = ION.parse(json);
      expect(result).toEqual({
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        count: 2,
      });
    });
  });

  describe('Error handling: unsupported types', () => {
    test('throws on WeakMap', () => {
      const weakMap = new WeakMap();
      expect(() => ION.stringify(weakMap)).toThrow('Cannot serialize WeakMap');
    });

    test('throws on WeakSet', () => {
      const weakSet = new WeakSet();
      expect(() => ION.stringify(weakSet)).toThrow('Cannot serialize WeakSet');
    });

    test('throws on function', () => {
      const fn = () => {};
      expect(() => ION.stringify(fn)).toThrow('Cannot serialize function');
    });

    test('throws on symbol', () => {
      const sym = Symbol('test');
      expect(() => ION.stringify(sym)).toThrow('Cannot serialize symbol');
    });

    test('throws on BigInt', () => {
      const big = BigInt(123);
      expect(() => ION.stringify(big)).toThrow('Cannot serialize BigInt');
    });

    test('throws on circular references', () => {
      const obj: { self?: unknown } = {};
      obj.self = obj;
      expect(() => ION.stringify(obj)).toThrow('Circular reference');
    });

    test('throws on circular array references', () => {
      const arr: unknown[] = [];
      arr.push(arr);
      expect(() => ION.stringify(arr)).toThrow('Circular reference');
    });

    test('throws on invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => ION.stringify(invalidDate)).toThrow('Invalid Date');
    });

    test('throws on undefined at root', () => {
      expect(() => ION.stringify(undefined)).toThrow('Cannot serialize undefined');
    });

    test('throws on undefined in array', () => {
      const arr = [1, undefined, 3];
      expect(() => ION.stringify(arr)).toThrow('Cannot serialize undefined');
    });
  });

  describe('Error handling: invalid ION syntax', () => {
    test('throws on invalid date string', () => {
      expect(() => ION.parse('date:"not-a-date"')).toThrow('Invalid date string');
    });

    test('throws on unexpected token', () => {
      expect(() => ION.parse('unexpected')).toThrow('Unexpected');
    });

    test('throws on unterminated string', () => {
      expect(() => ION.parse('"unterminated')).toThrow('Unterminated string');
    });

    test('throws on malformed object', () => {
      expect(() => ION.parse('{key: "value"}')).toThrow('Unexpected character');
    });

    test('throws on unexpected EOF', () => {
      expect(() => ION.parse('{')).toThrow();
    });

    test('throws on trailing comma in object', () => {
      expect(() => ION.parse('{"a": 1,}')).toThrow();
    });
  });

  describe('undefined handling', () => {
    test('omits undefined properties from objects', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const serialized = ION.stringify(obj);
      const result = ION.parse(serialized);
      expect(result).toEqual({ a: 1, c: 3 });
      expect(result).not.toHaveProperty('b');
    });

    test('preserves object shape without undefined properties', () => {
      const obj = { name: 'Alice', age: undefined, active: true };
      const result = ION.parse(ION.stringify(obj));
      expect(result).toEqual({ name: 'Alice', active: true });
    });

    test('handles all undefined properties', () => {
      const obj = { a: undefined, b: undefined };
      const result = ION.parse(ION.stringify(obj));
      expect(result).toEqual({});
    });
  });

  describe('String escaping and edge cases', () => {
    test('handles strings containing ION keywords', () => {
      const values = ['NaN', 'Infinity', '-Infinity', 'date:', 'map', 'set', 'true', 'false', 'null'];
      for (const val of values) {
        expect(ION.parse(ION.stringify(val))).toBe(val);
      }
    });

    test('handles special characters in strings', () => {
      const values = [
        'line1\nline2',
        'tab\there',
        'quote"inside',
        'backslash\\here',
        'slash/here',
      ];
      for (const val of values) {
        expect(ION.parse(ION.stringify(val))).toBe(val);
      }
    });

    test('handles unicode characters', () => {
      const values = ['Hello 世界', '🚀', 'café', 'naïve'];
      for (const val of values) {
        expect(ION.parse(ION.stringify(val))).toBe(val);
      }
    });

    test('handles empty strings', () => {
      expect(ION.parse(ION.stringify(''))).toBe('');
    });

    test('handles objects with special string keys', () => {
      const obj = {
        NaN: 1,
        Infinity: 2,
        'date:': 3,
        map: 4,
        set: 5,
      };
      expect(ION.parse(ION.stringify(obj))).toEqual(obj);
    });
  });

  describe('Stringify output format', () => {
    test('formats NaN correctly', () => {
      expect(ION.stringify(NaN)).toBe('NaN');
    });

    test('formats Infinity correctly', () => {
      expect(ION.stringify(Infinity)).toBe('Infinity');
    });

    test('formats -Infinity correctly', () => {
      expect(ION.stringify(-Infinity)).toBe('-Infinity');
    });

    test('formats Date correctly', () => {
      const date = new Date('2026-01-27T15:30:00.000Z');
      expect(ION.stringify(date)).toBe('date:2026-01-27T15:30:00.000Z');
    });

    test('formats Map correctly', () => {
      const map = new Map([['a', 1]]);
      expect(ION.stringify(map)).toBe('map { "a": 1 }');
    });

    test('formats Set correctly', () => {
      const set = new Set([1, 2]);
      expect(ION.stringify(set)).toBe('set { 1, 2 }');
    });

    test('formats empty Map correctly', () => {
      const map = new Map();
      expect(ION.stringify(map)).toBe('map {  }');
    });

    test('formats empty Set correctly', () => {
      const set = new Set();
      expect(ION.stringify(set)).toBe('set {  }');
    });
  });
});
