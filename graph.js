    import * as THREE from 'three';


    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
    import {} from './graph_drag.js'

    const BLOOM_SCENE = 1;

    const bloomLayer = new THREE.Layers();
    bloomLayer.set( BLOOM_SCENE );

    const params = {
      threshold: 0,
      strength: 1,
      radius: 0.5,
      exposure: 1
    };

    // const nonBloomRT = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
// Create nonBloomRT once
const nonBloomRT = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { 
  minFilter: THREE.LinearFilter, 
  magFilter: THREE.LinearFilter, 
  format: THREE.RGBAFormat 
});


    const darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
    const materials = {};

    // const renderer = new THREE.WebGLRenderer( { antialias: true } );
    const renderer = new THREE.WebGLRenderer({ antialias: false });

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild( renderer.domElement );

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 200 );
    camera.position.set( 0, 0, 20 );
    camera.lookAt( 0, 0, 0 );
    console.log("camera ", camera)

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.maxPolarAngle = Math.PI * 0.5;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    // controls.addEventListener( 'change', render );
    // controls.addEventListener('change', () => {
    //   requestAnimationFrame(render);
    // });
    let needsRender = false;


    controls.addEventListener('change', () => {
      needsRender = true;
    });

    const renderScene = new RenderPass( scene, camera );
    
    // ------------------ cube ----------------
    
    // Initialize the non-bloom scene
    const nonBloomScene = new THREE.Scene();

    // ------------------ cube ----------------
    


    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
    bloomPass.threshold = params.threshold;
    bloomPass.strength = params.strength;
    bloomPass.radius = params.radius;

    const bloomComposer = new EffectComposer( renderer );
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass( renderScene );
    bloomComposer.addPass( bloomPass );

    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial( {
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: document.getElementById( 'vertexshader' ).textContent,
        fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
        defines: {}
      } ), 'baseTexture'
    );
    mixPass.needsSwap = true;

    const outputPass = new OutputPass();

    const finalComposer = new EffectComposer( renderer );
    finalComposer.addPass( renderScene );
    finalComposer.addPass( mixPass );
    finalComposer.addPass( outputPass );

    
  const bloomTexturePass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 baseColor = texture2D(baseTexture, vUv);
          vec4 bloomColor = texture2D(bloomTexture, vUv);
          gl_FragColor = baseColor + bloomColor;
        }
      `,
      defines: {}
    }), "baseTexture"
  );


  
  const nonBloomTexturePass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        nonBloomTexture: { value: nonBloomRT.texture }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D nonBloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 baseColor = texture2D(baseTexture, vUv);
          vec4 nonBloomColor = texture2D(nonBloomTexture, vUv);
          gl_FragColor = baseColor + nonBloomColor;
        }
      `,
      defines: {}
    }), "baseTexture"
  );

  bloomTexturePass.uniforms["bloomTexture"].value = bloomComposer.renderTarget2.texture;
  
  nonBloomTexturePass.uniforms["nonBloomTexture"].value = nonBloomRT.texture;

    const raycaster = new THREE.Raycaster();

    const mouse = new THREE.Vector2();

    window.addEventListener( 'pointerdown', onPointerDown );


    setupScene();





    let files = [];
    let filePoints = [];
    let cubes = [];



// Sample data
const sampleData = [
  { id: 1, name: 'Cube 1', size: 1, x: 1, y: 0.88, z: 1, color: getBrightColor() },
  { id: 2, name: 'Cube 2', size: 2, x: -0.1, y: 1, z: -1, color: getBrightColor() },
  { id: 3, name: 'Cube 3', size: 3, x: 1, y: -1, z: 0.11, color: getBrightColor() },
  { id: 4, name: 'Cube 4', size: 1, x: -1, y: -1, z: -1, color: getBrightColor() }
];

  // Initialize the graph with the sample data
  initiateGraph(sampleData);
  // buildScene()

  
