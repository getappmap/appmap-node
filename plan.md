plan:
- make the recorder memory-based (dump at finish)
- allow fixing up in-place
- fork into new recorder on function call and then integrate it up on end/fixup
- make the recorders per-async-context
- recover unfulfilled promises
questions:
- do event ids need to be monotonic? — no!
- how to handle delayed calls — eg. event callbacks?
