// searchHandler.js

import indexDBOverlay from '../../../memory/local/file_worker';
import { VectorDB } from '../../../memory/vectorDB/vectordb';
import { share3dDat } from '../../graph_v2/create.js';
import embeddingWorker from '../../../ai/embeddings.js';
import * as THREE from 'three';
import gsap from 'gsap';

const vectorDB = new VectorDB();

export function initializeSearchHandler() {
  window.addEventListener('initiateSearch', async (event) => {
    const { query, searchType } = event.detail;
    const searchResults = document.getElementById('searchResults');
    
    console.log('Search initiated:', { query, searchType });

    if (!query) return;
    
    searchResults.innerHTML = ''; // Clear previous results
    
    try {
      if (searchType === 'exact') {
        console.log('Performing exact search');
        await performExactSearch(query, searchResults);
      } else if (searchType === 'fuzzy') {
        console.log('Performing fuzzy search');
        await performFuzzySearch(query, searchResults);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      searchResults.innerHTML = `<div class="error-message">An error occurred during search</div>`;
    } finally {
      window.dispatchEvent(new Event('searchComplete'));
    }
  });
}

async function performExactSearch(query, searchResults) {
  try {
    const vectors = await indexDBOverlay.getAll('vectors');
    console.log('Vectors retrieved:', vectors);

    const matches = vectors.filter(vector => vector.text?.includes(query));
    console.log('Exact matches found:', matches);

    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No exact matches found</div>';
      return;
    }

    displayResults(matches, searchResults, query);
  } catch (error) {
    console.error('Error during exact search:', error);
    throw error;
  }
}

async function performFuzzySearch(query, searchResults) {
  try {
    // First get the vector for the query text
    const vectors = await indexDBOverlay.getAll('vectors');
    console.log('Available vectors:', vectors);

    // Find the most recent vector for this text if it exists
    const existingVector = vectors.find(v => v.text === query);
    const queryVector = existingVector ? existingVector.vector : await embeddingWorker.generateEmbeddings([query], 'query');

    if (!queryVector) {
      console.error('Could not generate query vector');
      searchResults.innerHTML = '<div class="error-message">Could not process search query</div>';
      return;
    }

    console.log('Query vector:', queryVector);

    // Use the existing vectorDB query method
    const results = await vectorDB.query(queryVector, { 
      limit: 10
    });

    console.log('Fuzzy search results:', results);

    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No similar matches found</div>';
      return;
    }

    // Process results - they should already be in the correct format from vectorDB.query
    const processedResults = results.map(result => result.object);

    displayResults(processedResults, searchResults, query);
  } catch (error) {
    console.error('Error during fuzzy search:', error);
    throw error;
  }
}

function displayResults(matches, searchResults, query) {
  matches.forEach(match => {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'search-result-item';
    link.innerHTML = `
      <svg class="small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
      <div class="result-content">
        <div class="file-name">${match.fileName || 'Untitled'}</div>
        <div class="match-text">${highlightText(match.text || '', query)}</div>
      </div>
    `;
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      zoomToSphere(match.fileId);
    });
    
    searchResults.appendChild(link);
  });
}

function highlightText(text, query) {
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function zoomToSphere(fileId) {
  const { scene, camera, controls } = share3dDat();
  let sphere = null;
  scene.traverse((obj) => {
    if (obj.userData?.id === fileId && (obj.geometry instanceof THREE.IcosahedronGeometry || obj.geometry instanceof THREE.SphereGeometry)) {
      sphere = obj;
    }
  });

  if (sphere) {
    controls.enabled = false;
    const targetPos = sphere.position.clone();
    const distance = 20;
    const offset = new THREE.Vector3(0, 0, distance);
    const finalPos = targetPos.clone().add(offset);

    gsap.to(camera.position, {
      duration: 1,
      x: finalPos.x,
      y: finalPos.y,
      z: finalPos.z,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.lookAt(targetPos);
        controls.target.copy(targetPos);
      },
      onComplete: () => {
        controls.enabled = true;
        controls.update();
      }
    });

    gsap.to(controls.target, {
      duration: 1,
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      ease: "power2.inOut"
    });
  }
}