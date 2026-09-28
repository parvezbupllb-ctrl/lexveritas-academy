"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";

export function ExamQr({ examId, title, path }: { examId: string; title: string; path?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}${path || `/exams/${examId}`}`;
    QRCode.toDataURL(url, {
      width: 720,
      margin: 2,
      color: { dark: "#10243c", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setSrc);
  }, [examId, path]);
  return (
    <div className="exam-qr">
      {src ? (
        <img src={src} alt={`${title} examination QR code`} />
      ) : (
        <QrCode size={88} aria-label="Generating QR code" />
      )}
      <div>
        <h3>Scan to open this examination</h3>
        <p>The QR code opens the secure exam entry page.</p>
        {src && (
          <div className="actions wrap">
            <button className="btn outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${path || `/exams/${examId}`}`)}>Copy Exam Link</button>
            <a className="btn outline" href={src} download={`${title}-QR.png`}>
              <Download size={16} /> Download QR
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
