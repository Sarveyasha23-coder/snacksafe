"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { isValidGtin } from "@/lib/barcodes";

export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let active = true;
    let controls: { stop: () => void } | undefined;
    const reader = new BrowserMultiFormatReader();
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setStatus("Camera access requires HTTPS or localhost. Enter the barcode manually below.");
        return;
      }
      try {
        const started = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _error, scanControls) => {
          controls = scanControls;
          if (result && active) {
            const code = result.getText().trim();
            if (!isValidGtin(code)) {
              setStatus("A barcode was detected, but its check digit is invalid or its format is unsupported. Try the printed EAN/UPC code manually.");
              return;
            }
            controls.stop();
            onDetected(code);
          }
        });
        controls = started;
        if (active) setStatus("Point your camera at the product barcode.");
        else started.stop();
      } catch {
        if (active) setStatus("Camera permission was denied or the camera is unavailable. Enter the barcode manually below.");
      }
    }
    start();
    return () => {
      active = false;
      controls?.stop();
      reader.reset();
    };
  }, [onDetected]);

  return <div className="scanner-backdrop" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
    <div className="scanner-modal">
      <div className="scanner-heading"><div><div className="eyebrow">Product identification</div><h2 id="scanner-title">Scan a barcode</h2></div><button className="icon-button" onClick={onClose} aria-label="Close scanner">✕</button></div>
      <div className="camera-frame"><video ref={videoRef} muted playsInline /><div className="scan-line" /></div>
      <p className="muted scanner-status" role="status">{status}</p>
      <form className="manual-code" onSubmit={e => { e.preventDefault(); if (isValidGtin(manualCode.trim())) onDetected(manualCode.trim()); }}>
        <label htmlFor="manual-barcode">Or enter a valid EAN-8, UPC-A, EAN-13 or GTIN-14</label>
        <div><input id="manual-barcode" inputMode="numeric" autoComplete="off" maxLength={14} placeholder="Enter the digits printed below the barcode" value={manualCode} onChange={e => setManualCode(e.target.value.replace(/\D/g, ""))}/><button className="primary" disabled={!isValidGtin(manualCode.trim())}>Look up</button></div>
        {manualCode.length > 0 && !isValidGtin(manualCode) && <p className="error" role="status">Check the barcode length and final check digit.</p>}
      </form>
      <p className="scanner-footnote">Camera scanning requires HTTPS or localhost and camera permission. UPC-E is not currently supported. Lookup uses Open Food Facts; a missing listing does not mean the product is unsafe.</p>
    </div>
  </div>;
}
