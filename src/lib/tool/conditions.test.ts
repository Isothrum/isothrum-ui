import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { conditionsLabel, conditionsOf, tcOf, tcProblemText, withCondition, type Tc } from "./conditions";
import { arbitraryConditions } from "@/test/arbitraries";
import { oneContainerTopology, verdict } from "@/test/shipped-engine";

describe("tcOf", () => {
  test("writes delay, jitter, loss and rate as Isoloom's tc takes them", () => {
    expect(tcOf({ delay: 40, jitter: 5, loss: 0.5, rate: 10 })).toEqual({ delay: "40ms", jitter: "5ms", loss: 0.5, rate: "10mbit" });
  });

  test.each([
    [10, "10mbit"],
    [2.5, "2500kbit"],
    [0.0005, "500bit"],
  ])("writes a rate of %s Mbit/s in the largest unit that keeps it whole: %s", (rate, written) => {
    expect(tcOf({ rate })).toEqual({ rate: written });
  });

  test("writes a loss above 100% and a jitter without a delay as they are, for Isoloom to report", () => {
    expect(tcOf({ loss: 150, jitter: 5 })).toEqual({ loss: 150, jitter: "5ms" });
  });

  test("writes every number it holds, zero and negative ones too, as Isoloom reads them", () => {
    expect(tcOf({ delay: 0, loss: -1 })).toEqual({ delay: "0ms", loss: -1 });
  });

  test("is undefined when nothing is set", () => {
    for (const c of [undefined, {}, { delay: Number.NaN }, { rate: Number.POSITIVE_INFINITY }]) expect(tcOf(c)).toBeUndefined();
  });
});

describe("conditionsLabel", () => {
  test("summarizes the conditions for the canvas", () => {
    expect(conditionsLabel({ delay: 40, jitter: 5, loss: 0.5, rate: 10 })).toBe("40 ms ±5 · 0.5% · 10 Mbit/s");
  });

  test("is empty when there are no conditions", () => {
    expect(conditionsLabel(undefined)).toBe("");
    expect(conditionsLabel({})).toBe("");
  });

  test("shows a jitter without a delay, as it is written", () => {
    expect(conditionsLabel({ jitter: 5 })).toBe("±5 ms");
  });
});

describe("conditionsOf", () => {
  test("reads Isoloom's tc back into the editor's numbers", () => {
    expect(conditionsOf({ delay: "40ms", jitter: "5ms", loss: 1, rate: "10mbit" })).toEqual({ conditions: { delay: 40, jitter: 5, loss: 1, rate: 10 }, problems: [] });
  });

  test("reads a time in microseconds or seconds as milliseconds", () => {
    expect(conditionsOf({ delay: "1s", jitter: "500us" }).conditions).toEqual({ delay: 1000, jitter: 0.5 });
  });

  test("reads a number in any spelling Isoloom reads: a sign, a lone point, an exponent", () => {
    expect(conditionsOf({ delay: "+.5ms", jitter: "5.ms", rate: "1E-3gbit" }).conditions).toEqual({ delay: 0.5, jitter: 5, rate: 1 });
  });

  test("reports each value it can't read, and keeps the others", () => {
    expect(conditionsOf({ delay: "fast", jitter: "5", loss: 1, rate: "10Mbit" })).toEqual({
      conditions: { loss: 1 },
      problems: [
        { field: "delay", value: "fast" },
        { field: "jitter", value: "5" },
        { field: "rate", value: "10Mbit" },
      ],
    });
  });

  test("reads a negative time as Isoloom does, and reports one too large to be a number", () => {
    expect(conditionsOf({ delay: "-5ms", jitter: "1e999ms" })).toEqual({ conditions: { delay: -5 }, problems: [{ field: "jitter", value: "1e999ms" }] });
  });

  test("is no conditions and no problems when there is no tc, or nothing in it", () => {
    expect(conditionsOf(undefined)).toEqual({ conditions: undefined, problems: [] });
    expect(conditionsOf({})).toEqual({ conditions: undefined, problems: [] });
  });


});

describe("conditionsOf, for any value", () => {
  test("inverts tcOf for any conditions the editor keeps", () => {
    fc.assert(
      fc.property(arbitraryConditions, (c) => {
        expect(conditionsOf(tcOf(c))).toEqual({ conditions: c, problems: [] });
      }),
    );
  });

  test("reads a time the same in any of its units", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (s) => {
        const read = [`${String(s)}s`, `${String(s * 1000)}ms`, `${String(s * 1_000_000)}us`].map((delay) => conditionsOf({ delay }).conditions?.delay);
        expect(read).toEqual([s * 1000, s * 1000, s * 1000]);
      }),
    );
  });

  test("reads a rate the same in any of its units, in bits or bytes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (g) => {
        const bits = [`${String(g)}gbit`, `${String(g * 1000)}mbit`, `${String(g * 1e6)}kbit`, `${String(g * 1e9)}bit`];
        const bytes = [`${String(g * 125)}mbps`, `${String(g * 125_000)}kbps`, `${String(g * 125e6)}bps`];
        expect([...bits, ...bytes].map((rate) => conditionsOf({ rate }).conditions?.rate)).toEqual(Array<number>(7).fill(g * 1000));
      }),
    );
  });

  test("reads or reports every value, never dropping one", () => {
    const value = fc.oneof(fc.string(), fc.tuple(fc.double(), fc.constantFrom("", "us", "ms", "s", "kbit", "mbit", "x")).map(([n, unit]) => `${String(n)}${unit}`));
    fc.assert(
      fc.property(fc.record({ delay: value, jitter: value, rate: value }, { requiredKeys: [] }), (tc) => {
        const { conditions, problems } = conditionsOf(tc);
        for (const field of ["delay", "jitter", "rate"] as const) {
          const read = conditions?.[field];
          const reported = problems.some((p) => p.field === field && p.value === tc[field]);
          expect(read !== undefined || reported).toBe(tc[field] !== undefined);
          expect(read !== undefined && reported).toBe(false);
          expect(Number.isNaN(read)).toBe(false);
        }
      }),
    );
  });
});

