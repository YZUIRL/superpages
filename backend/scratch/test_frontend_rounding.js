const roundToNearest5Minutes = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const ms = 1000 * 60 * 5;
  const rounded = new Date(Math.round(d.getTime() / ms) * ms);

  const pad = (n) => String(n).padStart(2, '0');
  const year = rounded.getFullYear();
  const month = pad(rounded.getMonth() + 1);
  const day = pad(rounded.getDate());
  const hours = pad(rounded.getHours());
  const minutes = pad(rounded.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

console.log('Test 1:', roundToNearest5Minutes('2026-11-16T14:12'));
console.log('Test 2:', roundToNearest5Minutes('2026-11-16T14:13'));
console.log('Test 3:', roundToNearest5Minutes('2026-11-16T23:58'));
console.log('Test 4:', roundToNearest5Minutes('2026-11-16T14:25'));
console.log('Test 5:', roundToNearest5Minutes(''));

if (
  roundToNearest5Minutes('2026-11-16T14:12') === '2026-11-16T14:10' &&
  roundToNearest5Minutes('2026-11-16T14:13') === '2026-11-16T14:15' &&
  roundToNearest5Minutes('2026-11-16T23:58') === '2026-11-17T00:00' &&
  roundToNearest5Minutes('2026-11-16T14:25') === '2026-11-16T14:25' &&
  roundToNearest5Minutes('') === ''
) {
  console.log('ALL FRONTEND ROUNDING TESTS PASSED!');
} else {
  console.error('TESTS FAILED');
  process.exit(1);
}
