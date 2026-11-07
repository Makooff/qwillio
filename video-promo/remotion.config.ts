import path from 'path';
import { Config } from '@remotion/cli/config';

// Le Chromium de la machine plutôt qu'un téléchargement.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');

// La façade d'icônes du portail (frontend/src/components/icons.tsx) est importée
// telle quelle. Elle résout `react-coolicons` et `react` depuis ce dossier, pour
// qu'il n'y ait qu'un seul React dans le film.
// Les feuilles du site écrivent leurs photos en chemin absolu (`url('/marketing/…')`),
// servi par le site depuis `public/`. css-loader ne doit pas chercher à les résoudre :
// le navigateur les demande au serveur de rendu, qui sert `public/` du film.
const keepRootUrls = (rules: any[]): any[] =>
  rules.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const out = { ...r };
    if (Array.isArray(out.use)) {
      out.use = out.use.map((u: any) => {
        const loader = typeof u === 'string' ? u : u?.loader;
        if (typeof loader !== 'string' || !/[\\/]css-loader[\\/]/.test(loader)) return u;
        const options = typeof u === 'object' ? u.options ?? {} : {};
        return { loader, options: { ...options, url: (url: string) => !url.startsWith('/') } };
      });
    }
    if (Array.isArray(out.oneOf)) out.oneOf = keepRootUrls(out.oneOf);
    if (Array.isArray(out.rules)) out.rules = keepRootUrls(out.rules);
    return out;
  });

Config.overrideWebpackConfig((c) => ({
  ...c,
  module: { ...c.module, rules: keepRootUrls(c.module?.rules ?? []) },
  resolve: {
    ...c.resolve,
    alias: {
      ...(c.resolve?.alias ?? {}),
      react: path.resolve('node_modules/react'),
      'react-dom': path.resolve('node_modules/react-dom'),
      'react-coolicons': path.resolve('node_modules/react-coolicons'),
    },
  },
}));
