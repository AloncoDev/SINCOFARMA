import { afterEach, describe, expect, it, vi } from "vitest";

// com o ID do user pool configurado, o login usa SRP
vi.stubEnv("VITE_COGNITO_REGION", "sa-east-1");
vi.stubEnv("VITE_COGNITO_CLIENT_ID", "cliente-teste");
vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "sa-east-1_AbC123");
const cognito = await import("./cognito");

const SRP_B = "a".repeat(512); // qualquer valor diferente de 0 mod N serve para montar a prova
const TOKENS = { AccessToken: "a", IdToken: "i", RefreshToken: "r", ExpiresIn: 900 };

function mockCognito(...responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    calls.push({ target: init.headers["X-Amz-Target"].split(".").pop(), body: JSON.parse(init.body) });
    const { status = 200, body } = responses.shift();
    return { ok: status < 400, json: async () => body };
  });
  return calls;
}

describe("login por SRP", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("a senha não sai do navegador: vai só a prova (PASSWORD_VERIFIER)", async () => {
    const calls = mockCognito(
      {
        body: {
          ChallengeName: "PASSWORD_VERIFIER",
          Session: "s1",
          ChallengeParameters: { SRP_B, SALT: "1f2e3d", SECRET_BLOCK: btoa("bloco"), USER_ID_FOR_SRP: "06590146101", USERNAME: "06590146101" },
        },
      },
      { body: { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "s2", ChallengeParameters: { USER_ID_FOR_SRP: "06590146101" } } },
      { body: { AuthenticationResult: TOKENS } }
    );

    const err = await cognito.initiateAuth("crf4192", "SenhaForte2026").catch((e) => e);
    expect(err.challenge).toBe("SOFTWARE_TOKEN_MFA");
    await cognito.answerTotp(err, "123456");

    expect(calls[0]).toMatchObject({ target: "InitiateAuth", body: { AuthFlow: "USER_SRP_AUTH", AuthParameters: { USERNAME: "crf4192" } } });
    expect(calls[0].body.AuthParameters.SRP_A).toMatch(/^[0-9a-f]+$/);
    expect(calls[1].body).toMatchObject({
      ChallengeName: "PASSWORD_VERIFIER",
      Session: "s1",
      // a prova usa o nome interno do usuário, não o alias do CRF
      ChallengeResponses: { USERNAME: "06590146101", PASSWORD_CLAIM_SECRET_BLOCK: btoa("bloco") },
    });
    expect(calls[1].body.ChallengeResponses.PASSWORD_CLAIM_SIGNATURE).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(calls[1].body.ChallengeResponses.TIMESTAMP).toMatch(/UTC \d{4}$/);
    expect(JSON.stringify(calls)).not.toContain("SenhaForte2026");
  });

  it("senha errada: mensagem de sempre", async () => {
    mockCognito(
      { body: { ChallengeName: "PASSWORD_VERIFIER", Session: "s1", ChallengeParameters: { SRP_B, SALT: "1f", SECRET_BLOCK: btoa("b"), USER_ID_FOR_SRP: "u" } } },
      { status: 400, body: { __type: "NotAuthorizedException" } }
    );
    const err = await cognito.initiateAuth("06590146101", "errada").catch((e) => e);
    expect(err.message).toBe("CPF/CRF ou senha incorretos.");
  });
});
