const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
export const ean13Check = (d12: string) => (10 - (d12.split('').reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
/** 95-module bar pattern for a valid 13-digit code, or null. */
export function ean13Bits(code: string): string | null {
  if (!/^\d{13}$/.test(code) || ean13Check(code.slice(0, 12)) !== Number(code[12])) return null;
  const p = PARITY[Number(code[0])]!;
  let s = '101';
  for (let i = 1; i <= 6; i++) s += (p[i - 1] === 'L' ? L : G)[Number(code[i])];
  s += '01010';
  for (let i = 7; i <= 12; i++) s += R[Number(code[i])];
  return s + '101';
}
