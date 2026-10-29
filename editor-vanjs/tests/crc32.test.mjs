import test from 'node:test';
import assert from 'node:assert/strict';
import oldCrc32 from 'crc/crc32';
import { crc32 } from 'shared-vuejs/api/lib-crc32';

test('shared CRC-32 preserves existing hashes for filenames and image bytes', () => {
  const bytes = new Uint8Array([0, 128, 255, 65, 0, 33]);
  for (const input of ['', 'photo.png', '图片😀.webp', 'data:image/png;base64,AQID', bytes, bytes.buffer, bytes.subarray(1, 4)]) {
    assert.equal(crc32(input), oldCrc32(input));
  }
  assert.equal(crc32('123456789'), 0xcbf43926);
});
