function arSzamol(darab) {
  var n = parseInt(darab, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 50) n = 50;
  return 20000 + (n - 1) * 15000;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { arSzamol };
if (typeof window !== 'undefined') window.arSzamol = arSzamol;
