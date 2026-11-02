# Adventure Island Issue Agent E2E

Hello Adventure Island — this document is the acceptance test for the Adventure Island Issue Agent, which automatically creates a Draft PR (`agent/issue-N`) via GitHub Actions on the `opencode-lithdoo-labs` runner. A subsequent `/agent revise` on the same Issue must continue the original PR and the original OpenCode session, verifying the full two-turn loop while this test PR stays unmerged.
