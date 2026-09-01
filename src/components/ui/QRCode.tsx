"use client";

import { useEffect, useState } from "react";
import QR from "qrcode";
import { cn } from "@/lib/cn";

/** Renders `value` as a QR data-URI. White quiet zone so it scans off a
 * dark screen or a printed sheet. */
export function QRCode({
  value,
  size = 200,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QR.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#08080d", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <span
      className={cn("inline-block overflow-hidden rounded-xl border-[3px] border-ink bg-white", className)}
      style={{ width: size, height: size }}
    >
      {src && <img src={src} alt="" width={size} height={size} />}
    </span>
  );
}
