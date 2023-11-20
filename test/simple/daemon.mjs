process.stdin.resume();

function stop() {
  console.log("stopping daemon");
  process.exitCode = 42;
  process.stdin.pause();
}

process.on("SIGINT", () => stop());

console.log("starting daemon...");
