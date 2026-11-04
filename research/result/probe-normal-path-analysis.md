# Which SICE edge is the ordinary path

The four kinds of evidence are kept separate.

## Observed on this host

`CreateFileA("\\.\SICE")` with this client's argument list returned `0xFFFFFFFF`. `GetLastError` was 2. `\\.\SIWVID` and `\\.\NTICE` did the same. The three service keys and both WinLicense registry keys are absent. No branch in MapleStory was executed to obtain that.

## Documented Windows behavior

`OPEN_EXISTING` on a device that is not there fails. The return is `INVALID_HANDLE_VALUE`. The last-error for that case is `ERROR_FILE_NOT_FOUND`. A successful return is a handle other than `0xFFFFFFFF`.

## Static fact from Task 009

`0x00859779` is `inc eax`. `0x0085977A` is `jne 0x00859A61`. `inc` of `0xFFFFFFFF` falls through to `0x00859780`. Any other handle goes to `0x00859A61`. The fall-through span contains the `lea` of `\\.\SIWVID` at `0x00859882` and of `\\.\NTICE` at `0x008599BF`.

## Reference-supported expectation

MeltICE (1997) uses the same access, share, disposition, and attribute constants. It treats `INVALID_HANDLE_VALUE` as "SoftICE not loaded" and continues. It treats any other handle as "loaded". OpenRCE (2006) checks `\\.\SICE`, then `\\.\SIWVID`, then `\\.\NTICE`, and treats EAX other than `-1` as found.

## Inference

On this host, and on any Windows installation without those device objects, the SICE call fails and the `inc eax` test falls through. **`0x00859780` is the normal-environment edge.** Confidence is high. The present edge `0x00859A61` is the historical debugger-present edge. It was not taken here, and its later behavior is still unknown.

The SIWVID and NTICE loads sit on the absent side, in the same order as the 2006 list. That supports "the normal path keeps probing the next device name". It does not prove that those later calls have already run in this client. Only the SICE `CreateFileA` was reached.

This correlation does not authorize returning `INVALID_HANDLE_VALUE` from the emulator. The next step is static reading of the `0x00859780` side, or a natural run in an environment that really has no such device.
