# Runtime dialog

No debugger was attached. No button was clicked. A second `MapleStory.exe` was not started: PID 23452 was already running, and its parent PID is 15492, the same parent recorded in Task 005.

| Field | Value |
| --- | --- |
| observation time | 2026-10-09 18:17:26 local |
| process start | 2026-10-09 16:31:37 local |
| PID | 23452 |
| parent PID | 15492 |
| command line | not visible to this token |
| HWND | `0x50ACE` (330446) |
| class | `#32770` |
| title | MapleStory |
| UI Automation help | empty |
| descendants | one `Button` named `OK` |
| static text | none |
| other button text | none |

`Enum`/`GetWindowText` style child text from Task 005 was already only `&OK`. This pass used UI Automation `Name`, `ClassName`, and `HelpText` on the same top-level window and on its descendants. The body is not exposed as Win32 static text or as an automation name.

Classification: unknown. The visible strings are the title and the OK button. That is not enough to call it a compatibility error, a HackShield message, a network error, a launcher requirement, or a protector self-check. The sentence previously seen under a debugger is not on this window.
