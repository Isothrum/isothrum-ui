import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { PORT_PROTOCOLS, portsText, readPorts, type Service } from "./ports";
import { engineChoices, oneContainerTopology, verdict } from "@/test/shipped-engine";

describe("readPorts", () => {
  test("reads each port, with what it speaks when it isn't TCP", () => {
    expect(readPorts("80, 443/https,53/udp , 22/tcp")).toEqual({
      services: [{ port: 80 }, { port: 443, protocol: "https" }, { port: 53, protocol: "udp" }, { port: 22 }],
      bad: [],
    });
  });

  test("reports each entry Isoloom couldn't take, and keeps the others", () => {
    expect(readPorts("80, http, 0, 65536, 80.5, 53/UDP, 25/smtp, 22")).toEqual({
      services: [{ port: 80 }, { port: 22 }],
      bad: ["http", "0", "65536", "80.5", "53/UDP", "25/smtp"],
    });
  });

  test("an empty field is no ports and no problem", () => {
    expect(readPorts(" , ")).toEqual({ services: [], bad: [] });
  });
});

describe("portsText", () => {
  test("writes TCP as the number, and the rest with their protocol", () => {
    expect(portsText([{ port: 80 }, { port: 22, protocol: "tcp" }, { port: 53, protocol: "udp" }])).toBe("80, 22, 53/udp");
  });

  test("is read back as the same ports", () => {
    const service: fc.Arbitrary<Service> = fc.record({ port: fc.integer({ min: 1, max: 65535 }), protocol: fc.constantFrom(...PORT_PROTOCOLS) });
    fc.assert(
      fc.property(fc.array(service, { maxLength: 6 }), (services) => {
        const normal = services.map((s) => (s.protocol === "tcp" ? { port: s.port } : s));
        expect(readPorts(portsText(services))).toEqual({ services: normal, bad: [] });
      }),
    );
  });
});

describe("a machine's ports, as Isoloom takes them", () => {
  test("every port protocol, and only those", async () => {
    expect([...PORT_PROTOCOLS]).toEqual((await engineChoices()).protocols);
  });

  const entry = fc.oneof(
    fc.tuple(fc.integer({ min: -5, max: 70_000 }), fc.constantFrom("", "/tcp", "/udp", "/http", "/https", "/tls", "/TCP", "/sctp", "/")).map(([p, proto]) => `${String(p)}${proto}`),
    fc.constantFrom("http", "80.5", "", "0x50"),
  );

  test("an entry the editor keeps is a port Isoloom takes; the others are reported", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(entry, { maxLength: 4 }), async (entries) => {
        const { services, bad } = readPorts(entries.join(", "));
        expect(services.length + bad.length).toBe(entries.filter((e) => e.trim()).length);
        const v = await verdict(oneContainerTopology(undefined, services));
        expect(v.error).toBeNull();
        expect(v.problems.filter((p) => p.includes("machines.a.ports"))).toEqual([]);
      }),
      { numRuns: 40 },
    );
  });

  test.each([
    ["0", { port: 0 }],
    ["70000", { port: 70_000 }],
    ["80/sctp", { port: 80, protocol: "sctp" }],
  ])("%s, a port out of range or a protocol Isoloom doesn't have, is reported by the editor and refused by the engine", async (entry, service) => {
    expect(readPorts(entry)).toEqual({ services: [], bad: [entry] });
    expect((await verdict(oneContainerTopology(undefined, [service]))).ok).toBe(false);
  });
});
