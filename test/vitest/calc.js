function sum(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}

function mul(a, b) {
  // intentionally broken
  return a * (b + 1);
}

module.exports = { sum, sub, mul };
