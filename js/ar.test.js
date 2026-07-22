const test = require('node:test');
const assert = require('node:assert');
const { arSzamol } = require('./ar.js');

test('1 klíma = 20000', () => assert.strictEqual(arSzamol(1), 20000));
test('3 klíma = 50000', () => assert.strictEqual(arSzamol(3), 50000));
test('0 vagy érvénytelen → minimum 1 klíma ára', () => assert.strictEqual(arSzamol(0), 20000));
test('szöveg bemenet → 20000', () => assert.strictEqual(arSzamol('x'), 20000));