function getBrightColor() {
  const colors = [0xff00ff, 0x00ffff, 0xffff00, 0xffa500, 0x00ff00, 0x0000ff];
  return colors[Math.floor(Math.random() * colors.length)];
}

  
function initiateGraph(data) {
  data.forEach((cubeData) => {
    let { id, name, size, x, y, z, color } = cubeData;
    const cube = createWireframeCube(size, x, y, z, color);
    let isColliding = true;

    while (isColliding) {
      isColliding = false;
      for (const existingCube of cubes) {
        const cubeBoundingBox = new THREE.Box3().setFromObject(cube.wireframeCube);
        const existingCubeBoundingBox = new THREE.Box3().setFromObject(existingCube.wireframeCube);
        if (cubeBoundingBox.intersectsBox(existingCubeBoundingBox)) {
          x += (Math.random() * 40 - 20);
          y += (Math.random() * 40 - 20);
          z += (Math.random() * 40 - 20);
          cube.wireframeCube.position.set(x, y, z);
          cube.solidCube.position.set(x, y, z);
          isColliding = true;
          break;
        }
      }
    }
    cubes.push(cube);
  });
}


function createWireframeCube(size, x, y, z, color) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
  const wireframeCube = new THREE.LineSegments(edges, material);
  wireframeCube.position.set(x, y, z);

  const solidCubeMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0 });
  const solidCube = new THREE.Mesh(geometry, solidCubeMaterial);
  solidCube.position.set(x, y, z);

  const cube = {
    wireframeCube: wireframeCube,
    solidCube: solidCube
  };

  nonBloomScene.add(wireframeCube);
  nonBloomScene.add(solidCube);

  return cube;
}
    

    function onPointerDown( event ) {

      mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

      raycaster.setFromCamera( mouse, camera );
      const intersects = raycaster.intersectObjects( scene.children, false );
      if ( intersects.length > 0 ) {

        const object = intersects[ 0 ].object;
        object.layers.toggle( BLOOM_SCENE );
        render();

      }

    }


    // window.onresize = function () {

    //   const width = window.innerWidth;
    //   const height = window.innerHeight;

    //   camera.aspect = width / height;
    //   camera.updateProjectionMatrix();

    //   renderer.setSize( width, height );

    //   bloomComposer.setSize( width, height );
    //   finalComposer.setSize( width, height );

    //   render();

    // };


    window.onresize = function () {
      const width = window.innerWidth;
      const height = window.innerHeight;
    
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    
      renderer.setSize(width, height);
      bloomComposer.setSize(width, height);
      finalComposer.setSize(width, height);
    
      render();
    };

    
    function setupScene() {

      scene.traverse( disposeMaterial );
      scene.children.length = 0;

      const geometry = new THREE.IcosahedronGeometry( 1, 15 );

      for ( let i = 0; i < 50; i ++ ) {

        const color = new THREE.Color();
        color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );

        const material = new THREE.MeshBasicMaterial( { color: color } );
        const sphere = new THREE.Mesh( geometry, material );
        sphere.position.x = Math.random() * 10 - 5;
        sphere.position.y = Math.random() * 10 - 5;
        sphere.position.z = Math.random() * 10 - 5;
        sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
        sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
        scene.add( sphere );

        if ( Math.random() < 0.25 ) sphere.layers.enable( BLOOM_SCENE );

      }

      render();

    }


   let first = 1;
    
    export function createSphere(x,y,z, size) {

      if(first){
      scene.traverse( disposeMaterial );
      scene.children.length = 0;
}

    first = 0;

      const geometry = new THREE.IcosahedronGeometry( 1, 15 );

      // for ( let i = 0; i < 50; i ++ ) {

        const color = new THREE.Color();
        color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );

        const material = new THREE.MeshBasicMaterial( { color: color } );
        const sphere = new THREE.Mesh( geometry, material );
        sphere.position.x = x//Math.random() * 10 - 5;
        sphere.position.y = y//Math.random() * 10 - 5;
        sphere.position.z = z //Math.random() * 10 - 5;
        sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
        // sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
        sphere.scale.setScalar(size* 0.05 );

        scene.add( sphere );

        if ( Math.random() < 0.25 ) sphere.layers.enable( BLOOM_SCENE );

      console.log("i am sphere", sphere)

      render();

    }

    function disposeMaterial( obj ) {

      if ( obj.material ) {

        obj.material.dispose();

      }

    }

    
  // Combine the bloom and non-bloom scenes
  finalComposer.addPass(new RenderPass(scene, camera)); // Add a render pass for the main scene
  finalComposer.addPass(bloomTexturePass); // Add a texture pass for the bloom scene
  finalComposer.addPass(nonBloomTexturePass); // Add a texture pass for the non-bloom scene

 /**
 * Renders the scene with bloom and non-bloom effects.
 */
