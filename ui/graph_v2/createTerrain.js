
// Add this function to your code
function addGridHelper() {
    const size = 100;
    const divisions = 100;
    const gridHelper = new THREE.GridHelper(size, divisions);
    scene.add(gridHelper);
  }
  
  function createEnvironment() {
    // Create a large grid
    const gridSize = 1000;
    const gridDivisions = 100;
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      0x444444,
      0x444444
    );
    scene.add(gridHelper);
  
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
  
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
  }
  
  function loadTerrain(file, callback) {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.open("GET", file, true);
    xhr.onload = function (evt) {
      if (xhr.response) {
        callback(new Uint16Array(xhr.response));
      }
    };
    xhr.send(null);
  }
  
  function createEnvironmentTerrain() {
    // Set the background to black
    scene.background = new THREE.Color(0x000000);
  
    loadTerrain("../../assets/besseggen.bin", function (data) {
      const width = 199;
      const height = 199;
      const geometry = new THREE.PlaneGeometry(60, 60, width - 1, height - 1);
  
      for (let i = 0, l = geometry.attributes.position.count; i < l; i++) {
        geometry.attributes.position.setZ(i, (data[i] / 65535) * 10);
      }
  
      geometry.computeVertexNormals();
  
      const material = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        wireframe: true,
      });
  
      const terrain = new THREE.Mesh(geometry, material);
      terrain.rotation.x = -Math.PI / 2; // Rotate to lay flat
      scene.add(terrain);
  
      markNeedsRender();
    });
  
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
  
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
  }
  