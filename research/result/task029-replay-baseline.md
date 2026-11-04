# Task 029 — Replay baseline (D-gate)

STARTING_HEAD `dfcd7f414af25987aa6dd98ee569e91e107e3d4d` (clean, ff-only
up to date with origin). Sample `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
revalidated. Tools: Python 3.14.4, Unicorn 2.1.4, Capstone 5.0.7,
pefile; host Win11 x64. Guest DLLs: Task 027 ISO-extracted set,
unchanged.

Baseline reproduction (Task 028 final default configuration, post
F1-F4 fidelity fixes): corridor entry n=18,865,228 (checkpoint resume
works, ~30 s), terminal state count **20,211,772**, `unmapped:0x80a7c4d`
after the Themida box — identical to the Task 028 canonical baseline.
No fidelity changes were needed this task (none applied); the corridor
trace and decoded-image dump from Task 028 were reused as analysis
inputs (both revalidated: dispatch-log extraction yields 4489 dispatches;
dump contains the handler table and the 0x2E3D5322 constant).
