// -- Types --
type PaletteItem = {
  hexCode: string;
  hexName?: string | null;
  id?: number;
};

type ExportOpts = {
  cssVars: boolean;
  scssVars: boolean;
  tailwindRgbRefs: boolean;
  tailwindv4Vars: boolean
};

type UIMessage =
  | {

      type: "create-from-ui";
      colorPaletteObjects: PaletteItem[];
      optionHex: boolean;
      optionName: boolean;
      optionNone: boolean;
      exportOpts: ExportOpts;

    }
  | {

      type: "create-from-local-styles";
      optionHex: boolean;
      optionName: boolean;
      optionNone: boolean;
      exportOpts: ExportOpts;

    }; 

    export { PaletteItem, ExportOpts, UIMessage }