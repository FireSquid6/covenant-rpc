


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
      private len: number;

      constructor(input: string) {
        this.input = input;
        this.len = input.length;
      }

      private skipWhitespace(): void {
        const input = this.input;
        const len = this.len;
        let pos = this.pos;

        while (pos < len) {
          const ch = input.charCodeAt(pos);
          // Check for common whitespace: space(32), tab(9), newline(10), carriage return(13)
          if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
            pos++;
          } else {
            break;
          }
        }

        this.pos = pos;
      }

      private scanString(): string {
        const input = this.input;
        const len = this.len;
        let pos = this.pos + 1; // skip opening quote
        let start = pos;

        // Fast path: scan for simple string without escapes
        while (pos < len) {
          const ch = input.charCodeAt(pos);

          if (ch === 34) { // '"'
            this.pos = pos + 1;
            return input.slice(start, pos);
          }

          if (ch === 92) { // '\\'
            // Found escape, switch to slow path
            break;
          }

          pos++;
        }

        // Slow path: handle escapes
        const parts: string[] = [];
        if (pos > start) {
          parts.push(input.slice(start, pos));
        }

        while (pos < len) {
          const ch = input.charCodeAt(pos);

          if (ch === 34) { // '"'
            this.pos = pos + 1;
            return parts.join('');
          }

          if (ch === 92) { // '\\'
            pos++;
            const escaped = input.charCodeAt(pos);
            pos++;

            switch (escaped) {
              case 110: parts.push('\n'); break; // 'n'
              case 116: parts.push('\t'); break; // 't'
              case 114: parts.push('\r'); break; // 'r'
              case 92: parts.push('\\'); break; // '\\'
              case 34: parts.push('"'); break; // '"'
              case 47: parts.push('/'); break; // '/'
              case 98: parts.push('\b'); break; // 'b'
              case 102: parts.push('\f'); break; // 'f'
              case 117: { // 'u'
                const hex = input.slice(pos, pos + 4);
                pos += 4;
                parts.push(String.fromCharCode(parseInt(hex, 16)));
                break;
              }
              default:
                throw new Error(`Invalid escape sequence at position ${pos}`);
            }
            start = pos;
          } else {
            // Accumulate unescaped chars
            const chunkStart = pos;
            pos++;
            while (pos < len) {
              const c = input.charCodeAt(pos);
              if (c === 34 || c === 92) break;
              pos++;
            }
            parts.push(input.slice(chunkStart, pos));
          }
        }

        throw new Error(`Unterminated string at position ${pos}`);
      }

      private scanNumber(): number {
        const input = this.input;
        const len = this.len;
        let pos = this.pos;
        const start = pos;

        // Check for negative
        if (input.charCodeAt(pos) === 45) { // '-'
          pos++;
        }

        // Scan integer part
        const firstDigit = input.charCodeAt(pos);
        if (firstDigit === 48) { // '0'
          pos++;
        } else if (firstDigit >= 49 && firstDigit <= 57) { // '1'-'9'
          pos++;
          while (pos < len && input.charCodeAt(pos) >= 48 && input.charCodeAt(pos) <= 57) {
            pos++;
          }
        }

        // Check for decimal
        let hasDot = false;
        if (pos < len && input.charCodeAt(pos) === 46) { // '.'
          hasDot = true;
          pos++;
          while (pos < len && input.charCodeAt(pos) >= 48 && input.charCodeAt(pos) <= 57) {
            pos++;
          }
        }

        // Check for exponent
        let hasExp = false;
        if (pos < len) {
          const ch = input.charCodeAt(pos);
          if (ch === 101 || ch === 69) { // 'e' or 'E'
            hasExp = true;
            pos++;
            if (pos < len) {
              const sign = input.charCodeAt(pos);
              if (sign === 43 || sign === 45) { // '+' or '-'
                pos++;
              }
            }
            while (pos < len && input.charCodeAt(pos) >= 48 && input.charCodeAt(pos) <= 57) {
              pos++;
            }
          }
        }

        this.pos = pos;

        // Fast path for simple integers
        if (!hasDot && !hasExp) {
          const numStr = input.slice(start, pos);
          const num = parseInt(numStr, 10);
          if (num.toString() === numStr) {
            return num;
          }
        }

        return parseFloat(input.slice(start, pos));
      }

      nextToken(): Token {
        this.skipWhitespace();

        const pos = this.pos;
        if (pos >= this.len) {
          return { type: 'EOF', position: pos };
        }

        const input = this.input;
        const ch = input.charCodeAt(pos);

        // Single character tokens (using charCode for speed)
        switch (ch) {
          case 123: // '{'
            this.pos = pos + 1;
            return { type: 'LBRACE', position: pos };
          case 125: // '}'
            this.pos = pos + 1;
            return { type: 'RBRACE', position: pos };
          case 91: // '['
            this.pos = pos + 1;
            return { type: 'LBRACKET', position: pos };
          case 93: // ']'
            this.pos = pos + 1;
            return { type: 'RBRACKET', position: pos };
          case 44: // ','
            this.pos = pos + 1;
            return { type: 'COMMA', position: pos };
          case 58: // ':'
            this.pos = pos + 1;
            return { type: 'COLON', position: pos };
          case 34: // '"'
            return { type: 'STRING', value: this.scanString(), position: pos };
        }

        // Number or -Infinity
        if (ch === 45 || (ch >= 48 && ch <= 57)) { // '-' or '0'-'9'
          // Check for -Infinity
          if (ch === 45 && input.slice(pos, pos + 9) === '-Infinity') {
            this.pos = pos + 9;
            return { type: 'NEG_INFINITY', position: pos };
          }
          return { type: 'NUMBER', value: this.scanNumber(), position: pos };
        }

        // Keywords - check first character for fast path
        const remaining = input.slice(pos);

        if (ch === 73) { // 'I'
          if (remaining.startsWith('Infinity')) {
            this.pos = pos + 8;
            return { type: 'INFINITY', position: pos };
          }
        } else if (ch === 78) { // 'N'
          if (remaining.startsWith('NaN')) {
            this.pos = pos + 3;
            return { type: 'NAN', position: pos };
          }
        } else if (ch === 116) { // 't'
          if (remaining.startsWith('true')) {
            this.pos = pos + 4;
            return { type: 'TRUE', position: pos };
          }
        } else if (ch === 102) { // 'f'
          if (remaining.startsWith('false')) {
            this.pos = pos + 5;
            return { type: 'FALSE', position: pos };
          }
        } else if (ch === 110) { // 'n'
          if (remaining.startsWith('null')) {
            this.pos = pos + 4;
            return { type: 'NULL', position: pos };
          }
        } else if (ch === 100) { // 'd'
          if (remaining.startsWith('date:')) {
            this.pos = pos + 5;
            const start = this.pos;
            // Scan until whitespace or delimiter
            while (this.pos < this.len) {
              const c = input.charCodeAt(this.pos);
              if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44 || c === 125 || c === 93) { // whitespace or , } ]
                break;
              }
              this.pos++;
            }
            const dateStr = input.slice(start, this.pos);
            return { type: 'DATE', value: dateStr, position: pos };
          }
        } else if (ch === 109) { // 'm'
          if (remaining.startsWith('map')) {
            this.pos = pos + 3;
            return { type: 'MAP', position: pos };
          }
        } else if (ch === 115) { // 's'
          if (remaining.startsWith('set')) {
            this.pos = pos + 3;
            return { type: 'SET', position: pos };
          }
        }

        throw new Error(`Unexpected character '${input[pos]}' at position ${pos}`);
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
        const token = this.currentToken;
        if (token.type !== type) {
          throw new Error(
            `Expected ${type} but got ${token.type} at position ${token.position}`
          );
        }
        this.advance();
        return token;
      }

      private parseValue(): unknown {
        const token = this.currentToken;
        const type = token.type;

        // Inline simple cases for speed
        switch (type) {
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

          case 'DATE': {
            this.advance();
            const dateStr = token.value as string;
            const date = new Date(dateStr);
            const time = date.getTime();
            if (time !== time) { // isNaN check
              throw new Error(`Invalid date string "${dateStr}" at position ${token.position}`);
            }
            return date;
          }

          case 'LBRACKET': {
            this.advance(); // consume '['
            const arr: unknown[] = [];

            if (this.currentToken.type === 'RBRACKET') {
              this.advance();
              return arr;
            }

            while (true) {
              arr.push(this.parseValue());

              const currentType = this.currentToken.type as TokenType;
              if (currentType === 'COMMA') {
                this.advance();
                continue;
              }
              if (currentType === 'RBRACKET') {
                this.advance();
                break;
              }
              throw new Error(
                `Expected COMMA or RBRACKET but got ${currentType} at position ${this.currentToken.position}`
              );
            }

            return arr;
          }

          case 'LBRACE': {
            this.advance(); // consume '{'
            const obj: Record<string, unknown> = {};

            if (this.currentToken.type === 'RBRACE') {
              this.advance();
              return obj;
            }

            while (true) {
              const keyToken = this.currentToken;
              if (keyToken.type !== 'STRING') {
                throw new Error(
                  `Expected STRING but got ${keyToken.type} at position ${keyToken.position}`
                );
              }
              this.advance();
              const key = keyToken.value as string;

              this.expect('COLON');

              obj[key] = this.parseValue();

              const currentType = this.currentToken.type as TokenType;
              if (currentType === 'COMMA') {
                this.advance();
                continue;
              }
              if (currentType === 'RBRACE') {
                this.advance();
                break;
              }
              throw new Error(
                `Expected COMMA or RBRACE but got ${currentType} at position ${this.currentToken.position}`
              );
            }

            return obj;
          }

          case 'MAP': {
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

              const currentType = this.currentToken.type as TokenType;
              if (currentType === 'COMMA') {
                this.advance();
                continue;
              }
              if (currentType === 'RBRACE') {
                this.advance();
                break;
              }
              throw new Error(
                `Expected COMMA or RBRACE but got ${currentType} at position ${this.currentToken.position}`
              );
            }

            return map;
          }

          case 'SET': {
            this.advance(); // consume 'set'
            this.expect('LBRACE');

            const set = new Set();

            if (this.currentToken.type === 'RBRACE') {
              this.advance();
              return set;
            }

            while (true) {
              set.add(this.parseValue());

              const currentType = this.currentToken.type as TokenType;
              if (currentType === 'COMMA') {
                this.advance();
                continue;
              }
              if (currentType === 'RBRACE') {
                this.advance();
                break;
              }
              throw new Error(
                `Expected COMMA or RBRACE but got ${currentType} at position ${this.currentToken.position}`
              );
            }

            return set;
          }

          default:
            throw new Error(
              `Unexpected token ${type} at position ${token.position}`
            );
        }
      }

      parse(): unknown {
        const value = this.parseValue();
        if (this.currentToken.type !== 'EOF') {
          throw new Error(
            `Expected EOF but got ${this.currentToken.type} at position ${this.currentToken.position}`
          );
        }
        return value;
      }
    }

    const parser = new Parser(ionExpression);
    return parser.parse();
  },

  stringify(object: unknown): string {
    const seen = new WeakSet<object>();

    function stringifyValue(value: unknown): string {
      // Handle null first (most common primitive in many use cases)
      if (value === null) return 'null';

      const type = typeof value;

      // Handle primitives (optimized order: most common first)
      if (type === 'string') {
        // Inline simple string escaping for common cases
        const len = (value as string).length;
        let needsEscape = false;
        for (let i = 0; i < len; i++) {
          const ch = (value as string).charCodeAt(i);
          if (ch === 34 || ch === 92 || ch < 32) {
            needsEscape = true;
            break;
          }
        }
        if (!needsEscape) {
          return `"${value}"`;
        }
        return JSON.stringify(value);
      }

      if (type === 'number') {
        // Fast path for normal numbers
        if (value === (value as number)) { // NaN check (NaN !== NaN)
          if (isFinite(value as number)) {
            return String(value);
          }
          // Handle Infinity
          return value === Infinity ? 'Infinity' : '-Infinity';
        }
        return 'NaN';
      }

      if (type === 'boolean') {
        return value ? 'true' : 'false';
      }

      if (value === undefined) {
        throw new Error('Cannot serialize undefined');
      }

      // Handle unsupported primitives early
      if (type === 'bigint') {
        throw new Error('Cannot serialize BigInt');
      }
      if (type === 'function') {
        throw new Error('Cannot serialize function');
      }
      if (type === 'symbol') {
        throw new Error('Cannot serialize symbol');
      }

      // Handle objects - type === 'object' at this point
      // Circular reference check
      if (seen.has(value as object)) {
        throw new Error('Circular reference detected');
      }
      seen.add(value as object);

      try {
        // Order by frequency: Array -> Plain Object -> Date -> Map -> Set -> Unsupported

        // Handle Array (very common)
        if (Array.isArray(value)) {
          const len = value.length;
          if (len === 0) return '[]';

          let result = '[';
          for (let i = 0; i < len; i++) {
            if (i > 0) result += ', ';
            result += stringifyValue(value[i]);
          }
          result += ']';
          return result;
        }

        // Handle Date before checking for plain objects
        if (value instanceof Date) {
          const time = value.getTime();
          if (time !== time) { // isNaN check
            throw new Error('Invalid Date');
          }
          return `date:${value.toISOString()}`;
        }

        // Handle Map
        if (value instanceof Map) {
          if (value.size === 0) return 'map {  }';

          let result = 'map { ';
          let first = true;
          for (const [k, v] of value) {
            if (!first) result += ', ';
            first = false;
            result += stringifyValue(k);
            result += ': ';
            result += stringifyValue(v);
          }
          result += ' }';
          return result;
        }

        // Handle Set
        if (value instanceof Set) {
          if (value.size === 0) return 'set {  }';

          let result = 'set { ';
          let first = true;
          for (const v of value) {
            if (!first) result += ', ';
            first = false;
            result += stringifyValue(v);
          }
          result += ' }';
          return result;
        }

        // Handle WeakMap/WeakSet (must check before plain objects)
        if (value instanceof WeakMap) {
          throw new Error('Cannot serialize WeakMap');
        }
        if (value instanceof WeakSet) {
          throw new Error('Cannot serialize WeakSet');
        }

        // Handle plain objects (most common object type)
        const keys = Object.keys(value);
        const len = keys.length;
        if (len === 0) return '{}';

        let result = '{ ';
        let first = true;
        for (let i = 0; i < len; i++) {
          const key = keys[i]!;
          const val = (value as Record<string, unknown>)[key];

          // Skip undefined properties
          if (val === undefined) continue;

          if (!first) result += ', ';
          first = false;

          // Inline string key escaping
          let keyStr: string;
          const keyLen = key.length;
          let needsEscape = false;
          for (let j = 0; j < keyLen; j++) {
            const ch = key.charCodeAt(j);
            if (ch === 34 || ch === 92 || ch < 32) {
              needsEscape = true;
              break;
            }
          }
          keyStr = needsEscape ? JSON.stringify(key) : `"${key}"`;

          result += keyStr;
          result += ': ';
          result += stringifyValue(val);
        }
        result += ' }';
        return result;
      } finally {
        seen.delete(value as object);
      }
    }

    return stringifyValue(object);
  },
}

export default ION;
