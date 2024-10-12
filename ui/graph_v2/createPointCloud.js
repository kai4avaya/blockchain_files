// createPointCloud.js
import * as THREE from 'three';
import { share3dDat, markNeedsRender } from './create.js';

function createAnimatedPointCloud(reducedData, keywords, fileIds, clusters) {
  const { scene, camera } = share3dDat();
  
  console.log("Creating point cloud with:", {
      dataPoints: reducedData.length,
      clusters: clusters.length,
      keywords: keywords.length,
      fileIds: fileIds.length
  });

  if (reducedData.length === 0) {
      console.error("No data points to create point cloud.");
      return null;
  }

  const pointClouds = [];
  const clusterColors = clusters.map(() => new THREE.Color(Math.random(), Math.random(), Math.random()));

  clusters.forEach((cluster, clusterIndex) => {
      if (cluster.length === 0) {
          console.warn(`Cluster ${clusterIndex} is empty. Skipping.`);
          return;
      }

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(cluster.length * 3);
      const colors = new Float32Array(cluster.length * 3);
      const sizes = new Float32Array(cluster.length);

      cluster.forEach((pointIndex, index) => {
          if (pointIndex >= reducedData.length) {
              console.error(`Invalid point index ${pointIndex} for cluster ${clusterIndex}. Max index is ${reducedData.length - 1}.`);
              return;
          }

          const coords = reducedData[pointIndex];
          positions[index * 3] = coords[0];
          positions[index * 3 + 1] = coords[1];
          positions[index * 3 + 2] = coords[2];

          const color = clusterColors[clusterIndex];
          colors[index * 3] = color.r;
          colors[index * 3 + 1] = color.g;
          colors[index * 3 + 2] = color.b;

          sizes[index] = 0.5; // Increased from 0.1 to 0.5
      });

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.ShaderMaterial({
          uniforms: {
              time: { value: 0 },
          },
          vertexShader: `
              attribute vec3 color;
              attribute float size;
              uniform float time;
              varying vec3 vColor;
              void main() {
                  vColor = color;
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_PointSize = size * (1000.0 / -mvPosition.z) * (1.0 + 0.1 * sin(time + position.x * 10.0)); // Increased from 300.0 to 1000.0
                  gl_Position = projectionMatrix * mvPosition;
              }
          `,
          fragmentShader: `
              varying vec3 vColor;
              void main() {
                  if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
                  gl_FragColor = vec4(vColor, 1.0);
              }
          `,
          transparent: true,
      });

      const pointCloud = new THREE.Points(geometry, material);
      scene.add(pointCloud);

      pointCloud.userData = {
          clusterIndex,
          keywords: cluster.map(index => keywords[index]),
          fileIds: cluster.map(index => fileIds[index]),
      };

      pointClouds.push(pointCloud);

      console.log(`Created point cloud for cluster ${clusterIndex} with ${cluster.length} points.`);
  });

  function animate() {
      requestAnimationFrame(animate);
      pointClouds.forEach(cloud => {
          cloud.material.uniforms.time.value += 0.05;
      });
      markNeedsRender();
  }
  animate();

  console.log(`Total point clouds created: ${pointClouds.length}`);

  return pointClouds;
}

export { createAnimatedPointCloud };