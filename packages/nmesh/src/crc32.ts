const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return crc;
});

export function crc32(bytes: Uint8Array, end: number): number {
  let crc = 0xffff_ffff;
  for (let index = 0; index < end; index++) {
    crc =
      (crc >>> 8) ^ (table[(crc ^ (bytes[index] as number)) & 255] as number);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}
