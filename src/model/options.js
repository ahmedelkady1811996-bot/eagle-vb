export const FONTS = [
  { v: 'system-ui, -apple-system, Segoe UI, sans-serif', l: 'System UI' },
  { v: 'Inter, system-ui, sans-serif', l: 'Inter' },
  { v: 'Poppins, system-ui, sans-serif', l: 'Poppins' },
  { v: 'Montserrat, system-ui, sans-serif', l: 'Montserrat' },
  { v: 'Roboto, system-ui, sans-serif', l: 'Roboto' },
  { v: 'Open Sans, system-ui, sans-serif', l: 'Open Sans' },
  { v: 'Lato, system-ui, sans-serif', l: 'Lato' },
  { v: 'Nunito, system-ui, sans-serif', l: 'Nunito' },
  { v: 'Raleway, system-ui, sans-serif', l: 'Raleway' },
  { v: 'Work Sans, system-ui, sans-serif', l: 'Work Sans' },
  { v: 'DM Sans, system-ui, sans-serif', l: 'DM Sans' },
  { v: 'Manrope, system-ui, sans-serif', l: 'Manrope' },
  { v: 'Outfit, system-ui, sans-serif', l: 'Outfit' },
  { v: 'Space Grotesk, system-ui, sans-serif', l: 'Space Grotesk' },
  { v: 'Cairo, system-ui, sans-serif', l: 'Cairo' },
  { v: 'Amiri, Georgia, serif', l: 'Amiri' },
  { v: 'Playfair Display, Georgia, serif', l: 'Playfair' },
  { v: 'Georgia, serif', l: 'Georgia' },
  { v: 'Times New Roman, Times, serif', l: 'Times New Roman' },
  { v: 'Arial, Helvetica, sans-serif', l: 'Arial' },
  { v: 'Helvetica, Arial, sans-serif', l: 'Helvetica' },
  { v: 'Verdana, Geneva, sans-serif', l: 'Verdana' },
  { v: 'Tahoma, Geneva, sans-serif', l: 'Tahoma' },
  { v: 'Trebuchet MS, sans-serif', l: 'Trebuchet MS' },
  { v: 'Courier New, Courier, monospace', l: 'Courier New' },
  { v: 'ui-monospace, SFMono-Regular, Menlo, monospace', l: 'Mono' },
];

