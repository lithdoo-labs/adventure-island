"""T090 WP1-D: offline numeric model of the CMS079 animation timeline.

Implements the PROVEN CMS079 semantics:
  - frame delay source: explicit WZ property `delay` (id 0x155D) when present,
    else the CONSUMER-SITE seeded default (matrix T090-G39-DEFAULT-CONSUMER-MATRIX.csv)
  - a0/a1 defaults -1 (frame converter 0x43ECFA push -1)
  - Gr2D frame record: delay@+0x0C a0@+0x10 a1@+0x14 (0x5040ABE6)
  - timeline: end_ts += delay * animationScale / 1000
      * per-frame accumulation: UNSIGNED div (0x5040BCD0 `div ecx`)
      * total loop period: SIGNED idiv (0x5040BC60)
      * animationScale = coerced V3 VARIANT of the [vt+0x110] registration,
        DEFAULT 1000 when V3 is VT_EMPTY/VT_ERROR (0x504027BB fast path 0x5040283D)
  - repeat triage (0x66F890): repeat>=0 -> mode 0x20 loop (suffix start),
    -1 -> mode 0, -2 -> mode 0x10 one-shot
  - mode gates: test 0x20 (loop) / 0x10 (one-shot) (0x5040BC02 / 0x5040BD39)

All arithmetic is 32-bit (mod 2^32), matching the machine code.
"""
import struct


def u32(x):
    return x & 0xFFFFFFFF


def s32(x):
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x


def frame_advance(delay, scale=1000):
    """Per-frame accumulation at 0x5040BCC7-0x5040BCDD:
    eax = delay (from [rec+0xC]); eax *= scale ([ebp-0x1C]); UNSIGNED div 1000."""
    eax = u32(delay)
    eax = u32(eax * u32(scale))
    edx_rem = 0
    eax_q, edx_rem = divmod(eax, 1000)  # unsigned div ecx=0x3E8
    return eax_q, edx_rem


def total_period(delays, scale=1000):
    """Total loop period at 0x5040BC3D-0x5040BC65: sum of delays (signed add),
    then imul scale, SIGNED idiv 1000."""
    total = 0
    for d in delays:
        total = s32(total + s32(d))
    eax = s32(total * s32(scale))
    q = abs(eax) // 1000
    if eax < 0:
        q = -q
    return q


def timeline(delays, scale=1000, repeat=None, mode=None):
    """Build the end-timestamp timeline for a frame list.
    Returns list of cumulative end timestamps (unsigned arithmetic) plus the
    resolved mode per the repeat triage when given."""
    if mode is None:
        if repeat is None:
            mode = 0x20  # default: loop (registration sites pass 0x20)
        elif repeat >= 0:
            mode = 0x20
        elif repeat == -1:
            mode = 0x00
        elif repeat == -2:
            mode = 0x10
        else:
            mode = None  # no registration (other values)
    ts = 0
    ends = []
    for d in delays:
        q, _ = frame_advance(d, scale)
        ts = u32(ts + q)
        ends.append(ts)
    return {
        "end_timestamps": ends,
        "total_period": total_period(delays, scale) if len(delays) > 1 else None,
        "mode": mode,
        "loop": bool(mode is not None and (mode & 0x20)),
        "one_shot": bool(mode is not None and (mode & 0x10)),
    }


def effective_delays(explicit, consumer_default):
    """Per-frame effective delay: explicit WZ value when present, else the
    consumer default (this is the ORIGINAL data-flow; do NOT normalize)."""
    return [d if d is not None else consumer_default for d in explicit]


# ---- proven constants (byte-verified this round / T089)
DEFAULT_120_SITES = 18          # incl. frame converter 0x43EC81, tiler 0x66ABCD
DEFAULT_150_SITES = (0x406EDC, 0x4071E3)
DEFAULT_60_SITES = (0x40811B, 0x40907F)
DEFAULT_180_SITES = (0x40EE4B, 0x40F595, 0x410832)
DEFAULT_1000_SITES = (0x5FA885, 0x9420D6)
PORTAL_FLAT_DELAY_SITE = 0x71A72A   # default = ebx = 0 (xor ebx,ebx @0x71A21C)
ANIMATION_SCALE_DEFAULT = 1000      # 0x504027BB default path
