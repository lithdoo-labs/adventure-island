# Passive runtime observation

One launch was attempted: `MapleStory.exe 127.0.0.1 9555`, working directory the extracted client folder, no debugger and no injected DLL.

`CreateProcess` failed immediately with WinError 740 (`ERROR_ELEVATION_REQUIRED`). The process was not created. No UAC prompt was raised from this session. A process snapshot showed no already-running `MapleStory.exe` to observe instead.

Because there was no process:

- lifetime, module list, and window titles were not collected
- no file or registry trace was attached
- TCP ports 9555, 7575–7578, and 8600 were not contacted by a new client
- Tail A and the Ztl slots were not queried with `VirtualQueryEx`
- no new executable region was observed at runtime

The static CFG does not depend on that launch. It already places the next stage inside Tail B, at the self-decode boundary `0x0085A464`.
