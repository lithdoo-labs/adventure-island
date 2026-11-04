# Redistribution and provenance policy

This directory intentionally separates **redistributable source/reference material** from **reported leaked binary/debug artifacts**.

## Included

Files copied under `upstream/` are included only when the upstream project provides an explicit license permitting redistribution. The relevant license text is stored next to each copied bundle, and provenance includes the upstream repository and commit when known.

Derived files under `derived/` are original project-local summaries, indexes, and correlation seeds created for this repository.

## Not mirrored

Do **not** commit third-party MapleStory executables, PDBs, IDBs, MAP files, proprietary SDKs, archives, or other binary/debug artifacts merely because they are publicly downloadable or described as leaked. For such references, store only metadata that is useful for verification, for example:

- version/region;
- reported artifact type;
- source/reference page;
- PDB filename/GUID/Age when independently known;
- hashes when legally obtained by the local researcher;
- symbol/class/function names that have been independently validated;
- project-local correlation notes.

This policy also avoids turning the repository into a redistribution point for Nexon/Wizet binaries or other unclear-origin material.

## Cross-version use

Reference addresses belong to their source build only. They must not be treated as CMS079 addresses without independent CMS079 evidence.
