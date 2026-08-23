import { definePluginConfig } from '@pensiv/build-config';

// Builds to dist/main.js + dist/styles.css, with react, @pensiv/* and the
// host's ProseMirror copy left external (a second PM copy poisons the editor's
// decoration pipeline — see @pensiv/build-config).
export default definePluginConfig({ entry: 'src/main.tsx' });
