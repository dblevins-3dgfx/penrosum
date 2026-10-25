# Keep SPEC.md in step with the code

`SPEC.md` describes the game as it is implemented. Any change the player can see, or that changes what is stored (play, the board, the screen, the rule options, the top 10), updates `SPEC.md` in the same pull request. The PR description names the spec sections that changed, or says why none needed to.

Every open question has a permanent number (Q1, Q2, ...). A new question takes the next number, which the spec's Open questions section names; update that note when you use it. Never renumber a question or reuse a number, and refer to questions by number in the spec, the game (the How to play dialog lists any open ones), pull requests and commits.

When an open question in `SPEC.md` is decided, move the answer into the Rules section and remove the options that lost, from the spec, the code and the tests. Then add a row to the spec's **Resolved questions** section: its number, the date, the question, the options tried, the decision, what changed, the reason if one was given, and the pull request.

# Test every spec rule

A pull request that adds or changes a rule in `SPEC.md` adds or updates the unit tests for it (`src/lib/*.test.ts`) in the same pull request. Put the rule's logic in a plain function in `src/lib` so it can be tested; React hooks and components should only call it. A rule that can't be unit-tested (storage, pointer events, drawing, layout) gets a row in `untested-requirements.md` saying where it lives and why. Remove a row from that file when its rule gains a test.
