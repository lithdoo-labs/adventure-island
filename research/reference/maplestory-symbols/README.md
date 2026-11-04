# MapleStory symbol and reverse-engineering references

This directory is a working reference bundle for cross-version correlation against the CMS v079 client studied in this repository.

## Purpose

Use these materials only as **reference evidence** when the original CMS v079 game image becomes available/materialized. Do not transfer foreign-version RVAs directly into CMS079.

Preferred evidence order for assigning a CMS079 name:

1. exact matching symbol/PDB evidence for the same binary;
2. CMS079-local RTTI, vtable, string or import evidence;
3. behavioral match to server/protocol findings in this repository;
4. cross-version function/structure match against GMS v83/v95 or KMST references;
5. address similarity alone (weak; never sufficient by itself).

## Contents

- `upstream/Bia10.Maple.Client.V95/` — selected MIT-licensed GMS v95 structure/address material copied from the upstream project and pinned by provenance.
- `upstream/Bia10.Maple.Enums/` — MIT-licensed notes preserving original spellings seen in the GMS v95 PDB-derived material.
- `derived/cms079-correlation-seeds.csv` — project-local candidates to test when CMS079 game code is reached.
- `derived/function-family-seeds.md` — project-local function/class families worth searching for first.
- `SOURCES.md` — source index, including public reports of PDB/IDB material that is **not mirrored here**.
- `LEGAL.md` — redistribution/provenance policy for this directory.

## Current status

At the time this bundle was created, the CMS079 analysis had reached the protector resolver / environment-probe stage. Tail A (`RVA 0x002CE000–0x007EA000`) and the three ZtlTaskMem slots had not yet materialized. Therefore every v95/v83 symbol in this directory is a **future correlation candidate**, not a CMS079 identification.

## How to use once game code appears

For each CMS079 candidate function or class, record:

- CMS079 RVA/VA and materialization stage;
- local strings/constants;
- callers/callees;
- RTTI/vtable evidence;
- protocol/WZ/crypto evidence;
- matching reference version and reference name;
- match method (structure, behavior, string, CFG, constants, etc.);
- confidence (`confirmed`, `high`, `medium`, `low`).

Do not assign a public-reference name to CMS079 solely because an RVA is numerically close.
