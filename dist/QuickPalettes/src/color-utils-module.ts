// ---------- Color utils ----------
import { useOklchConverter } from "@builtwithjavascript/oklch-converter";
const {hexToOklchString} = useOklchConverter()

function hexToFigmaRGB(hex: string) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  const num = parseInt(hex, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function figmaRGBToHex(r: number, g: number, b: number) {
  const toHex = (value: number) =>
    Math.round(value * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToOklch(hex: string){

  const parsedHexOklcxh = hexToOklchString(hex)
  return parsedHexOklcxh
}

export { hexToFigmaRGB, figmaRGBToHex, hexToOklch}