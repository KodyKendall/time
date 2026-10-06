// Core only: animates numeric rig channels; no DOM/CSS plugin required.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../node_modules/gsap/gsap-core.js', import.meta.url),
  new URL('../web/vendor/gsap-core.js', import.meta.url));
