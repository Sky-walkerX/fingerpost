/** Reads baseline/progressive JPEG dimensions without decoding or retaining image content. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  const invalid = () => new Error('Invalid JPEG dimensions');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw invalid();
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xda || marker === 0xd9 || marker === 0) throw invalid();
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw invalid();
    const length = bytes[offset]! * 256 + bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) throw invalid();
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8) throw invalid();
      const height = bytes[offset + 3]! * 256 + bytes[offset + 4]!;
      const width = bytes[offset + 5]! * 256 + bytes[offset + 6]!;
      const components = bytes[offset + 7]!;
      if (!width || !height || !components || length < 8 + components * 3) throw invalid();
      return { width, height };
    }
    offset += length;
  }
  throw invalid();
}
