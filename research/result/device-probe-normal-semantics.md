# Device-probe semantics on ordinary Windows

This page documents the API. It is not an emulator result. The handle was not written into the stage-2 replay.

## What `\\.\` means

[CreateFileA](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea) opens a file or an I/O device. A path that begins with `\\.\` names a device in the Win32 device namespace, not a normal directory. The same page says that for devices other than files, `dwCreationDisposition` is usually `OPEN_EXISTING` (3).

## The call this client makes

```text
CreateFileA(
  "\\.\SICE",
  GENERIC_READ | GENERIC_WRITE,   /* 0xC0000000 */
  3,                              /* FILE_SHARE_READ | FILE_SHARE_WRITE */
  NULL,
  OPEN_EXISTING,                  /* 3 */
  FILE_ATTRIBUTE_NORMAL,          /* 0x80 */
  NULL)
```

Microsoft's contract for `OPEN_EXISTING`:

- If the named file or device exists and the access is allowed, the return is a handle.
- If it does not exist, the function fails, the return is `INVALID_HANDLE_VALUE` (`0xFFFFFFFF`), and `GetLastError` is `ERROR_FILE_NOT_FOUND` (2).

A missing device object is the ordinary case on a system that has never loaded SoftICE. Success means the object was present and the requested access was granted. Access can also fail with a different last-error, such as `ERROR_ACCESS_DENIED` (5), when the object exists but the caller may not open it. That case is not the "no such device" case.

## The three names

| Path | Historical object | Ordinary result when that object is absent |
| --- | --- | --- |
| `\\.\SICE` | SoftICE Win9x device. MeltICE (1997) treats a non-`INVALID_HANDLE_VALUE` handle as SoftICE for Windows 95. | `INVALID_HANDLE_VALUE`, `ERROR_FILE_NOT_FOUND` |
| `\\.\NTICE` | SoftICE NT debugger. The April 1999 Compuware manual names the driver `NTICE.SYS`. MeltICE opens `\\.\NTICE` with the same argument pattern. | same |
| `\\.\SIWVID` | SoftICE video support. The 1999 manual names `SIWVID.386` on Windows 95/98 and `SIWVID.SYS` on Windows NT. OpenRCE (2006) opens `\\.\SIWVID` in the same list as `SICE` and `NTICE`. | same |

None of these paths creates the device. `OPEN_EXISTING` only opens an object the system already has.

## How the public checks use the return

MeltICE compares the handle with `INVALID_HANDLE_VALUE`. Equal means SoftICE was not found and the sample continues. Not equal means it was found, and the sample closes the handle. OpenRCE compares with `-1` and treats any other EAX as "tool found".

That is the same predicate as this client's `inc eax; jne`. `inc` of `0xFFFFFFFF` is zero and falls through. Any other handle is non-zero after `inc` and is taken. The public sources call the fall-through the not-present case and the taken edge the present case.
