import { describe, it, expect } from "vitest";
import { buildReport, sumCounts } from "./mockReport";
import { demoPharmacies } from "./mockData";

const NOW = new Date(2026, 10, 10, 14, 30); // 10/11/2026, 14h30
const LIVE = { total: 7, done: 5, referred: 1, progress: 1, urgent: 1, durSum: 3360, durCount: 7 };

describe("relatório da demonstração", () => {
  it("mês igual à soma dos dias e das farmácias", () => {
    const r = buildReport(demoPharmacies, "2026-10", null, NOW, LIVE);
    expect(r.days).toHaveLength(31);
    const month = r.months.at(-1);
    expect(sumCounts(r.days)).toEqual({ ...sumCounts([month]) });
    expect(sumCounts(r.byUnit)).toEqual(sumCounts([month]));
    expect(month.total).toBe(month.done + month.referred + month.progress);
    expect(month.total).toBeGreaterThan(1000);
  });

  it("mês atual vai até hoje e usa os atendimentos do navegador na farmácia da demo", () => {
    const r = buildReport(demoPharmacies, "2026-11", "demo", NOW, LIVE);
    expect(r.days.at(-1)).toEqual({ day: "2026-11-10", ...LIVE });
    expect(r.days).toHaveLength(10);
  });

  it("farmácia nova não tem histórico e recém-aberta começa devagar", () => {
    const r = buildReport(demoPharmacies, "2026-10", null, NOW, LIVE);
    expect(r.byUnit.find((u) => u.id === "sobradinho").total).toBe(0);
    const aguas = buildReport(demoPharmacies, "2026-10", "aguas-claras", NOW).months;
    expect(aguas.slice(0, 8).every((m) => m.total === 0)).toBe(true);
    expect(aguas.at(-1).total).toBeGreaterThan(aguas.at(-3).total);
  });

  it("sempre os mesmos números para a mesma data", () => {
    expect(buildReport(demoPharmacies, "2026-09", null, NOW)).toEqual(buildReport(demoPharmacies, "2026-09", null, NOW));
  });

  it("recusa mês futuro e farmácia desconhecida", () => {
    expect(() => buildReport(demoPharmacies, "2026-12", null, NOW)).toThrow();
    expect(() => buildReport(demoPharmacies, "2026-10", "nao-existe", NOW)).toThrow();
  });
});
