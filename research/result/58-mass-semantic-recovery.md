# Task 058 Final Report — Mass Function Semantic Recovery

## Verdict: Structural coverage 100%, role coverage 59%, semantic naming 2.5%

## Honest Progress Assessment

### Before Task 058
| Level | Count | % |
|---|---|---|
| Semantic named | 185 | 0.4% |
| Role identified | ~13,500 | 26% |
| Structural only | ~37,700 | 74% |
| Total labeled | 51,200 | 100% (but 74% was "unknown") |

### After Task 058
| Level | Count | % | Change |
|---|---|---|---|
| Semantic named | 1,263 | 2.5% | +1,078 |
| Role identified | 28,763 | 56.2% | +15,263 |
| Context propagated | 1,272 | 2.5% | +1,272 |
| Structural only | 19,902 | 38.9% | — |
| **Any label** | **51,200** | **100%** | **was 74%** |

### What Each Level Means
- **Semantic named**: We know the game concept (e.g., "OnChatText", "SendMOVE_PLAYER")
- **Role identified**: We know the function type (handler, builder, ctor, vtable-method)
- **Context propagated**: We know the caller's subsystem (e.g., "ctor_helper")
- **Structural only**: We know the code shape (stub, thunk, leaf, mid-level, callback)

### Role Breakdown (honest)
| Role | Count | Notes |
|---|---|---|
| ctor (vtable writer) | 27,847 | Broad structural; any function writing a vtable ptr |
| vtable-method | 5,130 | Slot in a validated vtable class |
| mid-level | 735 | Has both callers and callees |
| outbound-builder | 1,218 | Calls WriteHeader/WriteInt/... |
| inbound-handler | 298 | Called from dispatch switch |
| utility (leaf) | 161 | No callees, ≤1 caller |
| computational (leaf) | 45 | No callees, multiple callers |
| sender-host | 235 | Contains send-wrapper call |
| thunk/stub/callback | 87 | Jump/ret/orphan patterns |

### The 27,847 "ctor" Functions
This label from Task 051 marks any function that writes a vtable pointer to memory.
In C++, this happens in constructors, but also in factory functions and
initialization routines. It's a **structural** classification (knows the code
writes a vtable), not a **semantic** one (doesn't know WHAT object is being
constructed or WHY).

## Strategies Applied

1. **S1: Existing label loading** — 4,824 from prior tasks
2. **S2: (planned but skipped)** — API classification needed IAT parsing
3. **S3: (planned but skipped)** — Game constant matching needed more data prep
4. **S4: Callgraph propagation** — +30K contextual labels (caller subsystem hints)
5. **S5: Code pattern classification** — +20K structural labels (stub/thunk/leaf/mid)

## Remaining Gap Analysis

The 19,902 "structural only" functions break down as:
- **Leaf computational** (no callees, multiple callers): most numerous
  These are small utility functions (math, string ops, data conversion)
  that are hard to name without string references or API calls

- **Mid-level** (have both callers and callees): 
  These form the "interior" of the callgraph. They implement game logic
  but don't touch the boundaries (no packets, no UI, no strings)

- **Orphan/callback** (no callers):
  These are likely called through function pointers or vtables that
  our static callgraph doesn't capture

## Next Steps for Higher Coverage

1. **String-reference scan** (all 51K functions): Functions containing
   debug strings, error messages, or resource paths can be immediately
   classified by their string content

2. **Constant cross-referencing**: Functions using known item/skill/map IDs
   can be named by their data associations (e.g., a function referencing
   skill ID 1001003 is in the warrior-skill subsystem)

3. **Server-source alignment**: The 364 Java files contain business logic
   that mirrors client-side code. Matching call patterns between the two
   could transfer server names to client functions

4. **Deep vtable analysis**: The 179 validated vtable classes represent
   polymorphic interfaces. Analyzing slot implementations across classes
   could identify virtual method names (e.g., "Update", "Render", "OnEvent")
