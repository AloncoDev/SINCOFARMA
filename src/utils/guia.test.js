import { describe, it, expect } from "vitest";
import { normalizeCode, codeFromQr, guideUrl } from "./guia";

describe("código da guia", () => {
  it("aceita o código em qualquer formato digitado", () => {
    for (const typed of ["ENC-7K3Q-9M2X", "enc-7k3q-9m2x", "ENC7K3Q9M2X", "7K3Q9M2X", " enc 7k3q 9m2x "]) {
      expect(normalizeCode(typed)).toBe("ENC-7K3Q-9M2X");
    }
  });

  it("recusa o que não é código (0, 1, O e I não existem; tamanho errado)", () => {
    for (const typed of ["ENC-0000-1111", "ENC-7K3Q", "ENC-7K3Q-9M2XA", "", null, "123.456.789-09"]) {
      expect(normalizeCode(typed)).toBeNull();
    }
  });

  it("lê o código de dentro do QR (endereço da guia ou código puro)", () => {
    expect(codeFromQr("https://sincofarma-kappa.vercel.app/guia/ENC-7K3Q-9M2X")).toBe("ENC-7K3Q-9M2X");
    expect(codeFromQr("https://outro.site/guia/enc-7k3q-9m2x?x=1")).toBe("ENC-7K3Q-9M2X");
    expect(codeFromQr("ENC-7K3Q-9M2X")).toBe("ENC-7K3Q-9M2X");
    expect(codeFromQr("https://exemplo.com/qualquer")).toBeNull();
  });

  it("monta o endereço que vai no QR", () => {
    expect(guideUrl("ENC-7K3Q-9M2X", "https://sincofarma-kappa.vercel.app")).toBe("https://sincofarma-kappa.vercel.app/guia/ENC-7K3Q-9M2X");
  });
});
