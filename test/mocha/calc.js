function multiply(x, y) {
  return x * y;
}

function power(x, y) {
  // Intentional bug for a failed test example:
  // The order of exponentiation is swapped (y ** x instead of x ** y)
  return  y ** x;
}

module.exports = { multiply, power };
