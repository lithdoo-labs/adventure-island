# CMS079 client inventory of the runner `/shared` directory

Discovery-only inspection performed on 2026-11-04. `/shared` was treated as read-only
input: nothing under `/shared` was modified, moved, unpacked, or executed, and no
client asset was copied into this repository.

## Verdict

**FOUND — a likely CMS079 (MapleStory v079-era) client is present under `/shared`,
already extracted and directly usable.** It is not a pristine official client: it is a
Chinese private-server repack ("怀旧岛079V5" / Nostalgia Island 079 V5), but its game
executable self-identifies as version `1.0.0.79` and the complete standard v079 WZ set
is present and structurally valid.

## What exists under `/shared`

`/shared` contains exactly one top-level entry, `CMS079`, which holds a matched
client/server package (dated 2017, author "江浩"):

| Path | Kind | Size |
| --- | --- | --- |
| `/shared/CMS079/怀旧岛079V5客户端/冒险岛online` | **extracted game client (the candidate)** | 3,488,215,967 B (~3.25 GiB), 142 files |
| `/shared/CMS079/怀旧岛079V5客户端.rar` | RAR archive of the same client | 2,351,327,020 B |
| `/shared/CMS079/怀旧岛079V5服务端_/079V5` | extracted server (OdinMS-style Java + MySQL + extracted WZ XML) | — |
| `/shared/CMS079/怀旧岛079V5服务端..rar` | RAR archive of the server | 403,341,265 B |

**Recommended root: `/shared/CMS079/怀旧岛079V5客户端/冒险岛online`** (the
`冒险岛online` directory is the client itself; `怀旧岛079V5客户端` is just its
wrapper folder).

## Client root inventory

All 17 `.wz` files plus the game executable, in `…/怀旧岛079V5客户端/冒险岛online`:

| File | Size (bytes) | mtime |
| --- | ---: | --- |
| `MapleStory.exe` | 3,889,632 | 2010-01-31 |
| `Base.wz` | 8,885 | 2010-01-28 |
| `Character.wz` | 1,238,707,905 | 2016-05-04 |
| `Effect.wz` | 142,666,079 | 2016-05-05 |
| `Etc.wz` | 19,435,393 | 2010-01-31 |
| `Item.wz` | 139,053,911 | 2016-05-04 |
| `List.wz` | 65,470 | 2009-11-09 |
| `Map.wz` | 835,954,262 | 2016-05-04 |
| `Mob.wz` | 421,628,507 | 2010-01-29 |
| `Morph.wz` | 35,707,082 | 2016-05-04 |
| `Npc.wz` | 53,772,873 | 2017-07-01 |
| `Quest.wz` | 3,726,297 | 2010-01-31 |
| `Reactor.wz` | 85,233,536 | 2010-01-28 |
| `Skill.wz` | 74,821,220 | 2010-01-28 |
| `Sound.wz` | 366,212,494 | 2010-01-28 |
| `String.wz` | 9,608,592 | 2017-07-01 |
| `TamingMob.wz` | 1,876 | 2016-05-04 |
| `UI.wz` | 33,744,089 | 2017-07-25 |

This is the complete WZ set expected for a v079-era client (including the v079-specific
`Morph.wz`, `TamingMob.wz`, and `List.wz`; later split files such as `Character2.wz` or
`Sound2.wz` are correctly absent). The directory also holds the usual runtime binaries
(`Patcher.exe`, `Setup.exe`, `mss32.dll`, `dsetup.dll`-era Miles Sound DLLs, `Gr2D_DX8.dll`,
`HShield/` anti-cheat folder, `redist/`) plus repack-specific add-ons: `ijl15.dll`
(private-server loader), `单机登陆器.bat` (`MapleStory.exe 127.0.0.1 9555`),
`冒险岛HS修正工具.exe` (HShield bypass tool), `登录器使用说明.txt`, and `pg.dll`,
`iloveaki.dat`, `SkinH_EL.dll` (Chinese launcher cosmetics).

### Key SHA-256 hashes