describe("tcProblemText", () => {
  test("names the field's path, the value, the form it takes, and what the editor does", () => {
    expect(tcProblemText("networks.slow.tc", { field: "delay", value: "fast" })).toBe("networks.slow.tc.delay: `fast` isn't a time like 40ms, 500us or 1s; the drawing leaves it out");
    expect(tcProblemText("links[0].tc", { field: "rate", value: "lots" })).toBe("links[0].tc.rate: `lots` isn't a rate like 10mbit or 512kbit; the drawing leaves it out");
  });
});

describe("withCondition", () => {
  test("sets a field to the positive number typed", () => {
    expect(withCondition(undefined, "delay", "40")).toEqual({ delay: 40 });
  });

  test("clears a field typed empty or not positive, keeping the others", () => {
    expect(withCondition({ delay: 40, loss: 1 }, "delay", "-5")).toEqual({ loss: 1 });
  });

  test("leaves no conditions once every field is cleared", () => {
    expect(withCondition({ delay: 40 }, "delay", "")).toBeUndefined();
  });

  test("keeps a field a stored lab carries that the editor doesn't know", () => {
    const stored = { delay: 40, mtu: 1400 };
    expect(withCondition(stored, "delay", "")).toEqual({ mtu: 1400 });
  });
});

/** Whether Isoloom finds a problem with `field` of the LAN's `tc`. */
async function refuses(tc: Tc, field: keyof Tc): Promise<boolean> {
  const v = await verdict(oneContainerTopology(tc));
  return v.problems.some((p) => p.includes(`networks.lan.tc.${field} `));
}

/** A number in one of the spellings Rust reads (or doesn't: an empty one, a lone point). */
const number = (odd: string[]) =>
  fc
    .tuple(fc.constantFrom("", "+", "-"), fc.oneof(fc.nat(100_000).map(String), fc.double({ min: 0, max: 1e6, noNaN: true }).map(String), fc.constantFrom(".5", "5.", "1e3", "2E-2", ...odd)))
    .map(([sign, n]) => `${sign}${n}`);

/** A `tc` value: a number, then letters that may or may not be a unit. */
const measured = fc
  .tuple(number(["", ".", "x1"]), fc.constantFrom("", "ms", "s", "us", "MS", "bit", "kbit", "mbit", "gbit", "bps", "kbps", "mbps", "gbps", "Mbit", "kb", "e", "m s"))
  .map(([n, unit]) => `${n}${unit}`);

/** A value Isoloom takes: a number and one of `units`. */
const taken = (units: string[]) => fc.tuple(number([]), fc.constantFrom(...units)).map(([n, unit]) => `${n}${unit}`);

/** Whether two readings hold the same numbers, but for what floating point loses. */
function same(a: Record<string, number | undefined> | undefined, b: Record<string, number | undefined> | undefined): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].every((k) => {
    const [x, y] = [a?.[k], b?.[k]];
    return x !== undefined && y !== undefined && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x));
  });
}

describe("a link condition is read exactly as Isoloom reads it", () => {
  test("a delay or a rate: Isoloom refuses it if and only if the editor reports it", async () => {
    await fc.assert(
      fc.asyncProperty(measured, fc.constantFrom("delay", "rate"), async (value, field) => {
        const reported = conditionsOf({ [field]: value }).problems.length > 0;
        expect(reported, `${field}: ${value}`).toBe(await refuses({ [field]: value }, field));
      }),
      { numRuns: 120 },
    );
  });

  test("a rate without its unit is reported, as Isoloom refuses it", async () => {
    expect(conditionsOf({ rate: "2000000" })).toEqual({ conditions: undefined, problems: [{ field: "rate", value: "2000000" }] });
    expect(await refuses({ rate: "2000000" }, "rate")).toBe(true);
  });

  test("what the editor writes back, Isoloom reads as the same conditions", async () => {
    await fc.assert(
      fc.asyncProperty(taken(["us", "ms", "s"]), taken(["bit", "kbit", "mbit", "gbit", "bps", "kbps", "mbps", "gbps"]), async (delay, rate) => {
        const read = conditionsOf({ delay, rate });
        expect(read.problems).toEqual([]);
        const written = tcOf(read.conditions);
        expect(same(conditionsOf(written).conditions, read.conditions), JSON.stringify({ delay, rate, written })).toBe(true);
        expect((await verdict(oneContainerTopology(written))).problems).toEqual([]);
      }),
      { numRuns: 40 },
    );
  });

  test("a loss above 100% or a jitter without a delay, written as it is, is reported by Isoloom", async () => {
    const problems = (await verdict(oneContainerTopology(tcOf({ loss: 150, jitter: 5 })))).problems.join("\n");
    expect(problems).toContain("networks.lan.tc.loss");
    expect(problems).toContain("networks.lan.tc.jitter");
  });
});
