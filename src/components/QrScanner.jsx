import { useEffect, useRef, useState } from "react";
import { CameraOff, ImageUp, ScanLine } from "lucide-react";

// leitura de um quadro a cada ~180 ms: leve para o computador do balcão
const INTERVAL_MS = 180;
// o jsQR só é baixado quando o leitor abre (não pesa nas outras telas)
const loadJsQr = () => import("jsqr").then((m) => m.default);

/** Desenha a imagem num canvas e procura um QR code nela. */
function decode(jsQR, canvas, source, width, height, attempts) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  return jsQR(img.data, width, height, { inversionAttempts: attempts })?.data ?? null;
}

/**
 * Lê um QR code pela câmera ou por uma foto. `onResult(texto)` recebe o conteúdo lido
 * (precisa ser estável: useCallback). A imagem da câmera não sai do navegador.
 */
export default function QrScanner({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | live | denied | nocamera | unsupported | error
  const [fileMsg, setFileMsg] = useState("");

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        const jsQR = await loadJsQr();
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus("unsupported");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("live");
        let last = 0;
        const tick = (t) => {
          if (stopped) return;
          if (t - last >= INTERVAL_MS && video.readyState >= 2 && video.videoWidth) {
            last = t;
            const found = decode(jsQR, canvasRef.current, video, video.videoWidth, video.videoHeight, "dontInvert");
            if (found) {
              stopped = true;
              onResult(found);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (stopped) return;
        const name = err?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "nocamera" : "error");
      }
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  async function fromFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileMsg("Procurando o QR code na imagem…");
    try {
      const jsQR = await loadJsQr();
      const bmp = await createImageBitmap(file);
      // fotos de celular são grandes: reduz para ler mais rápido sem perder o QR
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const found = decode(jsQR, canvasRef.current, bmp, Math.round(bmp.width * scale), Math.round(bmp.height * scale), "attemptBoth");
      bmp.close?.();
      if (found) {
        setFileMsg("");
        onResult(found);
      } else {
        setFileMsg("Não achei um QR code nessa imagem. Tente uma foto mais de perto, reta e com boa luz.");
      }
    } catch {
      setFileMsg("Não foi possível abrir essa imagem.");
    }
  }

  const problem = {
    denied: "O navegador bloqueou a câmera. Libere a câmera para este site (ícone ao lado do endereço) ou envie uma foto da guia.",
    nocamera: "Nenhuma câmera encontrada neste computador. Envie uma foto da guia ou digite o código.",
    unsupported: "Este navegador não permite usar a câmera aqui. Envie uma foto da guia ou digite o código.",
    error: "Não foi possível ligar a câmera. Envie uma foto da guia ou digite o código.",
  }[status];

  return (
    <div className="qr-scanner">
      <div className={`qr-view${status === "live" ? " is-live" : ""}`}>
        <video ref={videoRef} muted playsInline aria-label="Imagem da câmera" />
        {status === "live" && (
          <span className="qr-frame" aria-hidden="true">
            <i /><i /><i /><i />
            <span className="qr-line" />
          </span>
        )}
        {status === "starting" && <p className="qr-msg"><ScanLine size={18} /> Ligando a câmera…</p>}
        {problem && <p className="qr-msg qr-msg--warn"><CameraOff size={18} /> {problem}</p>}
      </div>
      <canvas ref={canvasRef} hidden />
      <p className="qr-help" aria-live="polite">
        {status === "live" ? "Aponte a câmera para o QR code impresso na guia. A leitura é automática." : ""}
      </p>
      <label className="btn btn--ghost qr-file">
        <ImageUp size={16} /> Enviar foto da guia
        <input type="file" accept="image/*" onChange={fromFile} hidden />
      </label>
      {fileMsg && <p className="qr-file-msg" role="status">{fileMsg}</p>}
    </div>
  );
}
