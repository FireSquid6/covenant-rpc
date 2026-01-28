


const ION = {
  parse(ionExpression: string): unknown {
    type TokenType =
      | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET'
      | 'COMMA' | 'COLON' | 'STRING' | 'NUMBER'
      | 'TRUE' | 'FALSE' | 'NULL' | 'NAN'
      | 'INFINITY' | 'NEG_INFINITY' | 'DATE'
      | 'MAP' | 'SET' | 'EOF';

    interface Token {
      type: TokenType;
      value?: unknown;
      position: number;
    }

    class Tokenizer {
      private pos = 0;
      private input: string;

      constructor(input: string) {
        this.input = input;
      }

      private skipWhitespace(): void {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos]!)) {
          this.pos++;
        }
      }

      private peek(offset = 0): string {
        return this.input[this.pos + offset] ?? '';
      }

      private advance(): string {
        return this.input[this.pos++] ?? '';
      }

      private match(str: string): boolean {
        if (this.input.slice(this.pos, this.pos + str.length) === str) {
          this.pos += str.length;
          return true;
        }
        return false;
      }

      private scanString(): string {
        let result = '';
        this.advance(); // consume opening quote

        while (this.pos < this.input.length) {
          const ch = this.peek();

          if (ch === '"') {
            this.advance(); // consume closing quote
            return result;
          }

          if (ch === '\\') {
            this.advance();
            const escaped = this.advance();
            switch (escaped) {
              case 'n': result += '\n'; break;
              case 't': result += '\t'; break;
              case 'r': result += '\r'; break;
              case '\\': result += '\\'; break;
              case '"': result += '"'; break;
              case '/': result += '/'; break;
              case 'b': result += '\b'; break;
              case 'f': result += '\f'; break;
              case 'u': {
                const hex = this.input.slice(this.pos, this.pos + 4);
                this.pos += 4;
                result += String.fromCharCode(parseInt(hex, 16));
                break;
              }
              default:
                throw new Error(`Invalid escape sequence \\${escaped} at position ${this.pos}`);
            }
          } else {
            result += this.advance();
          }
        }

        throw new Error(`Unterminated string at position ${this.pos}`);
      }

      private scanNumber(): number {
        const start = this.pos;

        if (this.peek() === '-') {
          this.advance();
        }

        if (this.peek() === '0') {
          this.advance();
        } else {
          while (/\d/.test(this.peek())) {
            this.advance();
          }
        }

        if (this.peek() === '.') {
          this.advance();
          while (/\d/.test(this.peek())) {
            this.advance();
          }
        }

        if (this.peek() === 'e' || this.peek() === 'E') {
          this.advance();
          if (this.peek() === '+' || this.peek() === '-') {
            this.advance();
          }
          while (/\d/.test(this.peek())) {
            this.advance();
          }
        }

        const numStr = this.input.slice(start, this.pos);
        return parseFloat(numStr);
      }

      nextToken(): Token {
        this.skipWhitespace();

        if (this.pos >= this.input.length) {
          return { type: 'EOF', position: this.pos };
        }

        const position = this.pos;
        const ch = this.peek();

        // Single character tokens
        if (ch === '{') {
          this.advance();
          return { type: 'LBRACE', position };
        }
        if (ch === '}') {
          this.advance();
          return { type: 'RBRACE', position };
        }
        if (ch === '[') {
          this.advance();
          return { type: 'LBRACKET', position };
        }
        if (ch === ']') {
          this.advance();
          return { type: 'RBRACKET', position };
        }
        if (ch === ',') {
          this.advance();
          return { type: 'COMMA', position };
        }
        if (ch === ':') {
          this.advance();
          return { type: 'COLON', position };
        }

        // String
        if (ch === '"') {
          return { type: 'STRING', value: this.scanString(), position };
        }

        // Number
        if (ch === '-' || /\d/.test(ch)) {
          // Check for -Infinity first
          if (ch === '-' && this.input.slice(this.pos, this.pos + 9) === '-Infinity') {
            this.pos += 9;
            return { type: 'NEG_INFINITY', position };
          }
          return { type: 'NUMBER', value: this.scanNumber(), position };
        }

        // Keywords
        if (this.match('Infinity')) {
          return { type: 'INFINITY', position };
        }
        if (this.match('NaN')) {
          return { type: 'NAN', position };
        }
        if (this.match('true')) {
          return { type: 'TRUE', position };
        }
        if (this.match('false')) {
          return { type: 'FALSE', position };
        }
        if (this.match('null')) {
          return { type: 'NULL', position };
        }
        if (this.match('date:')) {
          // Read the ISO 8601 date string (unquoted)
          const start = this.pos;
          while (this.pos < this.input.length && !/[\s,}\]]/.test(this.peek())) {
            this.advance();
          }
          const dateStr = this.input.slice(start, this.pos);
          return { type: 'DATE', value: dateStr, position };
        }
        if (this.match('map')) {
          return { type: 'MAP', position };
        }
        if (this.match('set')) {
          return { type: 'SET', position };
        }

        throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
      }
    }

    class Parser {
      private tokenizer: Tokenizer;
      private currentToken: Token;

      constructor(input: string) {
        this.tokenizer = new Tokenizer(input);
        this.currentToken = this.tokenizer.nextToken();
      }

      private advance(): void {
        this.currentToken = this.tokenizer.nextToken();
      }

      private expect(type: TokenType): Token {
        if (this.currentToken.type !== type) {
          throw new Error(
            `Expected ${type} but got ${this.currentToken.type} at position ${this.currentToken.position}`
          );
        }
        const token = this.currentToken;
        this.advance();
        return token;
      }

      private parseValue(): unknown {
        const token = this.currentToken;

        switch (token.type) {
          case 'STRING':
            this.advance();
            return token.value;

          case 'NUMBER':
            this.advance();
            return token.value;

          case 'TRUE':
            this.advance();
            return true;

          case 'FALSE':
            this.advance();
            return false;

          case 'NULL':
            this.advance();
            return null;

          case 'NAN':
            this.advance();
            return NaN;

          case 'INFINITY':
            this.advance();
            return Infinity;

          case 'NEG_INFINITY':
            this.advance();
            return -Infinity;

          case 'DATE':
            return this.parseDate();

          case 'MAP':
            return this.parseMap();

          case 'SET':
            return this.parseSet();

          case 'LBRACE':
            return this.parseObject();

          case 'LBRACKET':
            return this.parseArray();

          default:
            throw new Error(
              `Unexpected token ${token.type} at position ${token.position}`
            );
        }
      }

      private parseDate(): Date {
        const token = this.currentToken;
        this.advance(); // consume DATE token

        const dateStr = token.value as string;
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date string "${dateStr}" at position ${token.position}`);
        }

        return date;
      }

      private parseMap(): Map<unknown, unknown> {
        this.advance(); // consume 'map'
        this.expect('LBRACE');

        const map = new Map();

        if (this.currentToken.type === 'RBRACE') {
          this.advance();
          return map;
        }

        while (true) {
          const key = this.parseValue();
          this.expect('COLON');
          const value = this.parseValue();
          map.set(key, value);

          if (this.currentToken.type === 'COMMA') {
            this.advance();
          } else {
            break;
          }
        }

        this.expect('RBRACE');
        return map;
      }

      private parseSet(): Set<unknown> {
        this.advance(); // consume 'set'
        this.expect('LBRACE');

        const set = new Set();

        if (this.currentToken.type === 'RBRACE') {
          this.advance();
          return set;
        }

        while (true) {
          set.add(this.parseValue());

          if (this.currentToken.type === 'COMMA') {
            this.advance();
          } else {
            break;
          }
        }

        this.expect('RBRACE');
        return set;
      }

      private parseObject(): Record<string, unknown> {
        this.expect('LBRACE');

        const obj: Record<string, unknown> = {};

        if (this.currentToken.type === 'RBRACE') {
          this.advance();
          return obj;
        }

        while (true) {
          const keyToken = this.expect('STRING');
          const key = keyToken.value as string;
          this.expect('COLON');
          const value = this.parseValue();
          obj[key] = value;

          if (this.currentToken.type === 'COMMA') {
            this.advance();
          } else {
            break;
          }
        }

        this.expect('RBRACE');
        return obj;
      }

      private parseArray(): unknown[] {
        this.expect('LBRACKET');

        const arr: unknown[] = [];

        if (this.currentToken.type === 'RBRACKET') {
          this.advance();
          return arr;
        }

        while (true) {
          arr.push(this.parseValue());

          if (this.currentToken.type === 'COMMA') {
            this.advance();
          } else {
            break;
          }
        }

        this.expect('RBRACKET');
        return arr;
      }

      parse(): unknown {
        const value = this.parseValue();
        this.expect('EOF');
        return value;
      }
    }

    const parser = new Parser(ionExpression);
    return parser.parse();
  },

  stringify(object: unknown): string {
    const seen = new WeakSet<object>();

    function stringifyValue(value: unknown, path: string): string {
      // Handle primitives
      if (value === null) return 'null';
      if (value === undefined) {
        throw new Error(`Cannot serialize undefined at ${path}`);
      }

      const type = typeof value;

      // Handle booleans
      if (type === 'boolean') {
        return value ? 'true' : 'false';
      }

      // Handle numbers
      if (type === 'number') {
        if (Number.isNaN(value)) return 'NaN';
        if (value === Infinity) return 'Infinity';
        if (value === -Infinity) return '-Infinity';
        return String(value);
      }

      // Handle strings
      if (type === 'string') {
        return JSON.stringify(value);
      }

      // Handle bigint - unsupported
      if (type === 'bigint') {
        throw new Error(`Cannot serialize BigInt at ${path}`);
      }

      // Handle functions - unsupported
      if (type === 'function') {
        throw new Error(`Cannot serialize function at ${path}`);
      }

      // Handle symbols - unsupported
      if (type === 'symbol') {
        throw new Error(`Cannot serialize symbol at ${path}`);
      }

      // Handle objects
      if (type === 'object' && value !== null) {
        // Circular reference check
        if (seen.has(value as object)) {
          throw new Error(`Circular reference detected at ${path}`);
        }
        seen.add(value as object);

        try {
          // Handle Date
          if (value instanceof Date) {
            if (isNaN(value.getTime())) {
              throw new Error(`Invalid Date at ${path}`);
            }
            return `date:${value.toISOString()}`;
          }

          // Handle WeakMap - unsupported
          if (value instanceof WeakMap) {
            throw new Error(`Cannot serialize WeakMap at ${path}`);
          }

          // Handle WeakSet - unsupported
          if (value instanceof WeakSet) {
            throw new Error(`Cannot serialize WeakSet at ${path}`);
          }

          // Handle Map
          if (value instanceof Map) {
            const entries: string[] = [];
            let index = 0;
            for (const [k, v] of value.entries()) {
              const keyStr = stringifyValue(k, `${path}[map key ${index}]`);
              const valueStr = stringifyValue(v, `${path}[map value ${index}]`);
              entries.push(`${keyStr}: ${valueStr}`);
              index++;
            }
            return `map { ${entries.join(', ')} }`;
          }

          // Handle Set
          if (value instanceof Set) {
            const values: string[] = [];
            let index = 0;
            for (const v of value.values()) {
              values.push(stringifyValue(v, `${path}[set item ${index}]`));
              index++;
            }
            return `set { ${values.join(', ')} }`;
          }

          // Handle Array
          if (Array.isArray(value)) {
            const items: string[] = [];
            for (let i = 0; i < value.length; i++) {
              items.push(stringifyValue(value[i], `${path}[${i}]`));
            }
            return `[${items.join(', ')}]`;
          }

          // Handle plain objects
          const entries: string[] = [];
          for (const [key, val] of Object.entries(value)) {
            // Skip undefined properties
            if (val === undefined) continue;

            const keyStr = JSON.stringify(key);
            const valueStr = stringifyValue(val, `${path}.${key}`);
            entries.push(`${keyStr}: ${valueStr}`);
          }
          return `{${entries.length > 0 ? ' ' : ''}${entries.join(', ')}${entries.length > 0 ? ' ' : ''}}`;
        } finally {
          seen.delete(value as object);
        }
      }

      throw new Error(`Cannot serialize value of type ${type} at ${path}`);
    }

    return stringifyValue(object, 'root');
  },
}

export default ION;
