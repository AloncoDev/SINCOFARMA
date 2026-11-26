// Código da guia de encaminhamento: ENC-XXXX-XXXX (mesmas regras do servidor,
// backend/src/painel/comum/encaminhamentos.py). Sem letras e números que se confundem.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
const CODE_RE = new RegExp(`^(?:ENC)?([${CODE_ALPHABET}]{8})$`);

/** "enc 7k3q-9m2x", "ENC7K3Q9M2X" ou "7K3Q9M2X" → "ENC-7K3Q-9M2X" (ou null se não for um código). */
export function normalizeCode(text) {
  const m = String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").match(CODE_RE);
  return m ? `ENC-${m[1].slice(0, 4)}-${m[1].slice(4)}` : null;
}

/** Endereço que vai no QR code da guia (abre o painel já na guia, depois do login). */
export const guideUrl = (code, origin = window.location.origin) => `${origin}/guia/${code}`;

/** Código lido de um QR: aceita o endereço da guia (…/guia/ENC-…) ou o código puro. */
export function codeFromQr(text) {
  const raw = String(text ?? "").trim();
  const fromUrl = raw.match(/\/guia\/([^/?#\s]+)/i);
  return normalizeCode(fromUrl ? decodeURIComponent(fromUrl[1]) : raw);
}

// QR lido pela câmera do celular, fora do painel: abre /guia/<código> sem login. Guarda o
// destino para, depois de entrar, voltar à guia (só caminhos /guia/, nada mais).
const RETURN_KEY = "sinco:guia-depois-login";

export function rememberGuide(path) {
  if (!/^\/guia\/[A-Za-z0-9-]{1,20}$/.test(path)) return;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* sem armazenamento: depois do login vai para a tela inicial */
  }
}

export function pendingGuide() {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    return path && /^\/guia\/[A-Za-z0-9-]{1,20}$/.test(path) ? path : null;
  } catch {
    return null;
  }
}

export function forgetGuide() {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignora */
  }
}
