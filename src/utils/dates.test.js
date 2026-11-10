import { describe, it, expect } from "vitest";
import { isSameDay, parseBrDate, monthLabel, startOfDay, dayKey, fromDayKey, shiftDay, dayLabel, shiftMonth, daysInMonth, isMonthKey, monthKeyLabel } from "./dates";

describe("dates", () => {
  it("compara dias ignorando a hora", () => {
    const ref = new Date(2026, 9, 28, 15, 0);
    expect(isSameDay(new Date(2026, 9, 28, 0, 5).toISOString(), ref)).toBe(true);
    expect(isSameDay(new Date(2026, 9, 27, 23, 59).toISOString(), ref)).toBe(false);
  });

  it("interpreta dd/mm/aaaa e rejeita datas inexistentes", () => {
    expect(parseBrDate("10/05/1990")?.getFullYear()).toBe(1990);
    expect(parseBrDate("31/02/2024")).toBeNull();
    expect(parseBrDate("29/02/2024")).not.toBeNull();
    expect(parseBrDate("1/5/1990")).toBeNull();
    expect(parseBrDate("")).toBeNull();
  });

  it("formata o mês em português com inicial maiúscula", () => {
    expect(monthLabel(new Date(2026, 9, 1))).toBe("Outubro 2026");
  });

  it("zera a hora em startOfDay", () => {
    const d = startOfDay(new Date(2026, 9, 28, 17, 30));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it("converte dias no formato da API e soma dias atravessando o mês", () => {
    expect(dayKey(new Date(2026, 10, 3, 22, 0))).toBe("2026-11-03");
    expect(fromDayKey("2026-02-30")).toBeNull();
    expect(fromDayKey("03/11/2026")).toBeNull();
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("nomeia o dia (hoje, ontem ou data por extenso)", () => {
    const now = new Date(2026, 10, 10, 9, 0);
    expect(dayLabel("2026-11-10", now)).toBe("Hoje");
    expect(dayLabel("2026-11-09", now)).toBe("Ontem");
    expect(dayLabel("2026-11-07", now)).toBe("Sábado, 7 de novembro");
    expect(dayLabel("2025-11-07", now)).toBe("Sexta-feira, 7 de novembro de 2025");
  });

  it("meses no formato aaaa-mm", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-11")).toBe(30);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-07")).toBe(true);
    expect(monthKeyLabel("2026-11")).toBe("Novembro 2026");
    expect(monthKeyLabel("2026-11", { short: true })).toBe("nov/26");
  });
});