/** Merge curated fonts with fonts available on this device (Local Font Access API when allowed). */
async function loadDeviceFonts() {
  const base = FONTS.slice();
  const seen = new Set(base.map((f) => f.l.toLowerCase()));
  try {
    if (typeof queryLocalFonts === 'function') {
      const local = await queryLocalFonts();
      const names = [];
      for (const f of local) {
        const family = f.family;
        if (!family || seen.has(family.toLowerCase())) continue;
        seen.add(family.toLowerCase());
        names.push(family);
      }
      names.sort((a, b) => a.localeCompare(b));
      for (const family of names.slice(0, 120)) {
        base.push({ v: '"' + family.replace(/"/g, '') + '", system-ui, sans-serif', l: family });
      }
    }
  } catch (e) {
    void e;
  }
  // Fallback probes for common desktop fonts
  const probe = ['Segoe UI', 'Calibri', 'Cambria', 'Garamond', 'Palatino Linotype', 'Lucida Console', 'Comic Sans MS', 'Impact', 'Candara', 'Consolas', 'Noto Sans Arabic', 'Noto Naskh Arabic', 'Traditional Arabic', 'Simplified Arabic'];
  for (const family of probe) {
    if (seen.has(family.toLowerCase())) continue;
    seen.add(family.toLowerCase());
    base.push({ v: '"' + family + '", system-ui, sans-serif', l: family + ' (device)' });
  }
  return base;
}

export const FONT_STYLE = [
  { v: 'normal', l: 'Normal' },
  { v: 'italic', l: 'Italic' },
  { v: 'oblique', l: 'Oblique' },
];


export const ALIGN = [
  { v: 'flex-start', l: 'Start' },
  { v: 'center', l: 'Center' },
  { v: 'flex-end', l: 'End' },
  { v: 'stretch', l: 'Stretch' },
  { v: 'baseline', l: 'Baseline' },
];

export const JUSTIFY = [
  { v: 'flex-start', l: 'Start' },
  { v: 'center', l: 'Center' },
  { v: 'flex-end', l: 'End' },
  { v: 'space-between', l: 'Between' },
  { v: 'space-around', l: 'Around' },
  { v: 'space-evenly', l: 'Evenly' },
];

export const DISPLAY = [
  { v: 'block', l: 'Block' },
  { v: 'flex', l: 'Flex' },
  { v: 'grid', l: 'Grid' },
  { v: 'inline-flex', l: 'Inline Flex' },
];

export const FLEX_DIR = [
  { v: 'column', l: 'Vertical' },
  { v: 'row', l: 'Horizontal' },
  { v: 'row-reverse', l: 'Row Rev' },
  { v: 'column-reverse', l: 'Column Rev' },
];

export const TEXT_ALIGN = [
  { v: 'left', l: 'Left' },
  { v: 'center', l: 'Center' },
  { v: 'right', l: 'Right' },
  { v: 'justify', l: 'Justify' },
];

export const FONT_WEIGHT = [
  { v: '300', l: 'Light' },
  { v: '400', l: 'Regular' },
  { v: '500', l: 'Medium' },
  { v: '600', l: 'Semibold' },
  { v: '700', l: 'Bold' },
  { v: '800', l: 'Extrabold' },
  { v: '900', l: 'Black' },
];

export const TEXT_CASE = [
  { v: 'none', l: 'None' },
  { v: 'uppercase', l: 'Uppercase' },
  { v: 'lowercase', l: 'Lowercase' },
  { v: 'capitalize', l: 'Capitalize' },
];

export const DECOR = [
  { v: 'none', l: 'None' },
  { v: 'underline', l: 'Underline' },
  { v: 'line-through', l: 'Strike' },
];

export const BORDER_STYLE = [
  { v: 'solid', l: 'Solid' },
  { v: 'dashed', l: 'Dashed' },
  { v: 'dotted', l: 'Dotted' },
  { v: 'none', l: 'None' },
];

export const OBJECT_FIT = [
  { v: 'cover', l: 'Cover' },
  { v: 'contain', l: 'Contain' },
  { v: 'fill', l: 'Stretch' },
  { v: 'none', l: 'Original' },
  { v: 'center', l: 'Center' },
];

export const BLEND = [
  { v: 'normal', l: 'Normal' },
  { v: 'multiply', l: 'Multiply' },
  { v: 'screen', l: 'Screen' },
  { v: 'overlay', l: 'Overlay' },
  { v: 'darken', l: 'Darken' },
  { v: 'lighten', l: 'Lighten' },
  { v: 'color-dodge', l: 'Color Dodge' },
  { v: 'color-burn', l: 'Color Burn' },
  { v: 'hard-light', l: 'Hard Light' },
  { v: 'soft-light', l: 'Soft Light' },
  { v: 'difference', l: 'Difference' },
  { v: 'exclusion', l: 'Exclusion' },
  { v: 'hue', l: 'Hue' },
  { v: 'luminosity', l: 'Luminosity' },
];

export const SHADOWS = [
  { v: 'none', l: 'None' },
  { v: '0 1px 2px rgba(0,0,0,.08)', l: 'XS' },
  { v: '0 2px 6px rgba(0,0,0,.10)', l: 'SM' },
  { v: '0 6px 16px rgba(0,0,0,.12)', l: 'MD' },
  { v: '0 14px 32px rgba(0,0,0,.16)', l: 'LG' },
  { v: '0 24px 56px rgba(0,0,0,.20)', l: 'XL' },
  { v: 'inset 0 1px 2px rgba(0,0,0,.14)', l: 'Inset' },
];

export const GRADIENTS = [
  { v: '', l: 'None' },
  { v: 'linear-gradient(135deg,#6366f1,#8b5cf6)', l: 'Indigo' },
  { v: 'linear-gradient(135deg,#3b82f6,#06b6d4)', l: 'Ocean' },
  { v: 'linear-gradient(135deg,#f59e0b,#ef4444)', l: 'Sunset' },
  { v: 'linear-gradient(135deg,#10b981,#3b82f6)', l: 'Mint' },
  { v: 'linear-gradient(135deg,#f43f5e,#a855f7)', l: 'Candy' },
  { v: 'linear-gradient(135deg,#0f172a,#334155)', l: 'Slate' },
  { v: 'radial-gradient(circle at 30% 20%,#6366f1,#1e1b4b)', l: 'Glow' },
  { v: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55))', l: 'Fade down' },
];

export const FILTERS = [
  { v: 'none', l: 'None' },
  { v: 'blur(4px)', l: 'Blur 4' },
  { v: 'blur(12px)', l: 'Blur 12' },
  { v: 'brightness(1.15)', l: 'Bright' },
  { v: 'brightness(.85)', l: 'Dim' },
  { v: 'contrast(1.25)', l: 'Contrast' },
  { v: 'saturate(1.4)', l: 'Saturate' },
  { v: 'grayscale(1)', l: 'Grayscale' },
  { v: 'sepia(.7)', l: 'Sepia' },
  { v: 'invert(1)', l: 'Invert' },
];

export const ANIMATIONS = [
  { v: 'none', l: 'None' },
  { v: 'fade', l: 'Fade in' },
  { v: 'fade-up', l: 'Fade up' },
  { v: 'fade-down', l: 'Fade down' },
  { v: 'fade-left', l: 'Fade left' },
  { v: 'fade-right', l: 'Fade right' },
  { v: 'zoom', l: 'Zoom in' },
  { v: 'pop', l: 'Pop' },
  { v: 'slide-up', l: 'Slide up' },
  { v: 'slide-down', l: 'Slide down' },
  { v: 'flip', l: 'Flip' },
  { v: 'pulse', l: 'Pulse' },
  { v: 'bounce', l: 'Bounce' },
  { v: 'spin', l: 'Spin' },
  { v: 'blur-in', l: 'Blur in' },
  { v: 'typing', l: 'Typing' },
];

export const EASES = [
  { v: 'ease', l: 'Ease' },
  { v: 'ease-in', l: 'Ease in' },
  { v: 'ease-out', l: 'Ease out' },
  { v: 'ease-in-out', l: 'Ease in-out' },
  { v: 'linear', l: 'Linear' },
  { v: 'cubic-bezier(.34,1.56,.64,1)', l: 'Spring' },
];

export const BREAKPOINTS = [
  { v: 'desktop', l: 'Desktop', w: 1280 },
  { v: 'tablet', l: 'Tablet', w: 834 },
  { v: 'mobile', l: 'Mobile', w: 390 },
];

export function breakpointWidth(name) {
  const hit = BREAKPOINTS.find((b) => b.v === name);
  return hit ? hit.w : 1280;
}

export { loadDeviceFonts };
