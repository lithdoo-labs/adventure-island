# Task 032 — Server inventory + local standup (P0)

STARTING_HEAD `b37c3056f7010d928d050825e731a70344316072` · canonical client
sample `5d280cf1…` unchanged (context only; this task does not touch the
protected client). Server source: `.raw/怀旧岛079V5服务端..rar` (SHA-256
`e074714d…` per Task 001), extracted tree `.work/task-002/server/079V5/`
re-validated against `result/server-file-manifest.csv`.

## Standup procedure (all loopback-only)

| Component | How | Result |
| --- | --- | --- |
| MySQL 5.5.53 | `mysqld --defaults-file=<path-corrected my.ini>` (the bundled ini hardcodes the original author's desktop paths; a path-corrected copy is used; bind-address forced to 127.0.0.1) | UP on 127.0.0.1:3306; the `079v5` database ships **pre-initialized** (90+ tables incl. `accounts` with 2 seeded accounts, `characters`, `wz_itemdata`…) — no dump restore needed |
| Game server | bundled JRE7: `Java\jre7\bin\java.exe -cp "dist\*;支持库\*" -Dnet.sf.odinms.wzpath=wz -Dfile.encoding=GBK -D江浩.AutoRegister=true server.Start` (headless — the GUI launcher `gui.江浩` is bypassed; `server.Start.main` is the console entry found by scanning the JAR for `main([Ljava/lang/String;)V`) | full stack UP in ~60 s: **login 9555, channels 1-4 = 7575/7576/7577/7578, cash shop 8600**, all bound to 127.0.0.1 per `服务端配置.ini` (江浩.IP=127.0.0.1) |
| First failure | `--no-defaults` MySQL start → `Unknown storage engine 'InnoDB'` (some tables are InnoDB; the no-defaults start lost the plugin settings) | fixed by the defaults-file start |

## Key server facts (from the JAR + configs)

- Java server (odinms-family `江浩` fork), Apache MINA 2.0.9 networking,
  MySQL connector, slf4j; world/channel/login/cashshop in one process
  (`server.Start.main` → `startServer`).
- Config (GB18030): 4 channels, rates 5/5/5, AutoRegister on (one account
  per machine code), user limit 500, 3 chars max.
- Seeded accounts: `fl1234`, `fl2223` — password hash scheme identified:
  **plain SHA-1 of the password** (`sha1("123456") = 7c4a8d09…` matches both
  rows); `client.LoginCrypto` provides sha1/sha512 + salted variants
  (salt columns present but NULL for these rows).
- Packet display enabled for the campaign via a byte-exact GBK edit of
  `服务端配置.ini` (封包显示=true, 调试输出封包=true, Debug=true) —
  restored from the pristine archive copy first (an earlier text-mode edit
  corrupted a numeric property and crashed startup with
  `NumberFormatException` at LoginServer.java:102).
