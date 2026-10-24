// Packs src/ into one self-contained, offline delve.html (fonts embedded). `npm run build`.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const font = (file) => readFileSync(new URL(`./assets/fonts/${file}`, import.meta.url)).toString('base64');
const fonts = `
@font-face{font-family:Metamorphous;font-weight:400;src:url(data:font/woff2;base64,${font('metamorphous.woff2')}) format('woff2');}
@font-face{font-family:Alegreya;font-weight:400 900;src:url(data:font/woff2;base64,${font('alegreya.woff2')}) format('woff2');}
@font-face{font-family:Alegreya;font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${font('alegreya-italic.woff2')}) format('woff2');}
`;

// Bundle one page: template + entry script → a self-contained file, plus a hosted variant
// without the document wrapper (the host supplies <html>, <head>, <body> and the meta tags).
async function page(template, entry, out) {
  const js = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    legalComments: 'none',
  });
  const css = existsSync('src/ui/style.css') && template.endsWith('index.html') ? readFileSync('src/ui/style.css', 'utf8') : '';
  const html = readFileSync(template, 'utf8')
    .replace('/*VERSION*/', () => version)
    .replace('/*FONTS*/', () => fonts)
    .replace('/*CSS*/', () => css)
    .replace('/*JS*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
  writeFileSync(`dist/${out}.html`, html);
  const hosted = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<\/?html[^>]*>\s*/gi, '')
    .replace(/<\/?head>\s*/gi, '')
    .replace(/<\/?body>\s*/gi, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
  writeFileSync(`dist/${out}-hosted.html`, hosted);
  console.log(`dist/${out}.html — ${(html.length / 1024).toFixed(0)} KB`);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
mkdirSync('dist', { recursive: true });
await page('src/ui/index.html', 'src/ui/main.js', 'delve');
await page('src/ui/music-sample.html', 'src/ui/music-sample.js', 'music-sample');
