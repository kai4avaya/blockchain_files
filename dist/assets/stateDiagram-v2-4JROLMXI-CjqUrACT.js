import { s as stateDiagram_default, a as stateDb_default, c as stateRenderer_v3_unified_default, b as styles_default } from './chunk-7U56Z5CX-DFOL5UtR.js';
import { _ as __name } from './index-CZEwXjve.js';
import './chunk-5HRBRIJM-B7wL8sJR.js';
import './worker-CBGrwT8c.js';

// src/diagrams/state/stateDiagram-v2.ts
var diagram = {
  parser: stateDiagram_default,
  db: stateDb_default,
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
    stateDb_default.clear();
  }, "init")
};

export { diagram };
