const ESCAPE_BY_CHARACTER = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ESCAPE_BY_CHARACTER[character]);
}

export function html(strings, ...values) {
  return strings.reduce(
    (rendered, literal, index) => rendered + escape(values[index - 1]) + literal,
  );
}
