/* Read-only observer for historical debugger device names.
 * Opens each path with CreateFileA, records the handle and GetLastError,
 * and closes a handle only if the open succeeded.
 * It does not create a device, install a driver, or write the registry.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>

static void observe(const char *path) {
    HANDLE handle;
    DWORD error;

    SetLastError(0);
    handle = CreateFileA(
        path,
        GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        NULL,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        NULL);
    error = GetLastError();
    if (handle == INVALID_HANDLE_VALUE) {
        printf("path=%s handle=INVALID_HANDLE_VALUE error=%lu\n", path, error);
        return;
    }
    printf("path=%s handle=%p error=%lu\n", path, handle, error);
    CloseHandle(handle);
}

int main(void) {
    observe("\\\\.\\SICE");
    observe("\\\\.\\SIWVID");
    observe("\\\\.\\NTICE");
    return 0;
}
