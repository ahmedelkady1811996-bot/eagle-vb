import { hexToFigmaRGB, figmaRGBToHex, hexToOklch } from "./color-utils-module"
import { paletteComponent } from "./palette-component-styling";
import { buildCssExports } from "./css-export-build"
import { PaletteItem, ExportOpts, UIMessage } from "./types";


figma.showUI(__html__);
figma.ui.resize(260, 640);

// Main handler
figma.ui.onmessage = async (msg: UIMessage) => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  switch (msg.type) {
    case "create-from-ui": {
      const colors = msg.colorPaletteObjects;

      // build exports
      const built = buildCssExports(colors);
      const selected = selectExports(built, msg.exportOpts);

      // send back to UI (modal)
      figma.ui.postMessage({ type: "exports-ready", exports: selected });

      // build frames
      const container = createColorGroupContainer();
      for (const item of colors) {
        const card = createPaletteCard(item, {
          optionHex: msg.optionHex,
          optionName: msg.optionName,
          optionNone: msg.optionNone,
        });
        container.appendChild(card);
      }

      figma.currentPage.appendChild(container);
      figma.viewport.scrollAndZoomIntoView([container]);
      return;
    }

    case "create-from-local-styles": {
      const locals = await getLocalStyleColors();

      //  send locals back 
      figma.ui.postMessage({ type: "localStyles-ready", local: locals });
      return;
    }
  }


  
};


//UI building 
function createColorGroupContainer() {
  const { styles } = paletteComponent;

  const colorGroupContainer = figma.createFrame();
  colorGroupContainer.layoutMode = "HORIZONTAL";
  colorGroupContainer.primaryAxisSizingMode = "AUTO";
  colorGroupContainer.counterAxisSizingMode = "AUTO";
  colorGroupContainer.layoutWrap = "WRAP";
  colorGroupContainer.maxWidth = 1524;

  colorGroupContainer.counterAxisSpacing = styles.colorGroupContainer.spacingZ;
  colorGroupContainer.itemSpacing = styles.colorGroupContainer.spacingY;
  colorGroupContainer.paddingTop = styles.colorGroupContainer.paddingY;
  colorGroupContainer.paddingBottom = styles.colorGroupContainer.paddingY;
  colorGroupContainer.paddingLeft = styles.colorGroupContainer.paddingX;
  colorGroupContainer.paddingRight = styles.colorGroupContainer.paddingX;

  colorGroupContainer.primaryAxisAlignItems = "CENTER";
  colorGroupContainer.cornerRadius = styles.colorGroupContainer.cornerRadius;

  colorGroupContainer.fills = [
    { type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 }, opacity: 1 },
  ];

  return colorGroupContainer;
}

function createPaletteCard(
  item: PaletteItem,
  opts: { optionHex: boolean; optionName: boolean; optionNone: boolean;  },
) {
    const { styles } = paletteComponent;
    const containerStyles = styles.textNodeContainer;

    // text
    const hexText = figma.createText();
    hexText.characters = item.hexCode;
    hexText.fontSize = 24;
    hexText.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5 }];

    const nameText = figma.createText();
    nameText.characters = item.hexName || "";
    nameText.fontSize = 16;

    const textNodeContainer = figma.createFrame();
    textNodeContainer.layoutMode = containerStyles.direction;
    textNodeContainer.counterAxisAlignItems = containerStyles.alignChildren;
    textNodeContainer.primaryAxisSizingMode = containerStyles.xaxisSizing;
    textNodeContainer.counterAxisSizingMode = containerStyles.zaxisSizing;

    textNodeContainer.fills = [
      {
        type: containerStyles.backgroundType,
        color: {
          r: containerStyles.backgroundColor[0],
          g: containerStyles.backgroundColor[1],
          b: containerStyles.backgroundColor[2],
        },
        opacity: containerStyles.opacity,
      },
    ];

  
      if (opts.optionHex) {

          textNodeContainer.appendChild(hexText);
          !opts.optionName && nameText.remove();

      }

      if (opts.optionName) {
        
          textNodeContainer.appendChild(nameText);
          !opts.optionHex && hexText.remove();

      }

      if (!opts.optionHex && !opts.optionName) {

          textNodeContainer.visible = false;
          hexText.remove();
          nameText.remove();
          
      }

    // color block
    const colorBlock = figma.createRectangle();
    colorBlock.resize(styles.colorBlock.width, styles.colorBlock.height);
    colorBlock.cornerRadius = styles.colorBlock.cornerRadius;
    colorBlock.fills = [{ type: "SOLID", color: hexToFigmaRGB(item.hexCode) }];

    // wrap
    const wrapPalette = figma.createFrame();
    wrapPalette.layoutMode = "VERTICAL";
    wrapPalette.primaryAxisSizingMode = "AUTO";
    wrapPalette.counterAxisSizingMode = "AUTO";

    wrapPalette.paddingTop = styles.wrapPalette.padding.top;
    wrapPalette.paddingBottom = styles.wrapPalette.padding.bottom;
    wrapPalette.paddingLeft = styles.wrapPalette.padding.left;
    wrapPalette.paddingRight = styles.wrapPalette.padding.right;
    wrapPalette.itemSpacing = styles.wrapPalette.spacing;

    wrapPalette.cornerRadius = styles.wrapPalette.cornerRadius;
    wrapPalette.fills = [{ type: "SOLID", color: styles.wrapPalette.fillColor }];
    wrapPalette.strokes = [{ type: "SOLID", color: styles.wrapPalette.strokeColor }];
    wrapPalette.strokeWeight = 0.8;

    wrapPalette.effects = [
      {
        type: "DROP_SHADOW",
        color: { r: 0.804, g: 0.788, b: 0.788, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 4,
        visible: true,
        spread: 0,
        blendMode: "NORMAL",
      },
    ];

    wrapPalette.primaryAxisAlignItems = "CENTER";
    wrapPalette.appendChild(colorBlock);
    wrapPalette.appendChild(textNodeContainer);

    return wrapPalette;
  }
  //////////////////////////////////////
  function selectExports(
    built: { cssVars: string[]; scssVars: string[]; tailwindRgbRefs: string[]; tailwindv4Vars: string[] },
    opts: ExportOpts
  ) {
    return {
      cssVars: opts.cssVars ? built.cssVars : null,
      scssVars: opts.scssVars ? built.scssVars : null,
      tailwindRgbRefs: opts.tailwindRgbRefs ? built.tailwindRgbRefs : null,
      tailwindv4Vars: opts.tailwindv4Vars ? built.tailwindv4Vars : null,
    };
}


// ---------- Local styles ----------
async function getLocalStyleColors(): Promise<PaletteItem[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const out: PaletteItem[] = [];

  for (const s of styles) {
    const paint = s.paints?.[0];
    if (!paint || paint.type !== "SOLID") continue;

    const { r, g, b } = paint.color;
    out.unshift({
      id: undefined,
      hexCode: figmaRGBToHex(r, g, b),
      hexName: s.name,
    });

    // console.log(out)
  }

  return out;
}

