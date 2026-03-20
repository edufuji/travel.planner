# Transport-Destination Gap Clearing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A transport event whose destination exactly matches the next accommodation's place ID clears the gap between two consecutive accommodations.

**Architecture:** Only `detectGaps` changes — the function already receives all events; we extend the clearing condition to scan for a transport T where `T.placeIdTo === b.placeId` and `T.date` falls between `a.date` and `b.date` (inclusive, date-only comparison). No schema changes, no UI changes.

**Tech Stack:** TypeScript, Vitest

---

## Chunk 1: Update gap detection and tests

### Task 1: Add failing tests for transport-destination clearing

**Files:**
- Modify: `src/lib/gapDetection.test.ts`

- [ ] **Step 1: Add 4 new tests after the existing 10**

In `src/lib/gapDetection.test.ts`, append inside the `describe('detectGaps', ...)` block:

```ts
  it('transport whose placeIdTo matches destination accommodation placeId clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Airport B → Hotel', date: '2026-03-18', time: '10:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport with matching placeIdTo on the same date as acc-A still clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Hotel B', date: '2026-03-15', time: '16:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport with matching placeIdTo on the same date as acc-B still clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Hotel B', date: '2026-03-18', time: '06:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport whose placeIdTo does NOT match destination accommodation placeId does NOT clear the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Airport', date: '2026-03-18', time: '10:00', placeIdTo: 'place-airport-x' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
npx vitest run src/lib/gapDetection.test.ts
```

Expected: 3 new tests FAIL (gap is still produced for each); the 4th new test ("does NOT clear the gap") already passes — 11 passing, 3 failing.

---

### Task 2: Implement transport-destination clearing in detectGaps

**Files:**
- Modify: `src/lib/gapDetection.ts`

- [ ] **Step 3: Add the hasTransportToB check**

Replace the inner loop body in `src/lib/gapDetection.ts`:

```ts
  for (let i = 0; i < accommodations.length - 1; i++) {
    const a = accommodations[i]
    const b = accommodations[i + 1]

    const hasWalkingRoute = b.arrivedOnFoot === true

    const hasTransportToB = sorted.some(
      e =>
        e.type === 'transport' &&
        e.date >= a.date &&
        e.date <= b.date &&
        e.placeIdTo !== undefined &&
        e.placeIdTo === b.placeId,
    )

    if (!hasWalkingRoute && !hasTransportToB) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        message: `No walking route between "${a.title}" check-in and "${b.title}" check-in`,
      })
    }
  }
```

- [ ] **Step 4: Run all gap detection tests**

```bash
npx vitest run src/lib/gapDetection.test.ts
```

Expected: all 14 tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gapDetection.ts src/lib/gapDetection.test.ts
git commit -m "feat: transport whose destination matches next stay clears gap"
```
