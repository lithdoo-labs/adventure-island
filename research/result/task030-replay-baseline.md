# Task 030 — Replay baseline

STARTING_HEAD `73e9d37cba8703d8800167eef58eb1d1e654e146` (clean; the Task
030 spec commit). Sample `MapleStory.exe` SHA-256 `5d280cf1…` revalidated
(unchanged). Tools: Python 3.14.4 / Unicorn 2.1.4 / Capstone 5.0.7.

Baseline: corridor checkpoint resume reproduces count **20,211,773** /
`unmapped:0x80a7c4d` / 1 box — identical to the Task 028 checkpoint
determinism ledger. After the campaign's tooling changes (watch-list,
`--write-log`, checkpoint clock-scale override fix), the default
configuration is signature-identical to the pre-change baseline
(`regress.sig.json` == `baseline.sig.json` on count/why/regs/image/apilog
hashes) — regression-clean.

One replay-script defect was found and fixed during the campaign:
checkpoint resume previously overwrote the command-line `--clock-scale`
with the checkpoint-saved value, silently neutralizing Task 028's clock
experiments **when run from the checkpoint**. Full-run experiments (all
of Task 027/028's sweeps) were unaffected; the Task 030 diagnostic sweep
(rebuilt from the checkpoint) now applies the requested scale correctly.
