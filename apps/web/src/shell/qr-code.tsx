import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders `value` as a QR code (a data: URL image, generated client-side —
 * no network call) — used for "scan to continue on another device" next to
 * a TxLink, not for any gno-specific wallet-pairing protocol (GnoConnect's
 * own docs don't define one yet, confirmed via docs.gno.land/resources/
 * gnoconnect: "Run Calls" is marked TODO). Scanning it just opens the same
 * URL a click would. */
export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div className="qr-code qr-code--loading" style={{ width: size, height: size }} aria-busy="true" />
    );
  }
  return <img className="qr-code" src={dataUrl} width={size} height={size} alt={`QR code for ${value}`} />;
}
