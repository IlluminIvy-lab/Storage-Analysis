/**
 * Lightweight browser-native PDF text extractor.
 * Attempts real text extraction from PDF streams (including FlateDecode compressed streams).
 * If the PDF is scanned (image-only), encrypted, or contains no extractable text,
 * honestly returns success: false so the app can mark content as "unavailable".
 */

async function decompressFlate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') {
    return null;
  }

  // 1. Try standard zlib format ('deflate')
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch {
    // 2. Try raw deflate without header ('deflate-raw')
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      // If zlib header was present (e.g. 78 9c or 78 01), skip 2 bytes
      const sliceData = data.length > 2 && data[0] === 0x78 ? data.slice(2) : data;
      writer.write(sliceData);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } catch {
      return null;
    }
  }
}

function unescapePdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\b/g, '')
    .replace(/\\f/g, '')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractTextFromStreamContent(content: string): string[] {
  const words: string[] = [];

  // Match text objects BT ... ET
  const btEtRegex = /BT[\s\S]*?ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = btEtRegex.exec(content)) !== null) {
    const block = blockMatch[0];

    // 1. Array TJ operator: [(string1) 120 (string2)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
      const arrayContent = tjMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = strRegex.exec(arrayContent)) !== null) {
        const unescaped = unescapePdfString(sMatch[1]).trim();
        if (unescaped.length > 0) {
          words.push(unescaped);
        }
      }
    }

    // 2. Simple string Tj / ' / " operator: (string) Tj
    const singleTjRegex = /\(([^)]*)\)\s*(?:Tj|'|")/g;
    let sTjMatch: RegExpExecArray | null;
    while ((sTjMatch = singleTjRegex.exec(block)) !== null) {
      const unescaped = unescapePdfString(sTjMatch[1]).trim();
      if (unescaped.length > 0) {
        words.push(unescaped);
      }
    }
  }

  return words;
}

/**
 * Extracts substantive readable text from a PDF ArrayBuffer.
 * Returns success: true and extracted text if real readable text is found.
 * Returns success: false if no text streams exist (e.g. scanned image PDF).
 */
export async function extractTextFromPdf(
  buffer: ArrayBuffer
): Promise<{ text: string; success: boolean }> {
  try {
    const uint8 = new Uint8Array(buffer);
    if (uint8.length < 10) {
      return { text: '', success: false };
    }

    // Check %PDF- header
    const headerStr = new TextDecoder('latin1').decode(uint8.slice(0, 8));
    if (!headerStr.includes('%PDF-')) {
      return { text: '', success: false };
    }

    // Scan for streams in the PDF
    const latin1Text = new TextDecoder('latin1').decode(uint8);
    const collectedWords: string[] = [];

    // Find stream boundaries
    const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(latin1Text)) !== null) {
      const dictStr = match[1];
      const streamStart = streamRegex.lastIndex;
      const endStreamIndex = latin1Text.indexOf('endstream', streamStart);

      if (endStreamIndex === -1) continue;

      const rawStreamBytes = uint8.slice(streamStart, endStreamIndex);
      const isFlate = dictStr.includes('/FlateDecode');

      let streamText = '';
      if (isFlate) {
        const decompressed = await decompressFlate(rawStreamBytes);
        if (decompressed) {
          streamText = new TextDecoder('latin1').decode(decompressed);
        }
      } else {
        streamText = new TextDecoder('latin1').decode(rawStreamBytes);
      }

      if (streamText && streamText.includes('BT')) {
        const extracted = extractTextFromStreamContent(streamText);
        if (extracted.length > 0) {
          collectedWords.push(...extracted);
        }
      }
    }

    // Fallback: If BT...ET blocks were not parsed, check uncompressed text in the entire document
    if (collectedWords.length === 0 && latin1Text.includes('BT')) {
      const extracted = extractTextFromStreamContent(latin1Text);
      if (extracted.length > 0) {
        collectedWords.push(...extracted);
      }
    }

    const combinedText = collectedWords.join(' ').replace(/\s+/g, ' ').trim();

    // Verify whether substantive readable text was extracted
    // Must be at least 25 characters and contain at least 4 word tokens with letters
    const wordTokens = combinedText.split(' ').filter((w) => /[a-zA-Z]{2,}/.test(w));
    if (combinedText.length >= 25 && wordTokens.length >= 4) {
      return { text: combinedText, success: true };
    }

    // No substantive text found (e.g. scanned image PDF or graphics-only)
    return { text: '', success: false };
  } catch (err) {
    console.warn('PDF text extraction error:', err);
    return { text: '', success: false };
  }
}
