import { auto, o } from '../src'
import { $O } from '../src/symbols'

let runs: number
let prevRuns: number
function expectRuns(n: number) {
  expect(runs).toBe(prevRuns + n)
  prevRuns = runs
}

let ctx = o({
  effect: () => {},
})

// Synchronously run the effect when it changes.
auto(() => (ctx.effect(), runs++), { delay: 0 })

// Replace the effect and reset the run count.
let setEffect = (effect: () => void) => {
  ctx.effect = effect
  prevRuns = runs = 0
}

describe('auto()', () => {
  it('ignores any mutations made inside its callback', () => {
    const state = o({ count: 0 })
    setEffect(() => {
      if (state.count < 5) {
        state.count++
      }
    })
    expect(state.count).toBe(1)
    state.count += 1
    expect(state.count).toBe(3)
  })

  it('unsubscribes from observables when an error is thrown', () => {
    const a = o({ count: 0 })
    const b = o({ count: 1 })
    setEffect(() => {
      // Subscribe to "a.count" in the first run.
      if (!a.count) return
      // Subscribe to "b.count" before throwing.
      if (a.count == b.count) {
        expect(getObservers(b, 'count').size).toBe(1)
        throw Error()
      }
    })
    const getObservers = (state: any, key: string) =>
      state[$O].get(key) as Set<any>
    expect(getObservers(a, 'count').size).toBe(1)
    expect(getObservers(b, 'count').size).toBe(0)
    try {
      a.count++
    } catch {
      // Stay subscribed to "a.count" from the previous run.
      expect(getObservers(a, 'count').size).toBe(1)
      // Stop observing "b.count" from the throwing run.
      expect(getObservers(b, 'count').size).toBe(0)
    }
    expect.assertions(5)
  })

  describe('objects', () => {
    let obj: any
    beforeEach(() => {
      obj = o({})
    })
    test('get', () => {
      setEffect(() => obj.a)

      obj.a = 1 // add our key
      expectRuns(1)

      obj.a = 1 // set our key (no change)
      expectRuns(0)

      obj.a = 2 // set our key
      expectRuns(1)

      delete obj.a // delete our key
      expectRuns(1)

      obj.b = 1 // add other key
      expectRuns(0)

      obj.b = 1 // set other key (no change)
      expectRuns(0)

      obj.b = 2 // set other key
      expectRuns(0)

      delete obj.b // delete other key
      expectRuns(0)
    })
    test('in', () => {
      setEffect(() => 'a' in obj)

      obj.a = 1 // add our key
      expectRuns(1)

      obj.a = 1 // set our key (no change)
      expectRuns(0)

      obj.a = 2 // set our key
      expectRuns(1)

      delete obj.a // delete our key
      expectRuns(1)

      obj.b = 1 // add other key
      expectRuns(0)

      obj.b = 1 // set other key (no change)
      expectRuns(0)

      obj.b = 2 // set other key
      expectRuns(0)

      delete obj.b // delete other key
      expectRuns(0)
    })
  })

  describe('arrays', () => {
    let arr: any[]
    beforeEach(() => {
      arr = o([])
    })
    test('.length', () => {
      setEffect(() => arr.length)

      arr.pop() // empty pop
      expectRuns(0)

      arr.push(1, 2) // push many
      expectRuns(1)

      arr.pop() // pop one
      expectRuns(1)

      arr.unshift(1, 2) // unshift many
      expectRuns(1)

      arr.splice(0, 0) // empty splice
      expectRuns(0)

      arr.splice(1, 1) // remove one
      expectRuns(1)

      arr.splice(2, 0, 3, 4) // insert two
      expectRuns(1)

      arr.splice(1, 1, 3) // remove one, insert one
      expectRuns(0)

      arr.shift() // shift one
      expectRuns(1)

      ensureReversed() // not reversed yet
      expectRuns(0)

      ensureSorted() // not sorted yet
      expectRuns(0)

      arr.length = 0 // truncate to length of 0
      expectRuns(1)

      arr.length = 2 // expand to length of 2
      expectRuns(1)

      arr[2] = 1 // set new index
      expectRuns(1)

      arr[1] = 1 // fill hole
      expectRuns(0)

      arr[1] = 2 // set old index
      expectRuns(0)

      arr[1] = 2 // set old index (no change)
      expectRuns(0)
    })
    test('.concat()', () => {
      const left = arr
      const right: any[] = o([])
      setEffect(() => left.concat(right))

      left.push(1)
      expectRuns(1)

      right.push(1)
      expectRuns(1)
    })
    test('.forEach()', () => {
      setEffect(() => arr.forEach(() => {}))
      wholeMutations()
    })
    test('.keys()', () => {
      setEffect(() => arr.keys())
      wholeMutations()
    })
    function ensureReversed() {
      const old = [...arr]
      arr.reverse()
      expect(arr).not.toEqual(old)
    }
    function ensureSorted() {
      const old = [...arr]
      arr.sort()
      expect(arr).not.toEqual(old)
    }
    function wholeMutations() {
      arr.pop() // empty pop
      expectRuns(0)

      arr.push(1, 2) // push many
      expectRuns(1)

      arr.pop() // pop one
      expectRuns(1)

      arr.unshift(1, 2) // unshift many
      expectRuns(1)

      arr.splice(0, 0) // empty splice
      expectRuns(0)

      arr.splice(1, 1) // remove one
      expectRuns(1)

      arr.splice(2, 0, 3, 4) // insert two
      expectRuns(1)

      arr.splice(1, 1, 3) // remove one, insert one
      expectRuns(1)

      arr.shift() // shift one
      expectRuns(1)

      ensureReversed() // not reversed yet
      expectRuns(1)

      ensureSorted() // not sorted yet
      expectRuns(1)

      arr.sort() // already sorted
      expectRuns(1)

      arr.length = 0 // truncate to length of 0
      expectRuns(1)

      arr.length = 2 // expand to length of 2
      expectRuns(0)

      arr[2] = 1 // set new index
      expectRuns(1)

      arr[1] = 1 // fill hole
      expectRuns(1)

      arr[1] = 2 // set old index
      expectRuns(1)

      arr[1] = 2 // set old index (no change)
      expectRuns(0)
    }
  })

  describe('sets', () => {
    let set: Set<any>
    beforeEach(() => {
      set = o(new Set())
      set.add(1).add(2)
    })
    test('.forEach()', () => {
      setEffect(() => set.forEach(() => {}))

      set.add(3) // add unknown value
      expectRuns(1)

      set.add(3) // add known value
      expectRuns(0)

      set.delete(3) // delete known value
      expectRuns(1)

      set.delete(3) // delete unknown value
      expectRuns(0)

      expect(set.size).not.toBe(0)
      set.clear() // clear values
      expectRuns(1)

      expect(set.size).toBe(0)
      set.clear() // clear when empty
      expectRuns(0)
    })
    test('.size', () => {
      setEffect(() => set.size)

      set.add(3) // add unknown value
      expectRuns(1)

      set.add(3) // add known value
      expectRuns(0)

      set.delete(3) // delete known value
      expectRuns(1)

      set.delete(3) // delete unknown value
      expectRuns(0)

      expect(set.size).not.toBe(0)
      set.clear() // clear values
      expectRuns(1)

      expect(set.size).toBe(0)
      set.clear() // clear when empty
      expectRuns(0)
    })
  })

  describe('maps', () => {
    let map: Map<any, any>
    beforeEach(() => {
      map = o(new Map())
      map.set(1, 2)
    })
    const key = {}
    test('.has()', () => {
      setEffect(() => map.has(key))

      map.set(key, 1) // add our key
      expectRuns(1)

      map.set(key, 1) // set our key (no change)
      expectRuns(0)

      map.set(key, 2) // set our key
      expectRuns(1)

      map.delete(key) // delete our key
      expectRuns(1)

      map.set(0, 1) // add other key
      expectRuns(0)

      map.set(0, 1) // set other key (no change)
      expectRuns(0)

      map.set(0, 2) // set other key
      expectRuns(0)

      map.delete(0) // delete other key
      expectRuns(0)

      expect(map.size).not.toBe(0)
      map.clear() // clear other values
      expectRuns(0)

      expect(map.size).toBe(0)
      map.clear() // clear when empty
      expectRuns(0)

      map.set(key, 1) // re-add our key for next test
      expectRuns(1)

      map.clear() // clear our value
      expectRuns(1)
    })
    test('.get()', () => {
      setEffect(() => map.get(key))

      map.set(key, 1) // add our key
      expectRuns(1)

      map.set(key, 1) // set our key (no change)
      expectRuns(0)

      map.set(key, 2) // set our key
      expectRuns(1)

      map.delete(key) // delete our key
      expectRuns(1)

      map.set(0, 1) // add other key
      expectRuns(0)

      map.set(0, 1) // set other key (no change)
      expectRuns(0)

      map.set(0, 2) // set other key
      expectRuns(0)

      map.delete(0) // delete other key
      expectRuns(0)

      expect(map.size).not.toBe(0)
      map.clear() // clear other values
      expectRuns(0)

      expect(map.size).toBe(0)
      map.clear() // clear when empty
      expectRuns(0)

      map.set(key, 1) // re-add our key for next test
      expectRuns(1)

      map.clear() // clear our value
      expectRuns(1)
    })
    test('.forEach()', () => {
      setEffect(() => map.forEach(() => {}))

      map.set(key, 1) // add a key
      expectRuns(1)

      map.set(key, 1) // set a key (no change)
      expectRuns(0)

      map.set(key, 2) // set a key
      expectRuns(1)

      map.delete(key) // delete a key
      expectRuns(1)

      expect(map.size).not.toBe(0)
      map.clear() // clear all values
      expectRuns(1)

      expect(map.size).toBe(0)
      map.clear() // clear when empty
      expectRuns(0)
    })
    test('.size', () => {
      setEffect(() => map.size)

      map.set(key, 1) // add a key
      expectRuns(1)

      map.set(key, 1) // set a key (no change)
      expectRuns(0)

      map.set(key, 2) // set a key
      expectRuns(0)

      map.delete(key) // delete a key
      expectRuns(1)

      expect(map.size).not.toBe(0)
      map.clear() // clear all values
      expectRuns(1)

      expect(map.size).toBe(0)
      map.clear() // clear when empty
      expectRuns(0)
    })
  })
})
