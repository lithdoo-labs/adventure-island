# Protector attribution

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`.

**Probable: Oreans WinLicense.** Confidence is medium. Themida is the same vendor's engine without the licensing product name, so it stays possible. XProtector is only a spelling hint. A generic custom protector does not explain the two registry paths.

## Why WinLicense is the strongest name

The materialized block contains the literal keys `Software\WinLicense` and `Software\WLkt`, then a table of value names that starts with `WinLicenseVersion`, `WinLicenseDriverVersion`, and `WinLicenseInstance`. A fetched secondary report dated 16 December 2025 lists those two key strings together and labels its sample Themida/WinLicense. That is corroboration of the key names, not a byte-identical stub match.

Oreans' own registry help says a customer license key path is chosen by the developer and may sit in HKCU or HKLM. It does not publish `Software\WinLicense` as that customer path. The key in this client is therefore the protector's own key, not evidence that a customer `.reg` license was configured with that name.

## Why it is not confirmed

Task 001's disk scan found no `Themida` or `WinLicense` ASCII and no `.themida` section. Those strings appear only after the stage-2 decode. The value names were not found in any fetched vendor page. No public stub was compared instruction by instruction with `0x0081CF01` or `0x00821750`. The Joe Sandbox page is an automated report; it is not a vendor document.

## The other candidates

| Family | Verdict | Reason |
| --- | --- | --- |
| WinLicense | probable | key path plus WinLicense* value names |
| Themida | possible | same Oreans engine; the key is named WinLicense rather than Themida |
| XProtector | possible | `XprotExit` uses that older product token; nothing else names XProtector |
| Generic custom | unsupported | `Software\WinLicense` and `Software\WLkt` together are not a generic anti-debug idiom |

The SoftICE device trio does not choose a vendor. MeltICE (1997) and the OpenRCE example (2006) use the same names in ordinary detection code. aPLib-style decompression, identified in Task 006 by the `0x500` and `0x7D00` thresholds, is also shared. Both are compatible with a late-2000s WinLicense stub and neither is unique to it.

CMS079-era clients sit after SoftICE's public detection recipes and inside the years WinLicense was sold. That date fit is consistent. It is not an identification.
