import { describe, it, expect } from "vitest";
import { triageMinutes, share, pctLabel, minLabel, growth, ppChange, projection, cumulative, niceMax, toCsv } from "./resumo";

describe("resumo dos relatórios", () => {
  it("tempo médio de triagem", () => {
    expect(triageMinutes({ durSum: 600, durCount: 2 })).toBe(5);
    expect(triageMinutes({ durSum: 1000, durCount: 3 })).toBe(5.6);
    expect(triageMinutes({ durSum: 0, durCount: 0 })).toBeNull();
    expect(minLabel(5.6)).toBe("5,6 min");
    expect(minLabel(null)).toBe("—");
  });

  it("participação, variação e pontos percentuais", () => {
    expect(share(1, 4)).toBe(25);
    expect(share(1, 0)).toBeNull();
    expect(pctLabel(2, 3)).toBe("67%");
    expect(pctLabel(0, 0)).toBe("—");
    expect(growth(110, 100)).toBe(10);
    expect(growth(5, 0)).toBeNull();
    expect(ppChange(75, 100, 70, 100)).toBe(5);
    expect(ppChange(1, 0, 1, 2)).toBeNull();
  });

  it("projeção só no mês em andamento e com base", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((day, i) => ({ day, total: [10, 20, 30, 2][i] }));
    // média dos 3 dias fechados (20) × 30 dias
    expect(projection(days, "2026-11", "2026-11-04")).toBe(600);
    expect(projection(days.slice(0, 3), "2026-11", "2026-11-03")).toBeNull();
    expect(projection(days, "2026-10", "2026-11-04")).toBeNull();
  });

  it("acumulado e topo do eixo", () => {
    expect(cumulative([{ total: 2 }, { total: 3 }, { total: 0 }])).toEqual([2, 5, 5]);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(21)).toBe(25);
    expect(niceMax(480)).toBe(500);
    expect(niceMax(100)).toBe(100);
  });

  it("CSV com ponto e vírgula, vírgula decimal e aspas", () => {
    const csv = toCsv(["Nome", "Min"], [["Drogaria; Centro", 8.5], ['Dizem "boa"', null]]);
    expect(csv).toBe('Nome;Min\r\n"Drogaria; Centro";8,5\r\n"Dizem ""boa""";');
  });
});
