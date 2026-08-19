export const MAX_BODY_BYTES = 1_048_576;

export async function readBody(request, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error(`body too large: over ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
