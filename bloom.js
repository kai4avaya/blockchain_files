import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { SelectiveUnrealBloomPass } from '@visualsource/selective-unrealbloompass';

const BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

const params = {
  exposure: 1,
  bloomStrength: 1.5,
  bloomThreshold: 0,
  bloomRadius: 0
};

const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materials = {};

export function setupBloom(renderer, scene, camera) {
  const renderScene = new RenderPass(scene, camera);

  const bloomPass = new SelectiveUnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.bloomStrength, params.bloomRadius, params.bloomThreshold);
  bloomPass.renderToScreen = false;

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);

  const mixPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture }
    },
    vertexShader: document.getElementById('vertexshader').textContent,
    fragmentShader: document.getElementById('fragmentshader').textContent,
    defines: {}
  }), 'baseTexture');

  mixPass.needsSwap = true;
  finalComposer.addPass(mixPass);

  return {
    bloomComposer,
    finalComposer,
    bloomLayer,
    darkMaterial,
    materials
  };
}

export function renderBloom(composer, scene, bloomLayer, darkMaterial, materials) {
  scene.traverse(obj => {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
      materials[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  });

  composer.bloomComposer.render();
  
  scene.traverse(obj => {
    if (materials[obj.uuid]) {
      obj.material = materials[obj.uuid];
      delete materials[obj.uuid];
    }
  });

  composer.finalComposer.render();
}
