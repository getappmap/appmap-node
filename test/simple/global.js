const global = "Hello";

function shadow(global, globalThis) {
  console.log(global, globalThis);
}

shadow(global, "World");
