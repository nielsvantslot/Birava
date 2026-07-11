export async function streamToBuffer(stream: ReadableStream<Uint8Array> | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;

  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
