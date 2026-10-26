// Styles 
const paletteComponent = {
  styles: {
    textNodeContainer: {
      direction: "VERTICAL",
      alignChildren: "CENTER",
      backgroundType: "SOLID",
      backgroundColor: [0, 0, 0] as const,
      opacity: 0,
      xaxisSizing: "AUTO",
      zaxisSizing: "AUTO",
    },
    colorBlock: { width: 199, height: 230, cornerRadius: 8 },
    wrapPalette: {
      padding: { top: 24, bottom: 24, left: 19, right: 19 },
      cornerRadius: 14,
      spacing: 24,
      fillColor: { r: 0.898, g: 0.898, b: 0.898 },
      strokeColor: { r: 0.7, g: 0.7, b: 0.7 },
    },
    colorGroupContainer: {
      paddingY: 37,
      paddingX: 4,
      cornerRadius: 16,
      spacingY: 73,
      spacingZ: 34,
    },
  },
} as const;

export {paletteComponent}