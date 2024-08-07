import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'; // Importing output pass for effect composer
const BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
let bloomComposer;
let finalComposer;

let rendering_bloom_data ={}

const params = {
  threshold: 0,
  strength: 1,
  radius: 20,
  exposure: 2
}; // Parameters for bloom effect
let renderer;

const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materials = {};
let camera;
let mainScene;

// Initialize bloom scene
const bloomScene = new THREE.Scene();

// Setup bloom effect
export function setupBloom(rendererNew, camera_new, main_scene) {
  renderer = rendererNew;
  camera = camera_new;
  mainScene = main_scene
  const renderScene = new RenderPass(bloomScene, camera_new);
  
  console.log(camera_new.position);
console.log(camera_new.rotation);

  // Ensure the camera has the bloom layer enabled
  camera.layers.enable(BLOOM_SCENE);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.strength, params.radius, params.threshold);
  bloomPass.renderToScreen = false;

  bloomComposer = new EffectComposer(renderer);
  bloomComposer.addPass(renderScene);
  bloomComposer.addPass(bloomPass);

  const vertexShader = document.getElementById('vertexshader').textContent;
  const fragmentShader = document.getElementById('fragmentshader').textContent;

  console.log("vertexShader", vertexShader);
  console.log("fragmentShader", fragmentShader);

  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      defines: {}
    }), 'baseTexture'
  );
  mixPass.needsSwap = true;

  console.log("mixPass", mixPass);

  // finalComposer = new EffectComposer(renderer);
  // finalComposer.addPass(renderScene);
  // finalComposer.addPass(mixPass);
  // finalComposer.addPass(new OutputPass());

  finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(mainScene, camera)); // First render the main scene
finalComposer.addPass(mixPass); // Then combine with the bloom texture
finalComposer.addPass(new OutputPass()); // Output the final combined scene


  rendering_bloom_data =  {
    bloomScene, // Return the new bloom scene
    bloomComposer,
    finalComposer,
    bloomLayer,
    darkMaterial,
    materials
  };

  return rendering_bloom_data
}


export function renderBloom({ bloomComposer, finalComposer, bloomLayer, darkMaterial, materials, bloomScene}, scene) {
  scene.traverse(obj => {
    if (obj.isMesh && !bloomLayer.test(obj.layers)) {
      materials[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  });

  bloomComposer.render();

  scene.traverse(obj => {
    if (materials[obj.uuid]) {
      obj.material = materials[obj.uuid];
      delete materials[obj.uuid];
    }
  });

  finalComposer.render();
}


export function createSphereAtPoint(x,y,z) {

  // bloomScene.traverse( disposeMaterial );
  // bloomScene.children.length = 0;

  const geometry = new THREE.IcosahedronGeometry( 1, 15 );

  // for ( let i = 0; i < 50; i ++ ) {

    const color = new THREE.Color();
    color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );

    const material = new THREE.MeshBasicMaterial( { color: color } );
    const sphere = new THREE.Mesh( geometry, material );
    sphere.position.x = x;
    sphere.position.y = y
    sphere.position.z = z
    sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
    sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
    bloomScene.add( sphere );
    sphere.layers.toggle( BLOOM_SCENE );
    console.log("i am bloom sphere", sphere)
    // if ( Math.random() < 0.25 ) sphere.layers.enable( BLOOM_SCENE );

  // }

  // render();
  render_bloom();

}

function disposeMaterial( obj ) {

  if ( obj.material ) {

    obj.material.dispose();

  }

}


// export function render_bloom(bloomSetup_data, scene, camera) {
//   // Render bloom scene with bloom effect
//   renderBloom(bloomSetup_data, bloomScene);
  
//   // Render original scene
//   renderer.render(scene, camera);
// // 
//   // console.log("scene", scene)
//   // console.log("bloomScene", bloomScene)
//   // scene.children.forEach((child) => {
//   //   console.log("child.position", child.position);
//   //   console.log("child.visible", child.visible);
//   // });
  

//   // Combine both scenes
//   bloomSetup_data.finalComposer.render();
// }

export function render_bloom() {
  // Render bloom scene with bloom effect
  renderBloom(rendering_bloom_data, rendering_bloom_data.bloomScene);

  // Render original scene
  renderer.render(mainScene, camera);

  console.log("scene", mainScene);
  console.log("bloomScene", bloomScene);

  // Combine both scenes
  rendering_bloom_data.finalComposer.render();
}


// original
function render() {

  bloomScene.traverse( darkenNonBloomed );
  bloomComposer.render();
  bloomScene.traverse( restoreMaterial );



  // render the entire scene, then render bloom scene on top
  finalComposer.render();

}

function darkenNonBloomed( obj ) {

  if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {

    materials[ obj.uuid ] = obj.material;
    obj.material = darkMaterial;

  }

}

function restoreMaterial( obj ) {

  if ( materials[ obj.uuid ] ) {

    obj.material = materials[ obj.uuid ];
    delete materials[ obj.uuid ];

  }

}