import assert from 'node:assert/strict';
import test from 'node:test';

import { html } from './html.mjs';

test('literal parts pass through untouched', () => {
  assert.equal(html`<p>hello</p>`, '<p>hello</p>');
});

test('interpolated values are escaped', () => {
  const hostile = `<script>alert("x&y")</script>'`;
  assert.equal(
    html`<p>${hostile}</p>`,
    `<p>&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;</p>`,
  );
});

test('non-string values are stringified before escaping', () => {
  assert.equal(html`<p>${42}</p>`, '<p>42</p>');
});
