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
Config.overrideWebpackConfig((c) => ({
  ...c,
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
