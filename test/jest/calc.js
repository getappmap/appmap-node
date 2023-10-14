function sum(x, y) {
  return x + y;
}

function sub(x, y) {
  // intentionally broken
  return y - x;
}

module.exports = { sum, sub };