| File | SHA-256 |
| --- | --- |
| `MapleStory.exe` | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` |
| `Base.wz` | `8040f3ab36d2fb02b31ae04d794f36699c0f6c58e5cd7b87cd81d361da0aad7d` |
| `Etc.wz` | `5177d6ac654aeac1e3db83a1f98445df26c80472bc75fb43e3ea41337e25bc6f` |
| `Quest.wz` | `48716b137d84b7e80dc4e6a4ef7e1cf4f908e90370d48ad4cb9aad9052fbeffe` |
| `TamingMob.wz` | `64756585542455417e2de696395700e430a2510bd45cc1a4c22677cb273953a4` |
| `怀旧岛079V5客户端.rar` | `8439abc699fd3f20c9546a923a65593faf020a3a4b8be8b164dce37a38b6b247` |

## Evidence that this is a complete, likely CMS079 client

1. **Executable version resource says v079.** The `VS_VERSION_INFO` block inside
   `MapleStory.exe` (never executed; parsed as data) reports:
   - `FileVersion` = `1, 0, 0, 79`
   - `ProductVersion` = `1, 0, 0, 79`
   - `CompanyName` = `Wizet`, `ProductName` = `Wizet MapleStory`,
     `OriginalFilename` = `MapleStory.exe`
   - PE link timestamp 2010-01-31, 32-bit i386 — consistent with the v079 release window
     (late 2009 / early 2010). An embedded data string `MapleStory Chin[a]` also appears
     in the image.
2. **Complete, structurally valid WZ set.** All 16 data WZ files start with the standard
   WZ magic `PKG1`, the copyright string
   `Package file v1.0 Copyright 2002 Wizet, ZMS`, header `file_start = 60`, and each
   header-declared data size equals `(actual file size − 60)` exactly — e.g. `Base.wz`
   declares 8,825 and is 8,885 bytes; `Map.wz` declares 835,954,202 and is 835,954,262
   bytes. Truncated or unrelated files would not match to the byte.
3. **The WZ payload is present, not stubs.** Sizes are in the expected multi-hundred-MB
   range (`Map.wz` 836 MB, `Character.wz` 1.24 GB, `Sound.wz` 366 MB), matching a full
   asset set rather than placeholder files.
4. **Matched server package corroborates the version.** The sibling
   `怀旧岛079V5服务端_/079V5` is an OdinMS-derived server (`江浩079.jar`,
   `mina-core-2.0.9.jar`, `mysql-connector`) whose config points at a MySQL database
   named `079V5`, an extracted WZ tree (`wz/Base.wz/*.img.xml`, 34,708 files), and a
   startup note instructing use with this exact client. The client README and the server
   share the same author and date (江浩, 2017-09-23).
5. **Naming.** Directory and archive names (`CMS079`, `怀旧岛079V5客户端` =
   "Nostalgia Island 079 V5 client") consistently reference 079.

## Uncertainty — how "specifically CMS079" is this?

- It is **definitively a v079 client** (executable resource + WZ set + companion server
  all agree), but it is a **private-server repack, not a stock official CMS079
  distribution**: the `ijl15.dll` loader, HShield bypass tool, local-loopback launcher,
  and 2016–2017 mtimes on several WZ files (`Character`, `Item`, `Map`, `Morph`, `Npc`,
  `String`, `UI`) show the data files were re-saved/patched after the original client.
- Consistent with that, the WZ internal encrypted-version marker (the `uint16` at
  `file_start`) is `194` (0x00C2) in **every** WZ file, and the `uint32` that follows it
  differs per file. Under the two common WZ-version hash formulas, 194 decodes to
  version string `51` or `62` — not `79` — and the varying per-file value does not match
  a plain version checksum. This is expected for re-saved files (re-encryption tools
  pick their own internal version), so it does not contradict the client version, but it
  does mean the WZ internal version number cannot independently confirm "079". Anyone
  writing a WZ reader for these files must resolve the version empirically (try
  candidate versions against the encrypted directory-name strings) rather than assuming
  the usual v079 key.
- The exe's resource locale is `0x0412` (Korean) with Wizet branding, which is normal for
  China-market clients built from the Korean tree but means the binary alone does not
  prove the *C* in CMS; the "079V5" server database naming and Chinese packaging are the
  regional evidence.
- `List.wz` does not carry the `PKG1` header (starts `05 00 00 00`), which is unusual
  but not blocking; all data-bearing files are well-formed.

Overall confidence: **high** that this is a complete, usable MapleStory v079-family
client; **medium-high** that it is specifically the CMS (Chinese) 079 branch, based on
packaging and server naming rather than the binary alone.

## Recommendation

Adventure Island should use

```
/shared/CMS079/怀旧岛079V5客户端/冒险岛online
```

as its **read-only client reference**: point WZ tooling at that directory's `.wz` files
(read-only mounts / no writes), never execute `MapleStory.exe`, `Patcher.exe`,
`Setup.exe`, the launcher `.bat`, or anything in `HShield/`, and use the server-side
extracted tree (`…/怀旧岛079V5服务端_/079V5/wz/Base.wz/*.img.xml`) only as a
cross-check when a WZ node is hard to decode. Keep the extracted directory as the
canonical source; the two `.rar` archives are redundant originals and should not be
unpacked anywhere inside the repository.
