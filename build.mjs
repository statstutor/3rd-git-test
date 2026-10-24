// Packs src/ into one self-contained, offline delve.html (fonts embedded). `npm run build`.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const font = (file) => readFileSync(new URL(`./assets/fonts/${file}`, import.meta.url)).toString('base64');
const fonts = `
@font-face{font-family:Metamorphous;font-weight:400;src:url(data:font/woff2;base64,${font('metamorphous.woff2')}) format('woff2');}
@font-face{font-family:Alegreya;font-weight:400 900;src:url(data:font/woff2;base64,${font('alegreya.woff2')}) format('woff2');}
@font-face{font-family:Alegreya;font-style:italic;font-weight:400;src:url(data:font/woff2;base64,${font('alegreya-italic.woff2')}) format('woff2');}
`;

const js = await build({
  entryPoints: ['src/ui/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});

const css = readFileSync('src/ui/style.css', 'utf8');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const html = readFileSync('src/ui/index.html', 'utf8')
  .replace('/*VERSION*/', () => version)
  .replace('/*FONTS*/', () => fonts)
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));

mkdirSync('dist', { recursive: true });
writeFileSync('dist/delve.html', html);
console.log(`dist/delve.html — ${(html.length / 1024).toFixed(0)} KB`);
