import { describe, it, expect } from "vitest";
import { isValidCpf, maskCpf, anonymizeCpf, applyMask } from "./cpf";

describe("cpf", () => {
  it("valida CPFs pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("aplica a máscara progressivamente", () => {
    expect(maskCpf("5")).toBe("5");
    expect(maskCpf("5299")).toBe("529.9");
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("529982247259999")).toBe("529.982.247-25");
    expect(applyMask("61999990000", "(##) #####-####")).toBe("(61) 99999-0000");
  });

  it("anonimiza deixando só os dígitos verificadores", () => {
    expect(anonymizeCpf("529.982.247-25")).toBe("***.***.***-25");
    expect(anonymizeCpf("123")).toBe("***.***.***-**");
  });
});

describe("CNPJ", () => {
  it("confere os dígitos verificadores", async () => {
    const { isValidCnpj, maskCnpj } = await import("./cpf");
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000100")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});
