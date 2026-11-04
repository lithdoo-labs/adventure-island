# Protector resolver, not game code

The code that walks kernel32 and calls `LoadLibraryA` is still inside Tail B. It is the output of round 1, which is a high-entropy in-place transform. Round 2 raises instruction density inside its own span and still leaves one MSVC prologue, no `.?AV` / `.?AU`, no WZ string, no Winsock string, and no AES or IV constant.

The resolved names are `LoadLibraryA`, `GetLocalTime`, and `MessageBoxExA`, plus the bases of `user32.dll`, `advapi32.dll`, and `ntdll.dll`. That is a protector import step. It is not a game import table and not a packet dispatcher.

No game-like region is present. The Ztl slots are still empty. Classification of the walker: protector resolver.
