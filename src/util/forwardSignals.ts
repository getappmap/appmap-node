import type { ChildProcess } from "child_process";

export default function forwardSignals(
  proc: Pick<ChildProcess, "kill">,
  signals = DEFAULT_FORWARD,
) {
  const forward = proc.kill.bind(proc);
  for (const signal of signals) process.on(signal, forward);
}

const DEFAULT_FORWARD: NodeJS.Signals[] = [
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGBREAK",
  "SIGLOST",
  "SIGINFO",
];