export function render() {
  // Clear the renderer
  renderer.setRenderTarget(null); // Set the render target to null (render to screen)
  renderer.clear(); // Clear the render target

  // Render the bloom scene
  scene.traverse(darkenNonBloomed); // Traverse the scene and darken non-bloomed objects
  bloomComposer.render(); // Render the bloom scene using the bloom composer
  scene.traverse(restoreMaterial); // Traverse the scene and restore original materials

  renderer.setRenderTarget(nonBloomRT); // Set the render target to the non-bloom render target
  renderer.clear(); // Clear the render target
  renderer.render(nonBloomScene, camera); // Render the non-bloom scene to the render target

  // // Combine the bloom and non-bloom scenes
  // finalComposer.addPass(new RenderPass(scene, camera)); // Add a render pass for the main scene
  // finalComposer.addPass(bloomTexturePass); // Add a texture pass for the bloom scene
  // finalComposer.addPass(nonBloomTexturePass); // Add a texture pass for the non-bloom scene

  // Render the final combined scene
  finalComposer.render(); // Render the final combined scene using the final composer

  // Clean up
  nonBloomRT.dispose(); // Dispose of the non-bloom render target
}
  


    function darkenNonBloomed(obj) {
      if (obj.isMesh && !bloomLayer.test(obj.layers)) {
        if (!materials[obj.uuid]) {
          materials[obj.uuid] = obj.material;
          obj.material = darkMaterial;
        }
      }
    }
        

    function restoreMaterial( obj ) {

      if ( materials[ obj.uuid ] ) {

        obj.material = materials[ obj.uuid ];
        delete materials[ obj.uuid ];

      }

    }


    function animate() {
      requestAnimationFrame(animate);
    
      if (needsRender) {
        render();
        needsRender = false;
      }
    }
    
    animate();

    
// window.addEventListener('mousemove', (event) => {
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//   // addMouseTrail(mouse.x, mouse.y);
// });

// window.addEventListener('dragover', (event) => {
//   event.preventDefault();
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
//   checkIntersections();
// });

// window.addEventListener('dragleave', (event) => {
//   event.preventDefault();
//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

// window.addEventListener('drop', (event) => {
//   event.preventDefault();
//   const dt = event.dataTransfer;
//   const fileList = dt.files;

//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   raycaster.setFromCamera(mouse, camera);
//   const intersects = raycaster.intersectObjects(cubes.map(cube => cube.solidCube), false);

//   for (let i = 0; i < fileList.length; i++) {
//     const file = fileList[i];

//     if (intersects.length > 0) {
//       const cube = intersects[0].object;
//       const data = { file, position: cube.position, cube };
//       createFilePoint(data);
//     } else {
//       const dropPosition = new THREE.Vector3(
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400),
//         THREE.MathUtils.randFloatSpread(400)
//       );
//       const data = { file, position: dropPosition };
//       createFilePoint(data);
//     }
//   }

//   if (INTERSECTED) {
//     INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
//     INTERSECTED.material.opacity = INTERSECTED.currentOpacity;
//     INTERSECTED = null;
//   }
// });

// for debugging mouse position

// window.addEventListener('resize', () => {
//   camera.aspect = window.innerWidth / window.innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(window.innerWidth, window.innerHeight);
// });

// Placeholder functions for exporting
export function isRendererReady() {
return true;
}



export function graphInit(initScene, initCamera, initRenderer) {
// Placeholder implementation
}

export function updateGraph(newNodes, newLinks) {
// Placeholder implementation
}

export function addNode(id, name = '', size = 1, x = Math.random() * 100 - 50, y = Math.random() * 100 - 50, z = Math.random() * 100 - 50, color = Math.random() * 0xffffff) {
// Placeholder implementation
}
export function share3dDat() {
  return {
    camera: typeof camera !== 'undefined' ? camera : null,
    nonBloomScene: typeof nonBloomScene !== 'undefined' ? nonBloomScene : null,
    renderer: typeof renderer !== 'undefined' ? renderer : null,
    mouse: typeof mouse !== 'undefined' ? mouse : null,
    raycaster: typeof raycaster !== 'undefined' ? raycaster : null,
    scene: typeof scene !== 'undefined' ? scene : null

  };
}
