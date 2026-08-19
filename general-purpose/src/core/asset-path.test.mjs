import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAssetPath } from './asset-path.mjs';

test('the root path resolves to the index document', () => {
  assert.equal(resolveAssetPath('/'), 'index.html');
});

test('a plain asset path resolves to its relative form', () => {
  assert.equal(resolveAssetPath('/styles.css'), 'styles.css');
  assert.equal(resolveAssetPath('/a/b.js'), 'a/b.js');
});

test('percent-encoded characters decode into the resolved path', () => {
  assert.equal(resolveAssetPath('/hello%20world.txt'), 'hello world.txt');
});

test('parent-directory segments are refused, plain or encoded', () => {
  assert.equal(resolveAssetPath('/../secret'), null);
  assert.equal(resolveAssetPath('/a/../../secret'), null);
  assert.equal(resolveAssetPath('/%2e%2e/%2e%2e/etc/passwd'), null);
  assert.equal(resolveAssetPath('/..%2fsecret'), null);
});

test('malformed percent-encoding is refused, not thrown', () => {
  assert.equal(resolveAssetPath('/%zz'), null);
  assert.equal(resolveAssetPath('/%'), null);
});

test('null bytes and backslashes are refused', () => {
  assert.equal(resolveAssetPath('/a%00b'), null);
  assert.equal(resolveAssetPath('/a%5c..%5cb'), null);
});

test('paths that resolve to nothing are refused', () => {
  assert.equal(resolveAssetPath('//'), null);
  assert.equal(resolveAssetPath('/.'), null);
  assert.equal(resolveAssetPath(''), null);
});

test('non-string input is refused', () => {
  assert.equal(resolveAssetPath(undefined), null);
  assert.equal(resolveAssetPath(42), null);
});
