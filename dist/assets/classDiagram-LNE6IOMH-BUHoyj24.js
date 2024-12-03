import { c as classDiagram_default, a as classDb_default, b as classRenderer_v3_unified_default, s as styles_default } from './chunk-T2TOU4HS-DHmo6NIa.js';
import { _ as __name } from './index-CZEwXjve.js';
import './chunk-5HRBRIJM-B7wL8sJR.js';
import './worker-CBGrwT8c.js';

// src/diagrams/class/classDiagram.ts
var diagram = {
  parser: classDiagram_default,
  db: classDb_default,
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
    classDb_default.clear();
  }, "init")
};

export { diagram };
