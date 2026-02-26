const global = "Hello";

// eslint-disable-next-line no-shadow-restricted-names
function shadow(global, globalThis) {
  console.log(global, globalThis);
}

shadow(global, "World");
