"use client";

// Real QR code (replaces the decorative placeholder used on ID cards / verify
// stubs). Renders on-brand with rounded module styling.
import { QRCodeSVG } from "qrcode.react";

export function QRCode({
  value,
  size = 96,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="transparent"
      fgColor="rgb(182 255 42)" // brand accent
      level="M"
      marginSize={0}
      className={className}
    />
  );
}
