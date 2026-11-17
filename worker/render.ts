// Turns the preview SVG into a PNG with resvg, compiled to WebAssembly, and
// the Rubik font. Rubik is also what Landfall's previews use.
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import rubikMedium from '@expo-google-fonts/rubik/500Medium/Rubik_500Medium.ttf';
import rubikBold from '@expo-google-fonts/rubik/700Bold/Rubik_700Bold.ttf';
import rubikExtraBold from '@expo-google-fonts/rubik/800ExtraBold/Rubik_800ExtraBold.ttf';

let ready: Promise<void> | null = null;
const fonts = [rubikMedium, rubikBold, rubikExtraBold].map((f) => new Uint8Array(f));

export async function renderPng(svg: string): Promise<Uint8Array<ArrayBuffer>> {
  ready ??= initWasm(resvgWasm).catch((err: unknown) => {
    ready = null;
    throw err;
  });
  await ready;
  const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Rubik', loadSystemFonts: false } });
  try {
    const image = resvg.render();
    try {
      return image.asPng() as Uint8Array<ArrayBuffer>;
    } finally {
      image.free();
    }
  } finally {
    resvg.free();
  }
}
