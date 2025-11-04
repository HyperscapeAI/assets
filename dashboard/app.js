// State
let allFiles = [];
let filteredFiles = [];
let renamingFile = null;
let selectedFiles = new Set();
let sortState = {
  column: 'name',
  direction: 'asc'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  loadFiles();
  loadDirectories();
  setupEventListeners();
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();

    // If auth is enabled and user is authenticated, show logout button
    if (data.authEnabled && data.authenticated) {
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.classList.remove('hidden');
      }
    }

    // If auth is enabled but not authenticated, redirect to login
    if (data.authEnabled && !data.authenticated) {
      window.location.href = '/dashboard/login';
    }
  } catch (error) {
    console.error('Auth status check error:', error);
  }
}

// Logout function
async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to login page
      window.location.href = '/dashboard/login';
    } else {
      showError('Logout failed');
    }
  } catch (error) {
    console.error('Logout error:', error);
    showError('Logout failed');
  }
}

// Setup event listeners
function setupEventListeners() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const searchInput = document.getElementById('searchInput');
  const filterDirectory = document.getElementById('filterDirectory');
  const filterType = document.getElementById('filterType');

  // Drag and drop
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFileUpload(e.target.files);
  });

  // Search and filters
  searchInput.addEventListener('input', applyFilters);
  filterDirectory.addEventListener('change', applyFilters);
  filterType.addEventListener('change', applyFilters);

  // Sortable table headers
  const sortableHeaders = document.querySelectorAll('.sortable-header');
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      handleSort(column);
    });
  });
}

// Load files from API
async function loadFiles() {
  try {
    const response = await fetch('/api/files');
    const data = await response.json();
    allFiles = data.files;
    filteredFiles = [...allFiles];
    updateStats();
    sortFiles();
    updateSortIndicators();
    renderFiles();
  } catch (error) {
    console.error('Error loading files:', error);
    showError('Failed to load files');
  }
}

// Load directory statistics
async function loadDirectories() {
  try {
    const response = await fetch('/api/directories');
    const data = await response.json();
    renderDirectoryStats(data.directories);
  } catch (error) {
    console.error('Error loading directories:', error);
  }
}

// Handle file upload
async function handleFileUpload(files) {
  if (files.length === 0) return;

  const directory = document.getElementById('uploadDirectory').value;
  const formData = new FormData();

  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('directory', directory);

  showProgress();

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      hideProgress();
      showSuccess(`Successfully uploaded ${result.files.length} file(s)`);
      loadFiles();
      loadDirectories();
      document.getElementById('fileInput').value = '';
    } else {
      hideProgress();
      showError(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    hideProgress();
    showError(`Upload failed: ${error.message}`);
  }
}

// Delete file
async function deleteFile(filePath) {
  if (!confirm(`Are you sure you want to delete ${filePath}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/delete/${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(`Deleted ${filePath}`);
      loadFiles();
      loadDirectories();
    } else {
      showError(`Delete failed: ${result.error}`);
    }
  } catch (error) {
    showError(`Delete failed: ${error.message}`);
  }
}

// Handle sorting
function handleSort(column) {
  // Toggle direction if clicking same column, otherwise default to ascending
  if (sortState.column === column) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = column;
    sortState.direction = 'asc';
  }

  // Apply sort and update UI
  sortFiles();
  updateSortIndicators();
  renderFiles();
}

// Sort files based on current sort state
function sortFiles() {
  filteredFiles.sort((a, b) => {
    let aVal, bVal;

    // Get values based on column type
    switch (sortState.column) {
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'path':
        aVal = (a.path || '').toLowerCase();
        bVal = (b.path || '').toLowerCase();
        break;
      case 'size':
        aVal = a.size || 0;
        bVal = b.size || 0;
        break;
      case 'modified':
        aVal = new Date(a.modified || 0).getTime();
        bVal = new Date(b.modified || 0).getTime();
        break;
      default:
        return 0;
    }

    // Handle null/undefined values
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Compare values
    let comparison = 0;
    if (aVal < bVal) comparison = -1;
    if (aVal > bVal) comparison = 1;

    // Apply direction
    return sortState.direction === 'asc' ? comparison : -comparison;
  });
}

// Update sort indicators in table headers
function updateSortIndicators() {
  const headers = document.querySelectorAll('.sortable-header');

  headers.forEach(header => {
    const column = header.getAttribute('data-sort');
    const icon = header.querySelector('.sort-icon svg');

    // Remove active state from all headers
    header.classList.remove('sort-active', 'sort-asc', 'sort-desc');

    // Add active state to current sort column
    if (column === sortState.column) {
      header.classList.add('sort-active', `sort-${sortState.direction}`);
    }
  });
}

// Apply search and filters
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const dirFilter = document.getElementById('filterDirectory').value;
  const typeFilter = document.getElementById('filterType').value;

  filteredFiles = allFiles.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm) ||
                          file.path.toLowerCase().includes(searchTerm);
    const matchesDir = !dirFilter || file.path.startsWith(dirFilter);
    const matchesType = !typeFilter || file.type === typeFilter;

    return matchesSearch && matchesDir && matchesType;
  });

  // Maintain sort after filtering
  sortFiles();
  renderFiles();
}

// Get file icon/preview thumbnail
function getFilePreview(file) {
  const type = file.type.toLowerCase();
  const path = file.path;

  // Image files - show thumbnail
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(type)) {
    return `<img src="/${path}" alt="${file.name}" class="thumbnail-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="thumbnail-fallback" style="display:none;">${getFileIcon(type)}</div>`;
  }

  // Other files - show icon
  return `<div class="thumbnail-fallback">${getFileIcon(type)}</div>`;
}

// Get file type icon SVG
function getFileIcon(type) {
  const icons = {
    '.glb': '<svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>',
    '.mp3': '<svg class="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>',
    '.mp4': '<svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>',
    '.json': '<svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>',
    '.woff2': '<svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>',
  };
  return icons[type] || '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>';
}

// Render files table
function renderFiles() {
  const fileList = document.getElementById('fileList');

  if (filteredFiles.length === 0) {
    fileList.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-8 text-center text-gray-400">
          No files found
        </td>
      </tr>
    `;
    return;
  }

  fileList.innerHTML = filteredFiles.map(file => {
    const isRenaming = renamingFile && renamingFile.path === file.path;
    const isSelected = selectedFiles.has(file.path);

    return `
    <tr class="fade-in ${isSelected ? 'selected-row' : ''}">
      <td class="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          class="bulk-checkbox cursor-pointer"
          ${isSelected ? 'checked' : ''}
          onchange="toggleFileSelection('${file.path.replace(/'/g, "\\'")}')"
        >
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="thumbnail-container">
          ${getFilePreview(file)}
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <span class="file-badge file-badge-${getBadgeClass(file.type)}">
            ${file.type || 'file'}
          </span>
          ${isRenaming ? `
            <input
              type="text"
              id="renameInput"
              value="${file.name.replace(/"/g, '&quot;')}"
              class="bg-gray-700 border border-blue-500 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onkeydown="handleRenameKeypress(event, '${file.path.replace(/'/g, "\\'")}')">
          ` : `
            <span class="font-medium text-gray-200">${file.name}</span>
          `}
        </div>
      </td>
      <td class="px-6 py-4 text-sm text-gray-400">
        ${file.path}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        ${formatBytes(file.size)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
        ${formatDate(file.modified)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        ${isRenaming ? `
          <div class="flex gap-2">
            <button onclick="saveRename('${file.path.replace(/'/g, "\\'")}', document.getElementById('renameInput').value)" class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white" title="Save">
              Save
            </button>
            <button onclick="cancelRename()" class="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-white" title="Cancel">
              Cancel
            </button>
          </div>
        ` : `
          <div class="flex gap-2">
            <button onclick="downloadFile('${file.path}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white" title="Download">
              Download
            </button>
            ${canPreview(file.type) ? `
              <button onclick="previewFile('${file.path}', '${file.name}', '${file.type}')" class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white" title="Preview">
                Preview
              </button>
            ` : ''}
            <button onclick="startRename('${file.path.replace(/'/g, "\\'")}', '${file.name.replace(/'/g, "\\'")}' )" class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white" title="Rename">
              Rename
            </button>
            <button onclick="deleteFile('${file.path}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white" title="Delete">
              Delete
            </button>
          </div>
        `}
      </td>
    </tr>
    `;
  }).join('');
}

// Render directory statistics
function renderDirectoryStats(directories) {
  const container = document.getElementById('directoryStats');

  container.innerHTML = directories.map(dir => `
    <div class="stat-card fade-in">
      <div class="text-sm font-medium text-gray-400 mb-1">${dir.name}</div>
      <div class="text-2xl font-bold text-blue-400 mb-1">${dir.fileCount}</div>
      <div class="text-xs text-gray-500">${formatBytes(dir.totalSize)}</div>
    </div>
  `).join('');
}

// Update overall stats
function updateStats() {
  const totalFiles = allFiles.length;
  const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);

  document.getElementById('totalFiles').textContent = totalFiles;
  document.getElementById('totalSize').textContent = formatBytes(totalSize);
}

// Download file
function downloadFile(path) {
  window.open(`/${path}`, '_blank');
}

// Preview file
async function previewFile(path, name, type) {
  const modal = document.getElementById('previewModal');
  const title = document.getElementById('previewTitle');
  const subtitle = document.getElementById('previewSubtitle');
  const content = document.getElementById('previewContent');

  title.textContent = name;
  subtitle.textContent = path;
  modal.classList.remove('hidden');

  // Show loading state
  content.innerHTML = '<div class="flex items-center justify-center h-64"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div></div>';

  try {
    if (type === '.json') {
      const response = await fetch(`/${path}`);
      const json = await response.json();
      content.innerHTML = `<pre class="json-preview"><code>${JSON.stringify(json, null, 2)}</code></pre>`;
    }
    else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(type)) {
      content.innerHTML = `
        <div class="image-preview-container">
          <img src="/${path}" alt="${name}" class="image-preview" onload="imageLoaded(this)">
        </div>
      `;
    }
    else if (type === '.glb') {
      await preview3DModel(path, name, content);
    }
    else if (type === '.mp3') {
      await previewAudio(path, name, content);
    }
    else if (type === '.mp4') {
      previewVideo(path, name, content);
    }
    else {
      content.innerHTML = `
        <div class="alert alert-info">
          <div>
            <div class="font-semibold">File Information</div>
            <div class="text-sm mt-2">Name: ${name}</div>
            <div class="text-sm">Path: ${path}</div>
            <div class="text-sm">Type: ${type}</div>
            <a href="/${path}" download class="text-blue-400 hover:underline mt-4 inline-block">Download</a>
          </div>
        </div>
      `;
    }
  } catch (error) {
    content.innerHTML = `<div class="alert alert-error">Failed to load preview: ${error.message}</div>`;
  }
}

// Image loaded handler
function imageLoaded(img) {
  const container = img.parentElement;
  const info = document.createElement('div');
  info.className = 'image-info';
  info.innerHTML = `
    <div class="text-sm text-gray-400 mt-4">
      <div>Dimensions: ${img.naturalWidth} x ${img.naturalHeight}px</div>
      <div>Aspect Ratio: ${(img.naturalWidth / img.naturalHeight).toFixed(2)}</div>
    </div>
  `;
  container.appendChild(info);
}

// 3D Model Preview with Three.js
let scene, camera, renderer, controls, model;

async function preview3DModel(path, name, container) {
  container.innerHTML = `
    <div class="model-viewer-container">
      <div id="modelCanvas" class="model-canvas"></div>
      <div class="model-controls">
        <div class="flex gap-4 mb-4">
          <button onclick="toggleAutoRotate()" class="control-btn" id="autoRotateBtn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Auto Rotate
          </button>
          <button onclick="toggleWireframe()" class="control-btn" id="wireframeBtn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>
            </svg>
            Wireframe
          </button>
          <button onclick="resetCamera()" class="control-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Reset View
          </button>
        </div>
        <div id="modelInfo" class="model-info text-sm text-gray-400">
          Loading model...
        </div>
      </div>
    </div>
  `;

  // Initialize Three.js scene
  const canvasContainer = document.getElementById('modelCanvas');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111827);

  camera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
  camera.position.set(0, 1, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasContainer.appendChild(renderer.domElement);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  directionalLight2.position.set(-5, 5, -5);
  scene.add(directionalLight2);

  // Add orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 2.0;

  // Load GLB model
  const loader = new THREE.GLTFLoader();

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        `/${path}`,
        resolve,
        (progress) => {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          document.getElementById('modelInfo').textContent = `Loading: ${percent}%`;
        },
        reject
      );
    });

    model = gltf.scene;
    scene.add(model);

    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.multiplyScalar(scale);

    box.setFromObject(model);
    box.getCenter(center);
    model.position.sub(center);

    // Update model info
    let vertices = 0, faces = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        vertices += child.geometry.attributes.position.count;
        faces += child.geometry.index ? child.geometry.index.count / 3 : child.geometry.attributes.position.count / 3;
      }
    });

    document.getElementById('modelInfo').innerHTML = `
      <div>Vertices: ${vertices.toLocaleString()}</div>
      <div>Faces: ${Math.floor(faces).toLocaleString()}</div>
      <div>Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}</div>
    `;

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    window.addEventListener('resize', onModelWindowResize);

  } catch (error) {
    document.getElementById('modelInfo').innerHTML = `<div class="text-red-400">Error loading model: ${error.message}</div>`;
  }
}

function onModelWindowResize() {
  if (!camera || !renderer) return;
  const container = document.getElementById('modelCanvas');
  if (!container) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function toggleAutoRotate() {
  if (controls) {
    controls.autoRotate = !controls.autoRotate;
    const btn = document.getElementById('autoRotateBtn');
    btn.classList.toggle('active', controls.autoRotate);
  }
}

function toggleWireframe() {
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.wireframe = !child.material.wireframe;
      }
    });
    const btn = document.getElementById('wireframeBtn');
    btn.classList.toggle('active', model.children[0]?.material?.wireframe);
  }
}

function resetCamera() {
  if (camera && controls) {
    camera.position.set(0, 1, 5);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

// Audio Preview with Web Audio API
let audioContext, audioSource, audioBuffer, analyser, isPlaying = false;

async function previewAudio(path, name, container) {
  container.innerHTML = `
    <div class="audio-player-container">
      <div class="waveform-container" id="waveform">
        <canvas id="waveformCanvas"></canvas>
      </div>
      <div class="audio-controls">
        <button onclick="toggleAudio()" class="play-btn" id="playBtn">
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
          </svg>
        </button>
        <div class="flex-1">
          <input type="range" id="audioSeek" min="0" max="100" value="0" class="audio-seek">
          <div class="flex justify-between text-sm text-gray-400 mt-2">
            <span id="currentTime">0:00</span>
            <span id="duration">0:00</span>
          </div>
        </div>
        <div class="volume-control">
          <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"></path>
          </svg>
          <input type="range" id="volumeControl" min="0" max="100" value="70" class="volume-slider">
        </div>
      </div>
      <div class="audio-info text-sm text-gray-400 mt-4" id="audioInfo">
        Loading audio...
      </div>
    </div>
  `;

  try {
    const response = await fetch(`/${path}`);
    const arrayBuffer = await response.arrayBuffer();

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Update duration
    const duration = audioBuffer.duration;
    document.getElementById('duration').textContent = formatTime(duration);
    document.getElementById('audioInfo').innerHTML = `
      <div>Duration: ${formatTime(duration)}</div>
      <div>Sample Rate: ${audioBuffer.sampleRate} Hz</div>
      <div>Channels: ${audioBuffer.numberOfChannels}</div>
    `;

    // Setup waveform visualization
    setupWaveform();

    // Setup controls
    const seekBar = document.getElementById('audioSeek');
    seekBar.max = duration;
    seekBar.addEventListener('input', (e) => {
      if (audioSource) {
        stopAudio();
        playAudio(parseFloat(e.target.value));
      }
    });

    const volumeControl = document.getElementById('volumeControl');
    volumeControl.addEventListener('input', (e) => {
      if (audioContext) {
        // Volume will be handled when playing
      }
    });

  } catch (error) {
    document.getElementById('audioInfo').innerHTML = `<div class="text-red-400">Error loading audio: ${error.message}</div>`;
  }
}

function setupWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  ctx.scale(2, 2);

  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / canvas.width);
  const amp = canvas.height / 4;

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i < canvas.width / 2; i++) {
    const min = Math.min(...data.slice(i * step, (i + 1) * step));
    const max = Math.max(...data.slice(i * step, (i + 1) * step));
    ctx.moveTo(i, (1 + min) * amp);
    ctx.lineTo(i, (1 + max) * amp);
  }
  ctx.stroke();
}

function toggleAudio() {
  if (isPlaying) {
    stopAudio();
  } else {
    playAudio(parseFloat(document.getElementById('audioSeek').value));
  }
}

function playAudio(startTime = 0) {
  stopAudio();

  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;

  const gainNode = audioContext.createGain();
  gainNode.gain.value = document.getElementById('volumeControl').value / 100;

  audioSource.connect(gainNode);
  gainNode.connect(audioContext.destination);

  audioSource.start(0, startTime);
  isPlaying = true;

  document.getElementById('playBtn').innerHTML = `
    <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
    </svg>
  `;

  audioSource.onended = () => {
    isPlaying = false;
    document.getElementById('playBtn').innerHTML = `
      <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
      </svg>
    `;
  };

  updateAudioTime(startTime);
}

function stopAudio() {
  if (audioSource) {
    audioSource.stop();
    audioSource = null;
    isPlaying = false;
    document.getElementById('playBtn').innerHTML = `
      <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
      </svg>
    `;
  }
}

function updateAudioTime(startTime) {
  if (!isPlaying) return;

  const currentTime = audioContext.currentTime - audioContext.baseLatency + startTime;
  document.getElementById('currentTime').textContent = formatTime(Math.min(currentTime, audioBuffer.duration));
  document.getElementById('audioSeek').value = Math.min(currentTime, audioBuffer.duration);

  if (currentTime < audioBuffer.duration) {
    requestAnimationFrame(() => updateAudioTime(startTime));
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Video Preview
function previewVideo(path, name, container) {
  container.innerHTML = `
    <div class="video-player-container">
      <video controls class="video-preview">
        <source src="/${path}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <div class="video-info text-sm text-gray-400 mt-4">
        <div>File: ${name}</div>
      </div>
    </div>
  `;
}

// Close preview modal
function closePreview() {
  // Stop audio if playing
  if (isPlaying) {
    stopAudio();
  }

  // Cleanup Three.js scene
  if (renderer) {
    window.removeEventListener('resize', onModelWindowResize);
    renderer.dispose();
    renderer = null;
  }
  if (scene) {
    scene.clear();
    scene = null;
  }
  if (controls) {
    controls.dispose();
    controls = null;
  }
  camera = null;
  model = null;

  // Close modal
  document.getElementById('previewModal').classList.add('hidden');
}

// Check if file can be previewed
function canPreview(type) {
  return ['.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.glb', '.mp3', '.mp4'].includes(type);
}

// Get badge class for file type
function getBadgeClass(type) {
  const typeMap = {
    '.glb': 'glb',
    '.json': 'json',
    '.mp3': 'mp3',
    '.png': 'png',
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.woff2': 'woff2'
  };
  return typeMap[type] || 'other';
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Show progress
function showProgress() {
  document.getElementById('uploadProgress').classList.remove('hidden');
  document.getElementById('progressBar').style.width = '100%';
}

// Hide progress
function hideProgress() {
  setTimeout(() => {
    document.getElementById('uploadProgress').classList.add('hidden');
    document.getElementById('progressBar').style.width = '0%';
  }, 500);
}

// Show success message
function showSuccess(message) {
  const status = document.getElementById('uploadStatus');
  status.innerHTML = `
    <div class="alert alert-success fade-in">
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
      </svg>
      <span>${message}</span>
    </div>
  `;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 5000);
}

// Show error message
function showError(message) {
  const status = document.getElementById('uploadStatus');
  status.innerHTML = `
    <div class="alert alert-error fade-in">
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
      </svg>
      <span>${message}</span>
    </div>
  `;
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 5000);
}

// Start rename operation
function startRename(filePath, currentName) {
  // Prevent multiple renames
  if (renamingFile) {
    return;
  }

  renamingFile = { path: filePath, name: currentName };
  renderFiles();

  // Focus the input field after render
  setTimeout(() => {
    const input = document.getElementById('renameInput');
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

// Cancel rename operation
function cancelRename() {
  renamingFile = null;
  renderFiles();
}

// Save renamed file
async function saveRename(oldPath, newName) {
  // Trim whitespace
  newName = newName.trim();

  // Validate new name
  if (!newName) {
    showError('Filename cannot be empty');
    return;
  }

  // Get current filename
  const oldName = oldPath.split('/').pop();

  // Check if name unchanged
  if (newName === oldName) {
    cancelRename();
    return;
  }

  // Validate no special characters or path separators
  if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    showError('Filename cannot contain path separators or ..');
    return;
  }

  try {
    const response = await fetch('/api/rename', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        oldPath: oldPath,
        newName: newName
      })
    });

    const result = await response.json();

    if (result.success) {
      showSuccess(result.message);
      renamingFile = null;
      loadFiles();
      loadDirectories();
    } else {
      showError(`Rename failed: ${result.error}`);
    }
  } catch (error) {
    showError(`Rename failed: ${error.message}`);
  }
}

// Handle rename input keypress
function handleRenameKeypress(event, oldPath) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveRename(oldPath, event.target.value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelRename();
  }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('previewModal');
  if (e.target === modal) {
    closePreview();
  }
});

// Bulk Selection Functions
function toggleFileSelection(filePath) {
  if (selectedFiles.has(filePath)) {
    selectedFiles.delete(filePath);
  } else {
    selectedFiles.add(filePath);
  }
  updateBulkToolbar();
  updateSelectAllCheckbox();
  renderFiles();
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('selectAll');

  if (selectAllCheckbox.checked) {
    // Select all filtered files
    filteredFiles.forEach(file => selectedFiles.add(file.path));
  } else {
    // Deselect all filtered files
    filteredFiles.forEach(file => selectedFiles.delete(file.path));
  }

  updateBulkToolbar();
  renderFiles();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('selectAll');
  if (!selectAllCheckbox) return;

  const visibleFilePaths = filteredFiles.map(f => f.path);
  const allVisibleSelected = visibleFilePaths.length > 0 &&
    visibleFilePaths.every(path => selectedFiles.has(path));

  selectAllCheckbox.checked = allVisibleSelected;
  selectAllCheckbox.indeterminate = !allVisibleSelected &&
    visibleFilePaths.some(path => selectedFiles.has(path));
}

function updateBulkToolbar() {
  const toolbar = document.getElementById('bulkActionsToolbar');
  const selectedCount = document.getElementById('selectedCount');

  if (selectedFiles.size > 0) {
    toolbar.classList.remove('hidden');
    selectedCount.textContent = selectedFiles.size;
  } else {
    toolbar.classList.add('hidden');
  }
}

function deselectAll() {
  selectedFiles.clear();
  updateBulkToolbar();
  updateSelectAllCheckbox();
  renderFiles();
}

// Bulk download selected files as ZIP
async function bulkDownload() {
  if (selectedFiles.size === 0) {
    showError('No files selected');
    return;
  }

  const filePaths = Array.from(selectedFiles);

  try {
    showProgress();
    document.getElementById('progressText').textContent = `Creating ZIP with ${filePaths.length} file(s)...`;

    const response = await fetch('/api/bulk-download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filePaths })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Download failed');
    }

    // Get the ZIP file as a blob
    const blob = await response.blob();

    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'hyperscape-assets.zip';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    hideProgress();
    showSuccess(`Successfully downloaded ${filePaths.length} file(s) as ZIP`);

    // Optionally deselect after download
    deselectAll();
  } catch (error) {
    hideProgress();
    showError(`Bulk download failed: ${error.message}`);
  }
}

// Bulk delete selected files
async function bulkDelete() {
  if (selectedFiles.size === 0) {
    showError('No files selected');
    return;
  }

  const filePaths = Array.from(selectedFiles);

  if (!confirm(`Are you sure you want to delete ${filePaths.length} file(s)?`)) {
    return;
  }

  try {
    showProgress();
    document.getElementById('progressText').textContent = `Deleting ${filePaths.length} file(s)...`;

    const response = await fetch('/api/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filePaths })
    });

    const result = await response.json();

    if (result.success) {
      hideProgress();

      if (result.failed > 0) {
        showError(`Deleted ${result.deleted} file(s), failed to delete ${result.failed} file(s)`);
      } else {
        showSuccess(`Successfully deleted ${result.deleted} file(s)`);
      }

      // Clear selection and reload
      deselectAll();
      loadFiles();
      loadDirectories();
    } else {
      hideProgress();
      showError(`Bulk delete failed: ${result.error}`);
    }
  } catch (error) {
    hideProgress();
    showError(`Bulk delete failed: ${error.message}`);
  }
}

// Asset Validation Functions
let validationData = null;
let showOnlyIssuesEnabled = false;

// Run asset reference validation
async function runValidation() {
  const loadingEl = document.getElementById('validationLoading');
  const resultsEl = document.getElementById('validationResults');
  const btnEl = document.getElementById('validateBtn');

  // Show loading state
  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  btnEl.disabled = true;

  try {
    const response = await fetch('/api/validate-references');
    const data = await response.json();

    if (data.error) {
      showError(`Validation failed: ${data.error}`);
      loadingEl.classList.add('hidden');
      btnEl.disabled = false;
      return;
    }

    validationData = data;
    displayValidationResults(data);

    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    btnEl.disabled = false;
  } catch (error) {
    showError(`Validation failed: ${error.message}`);
    loadingEl.classList.add('hidden');
    btnEl.disabled = false;
  }
}

// Display validation results
function displayValidationResults(data) {
  // Update summary stats
  document.getElementById('totalRefs').textContent = data.totalReferences;
  document.getElementById('validRefs').textContent = data.validReferences;
  document.getElementById('missingRefs').textContent = data.missingReferences;

  // Update timestamp
  const timestamp = new Date(data.timestamp);
  document.getElementById('validationTimestamp').textContent =
    `Last validated: ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`;

  // Show no issues message if all valid
  const noIssuesMsg = document.getElementById('noIssuesMessage');
  if (data.missingReferences === 0) {
    noIssuesMsg.classList.remove('hidden');
    document.getElementById('missingAssetsList').classList.add('hidden');
    return;
  } else {
    noIssuesMsg.classList.add('hidden');
    document.getElementById('missingAssetsList').classList.remove('hidden');
  }

  // Render missing assets by manifest
  renderMissingAssets(data);
}

// Render missing assets list
function renderMissingAssets(data) {
  const container = document.getElementById('missingAssetsList');
  const manifests = Object.entries(data.manifests);

  container.innerHTML = manifests.map(([manifestName, manifestData]) => {
    // Skip manifests with errors
    if (manifestData.error) {
      return `
        <div class="bg-gray-700 rounded-lg p-4 border border-red-500">
          <div class="flex items-center gap-2 mb-2">
            <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="font-semibold text-red-400">${manifestName}</span>
          </div>
          <p class="text-sm text-gray-400">Error: ${manifestData.error}</p>
        </div>
      `;
    }

    // Skip if showing only issues and this manifest has none
    if (showOnlyIssuesEnabled && manifestData.missing.length === 0) {
      return '';
    }

    const hasIssues = manifestData.missing.length > 0;
    const statusColor = hasIssues ? 'red' : 'green';
    const statusIcon = hasIssues ?
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>' :
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>';

    return `
      <div class="bg-gray-700 rounded-lg p-4 border border-${statusColor}-500">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <svg class="h-5 w-5 text-${statusColor}-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${statusIcon}
            </svg>
            <span class="font-semibold text-${statusColor}-400">${manifestName}</span>
          </div>
          <div class="text-sm text-gray-400">
            ${manifestData.validReferences} / ${manifestData.totalReferences} valid
          </div>
        </div>

        ${manifestData.missing.length > 0 ? `
          <div class="space-y-2 mt-3">
            ${manifestData.missing.map(missing => `
              <div class="bg-gray-800 rounded p-3 border-l-4 border-red-500">
                <div class="flex items-start gap-2">
                  <svg class="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-sm text-red-300 break-all">${missing.assetPath}</div>
                    <div class="text-xs text-gray-500 mt-1">Location: ${missing.location}</div>
                    <div class="text-xs text-gray-500">Resolved path: ${missing.resolvedPath}</div>
                    <div class="text-xs text-yellow-400 mt-2">
                      <svg class="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Suggestion: Create or upload the missing file to the correct path
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-sm text-green-400 mt-2">All references are valid</p>'}
      </div>
    `;
  }).filter(html => html !== '').join('');

  // Show message if all filtered out
  if (container.innerHTML.trim() === '') {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <p>No manifests to display</p>
      </div>
    `;
  }
}

// Toggle show only issues filter
function toggleIssuesFilter() {
  showOnlyIssuesEnabled = document.getElementById('showOnlyIssues').checked;
  if (validationData) {
    renderMissingAssets(validationData);
  }
}

// ==============================================
// CONFIGURATION SETTINGS FUNCTIONS
// ==============================================

let currentConfig = null;
let currentTab = 'server';

// Open settings modal
async function openSettings() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('hidden');
  
  // Load current configuration
  await loadCurrentConfig();
}

// Close settings modal
function closeSettings() {
  const modal = document.getElementById('settingsModal');
  modal.classList.add('hidden');
  hideSettingsError();
  hideSettingsWarning();
}

// Load current configuration from API
async function loadCurrentConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    
    if (data.success) {
      currentConfig = data.config;
      populateConfigForm(currentConfig);
    } else {
      showSettingsError('Failed to load configuration');
    }
  } catch (error) {
    showSettingsError(`Failed to load configuration: ${error.message}`);
  }
}

// Populate form with configuration data
function populateConfigForm(config) {
  // Server settings
  document.getElementById('config-server-port').value = config.server.port;
  document.getElementById('config-server-host').value = config.server.host;
  
  // CORS settings
  populateTagInput('config-cors-allowedOrigins', config.cors.allowedOrigins);
  populateTagInput('config-cors-allowedMethods', config.cors.allowedMethods);
  populateTagInput('config-cors-allowedHeaders', config.cors.allowedHeaders);
  
  // Directory settings
  populateTagInput('config-directories-assets', config.directories.assets);
  document.getElementById('config-directories-upload').value = config.directories.upload;
  document.getElementById('config-directories-backups').value = config.directories.backups;
  
  // Security settings
  document.getElementById('config-security-maxFileSize').value = config.security.maxFileSize;
  populateTagInput('config-security-allowedFileTypes', config.security.allowedFileTypes);
  document.getElementById('config-security-enableAuth').checked = config.security.enableAuth;
  
  // Features settings
  document.getElementById('config-features-enableValidation').checked = config.features.enableValidation;
  document.getElementById('config-features-enableBackups').checked = config.features.enableBackups;
  document.getElementById('config-features-autoBackupInterval').value = config.features.autoBackupInterval;
  
  // UI settings
  document.getElementById('config-ui-theme').value = config.ui.theme;
  document.getElementById('config-ui-itemsPerPage').value = config.ui.itemsPerPage;
  document.getElementById('config-ui-defaultSort').value = config.ui.defaultSort;
}

// Populate tag input (for arrays)
function populateTagInput(containerId, values) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  // Add existing tags
  values.forEach(value => {
    addTag(container, value);
  });
  
  // Add input field
  addTagInputField(container);
}

// Add a tag to container
function addTag(container, value) {
  const tag = document.createElement('span');
  tag.className = 'tag-item';
  tag.innerHTML = `
    ${value}
    <button type="button" onclick="this.parentElement.remove()" class="tag-remove">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  `;
  
  // Insert before input field if it exists
  const input = container.querySelector('.tag-input');
  if (input) {
    container.insertBefore(tag, input);
  } else {
    container.appendChild(tag);
  }
}

// Add tag input field
function addTagInputField(container) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-input';
  input.placeholder = 'Type and press Enter...';
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (value) {
        addTag(container, value);
        input.value = '';
      }
    }
  });
  
  container.appendChild(input);
}

// Switch settings tab
function switchSettingsTab(tabName) {
  currentTab = tabName;
  
  // Update tab buttons
  const tabs = document.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('border-blue-500', 'text-blue-400');
      tab.classList.remove('border-transparent', 'text-gray-400');
    } else {
      tab.classList.remove('border-blue-500', 'text-blue-400');
      tab.classList.add('border-transparent', 'text-gray-400');
    }
  });
  
  // Update panels
  const panels = document.querySelectorAll('.settings-panel');
  panels.forEach(panel => {
    if (panel.id === `${tabName}Settings`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
}

// Collect configuration from form
function collectConfigFromForm() {
  return {
    server: {
      port: parseInt(document.getElementById('config-server-port').value),
      host: document.getElementById('config-server-host').value
    },
    cors: {
      allowedOrigins: getTagValues('config-cors-allowedOrigins'),
      allowedMethods: getTagValues('config-cors-allowedMethods'),
      allowedHeaders: getTagValues('config-cors-allowedHeaders')
    },
    directories: {
      assets: getTagValues('config-directories-assets'),
      upload: document.getElementById('config-directories-upload').value,
      backups: document.getElementById('config-directories-backups').value
    },
    security: {
      maxFileSize: parseInt(document.getElementById('config-security-maxFileSize').value),
      allowedFileTypes: getTagValues('config-security-allowedFileTypes'),
      enableAuth: document.getElementById('config-security-enableAuth').checked
    },
    features: {
      enableValidation: document.getElementById('config-features-enableValidation').checked,
      enableBackups: document.getElementById('config-features-enableBackups').checked,
      autoBackupInterval: parseInt(document.getElementById('config-features-autoBackupInterval').value)
    },
    ui: {
      theme: document.getElementById('config-ui-theme').value,
      itemsPerPage: parseInt(document.getElementById('config-ui-itemsPerPage').value),
      defaultSort: document.getElementById('config-ui-defaultSort').value
    }
  };
}

// Get tag values from container
function getTagValues(containerId) {
  const container = document.getElementById(containerId);
  const tags = container.querySelectorAll('.tag-item');
  return Array.from(tags).map(tag => tag.textContent.trim());
}

// Save configuration
async function saveConfig() {
  hideSettingsError();
  hideSettingsWarning();
  
  const newConfig = collectConfigFromForm();
  
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config: newConfig })
    });
    
    const result = await response.json();
    
    if (result.success) {
      currentConfig = result.config;
      showSuccess('Configuration saved successfully');
      
      if (result.restartRequired) {
        showSettingsWarning();
      }
      
      // Reload page if UI settings changed
      if (newConfig.ui.theme !== currentConfig.ui.theme) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } else {
      showSettingsError(result.error || 'Failed to save configuration');
      if (result.errors) {
        showSettingsError(result.errors.join(', '));
      }
    }
  } catch (error) {
    showSettingsError(`Failed to save configuration: ${error.message}`);
  }
}

// Reset configuration to defaults
async function resetConfig() {
  if (!confirm('Are you sure you want to reset all configuration to defaults? This will require a server restart.')) {
    return;
  }
  
  hideSettingsError();
  hideSettingsWarning();
  
  try {
    const response = await fetch('/api/config/reset', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      currentConfig = result.config;
      populateConfigForm(currentConfig);
      showSuccess('Configuration reset to defaults');
      showSettingsWarning();
    } else {
      showSettingsError(result.error || 'Failed to reset configuration');
    }
  } catch (error) {
    showSettingsError(`Failed to reset configuration: ${error.message}`);
  }
}

// Export configuration as JSON
function exportConfig() {
  if (!currentConfig) {
    showSettingsError('No configuration loaded');
    return;
  }
  
  const dataStr = JSON.stringify(currentConfig, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hyperscape-config.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showSuccess('Configuration exported');
}

// Import configuration from JSON
function importConfig() {
  const input = document.getElementById('configImportInput');
  input.click();
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedConfig = JSON.parse(text);
      
      // Populate form with imported config
      populateConfigForm(importedConfig);
      showSuccess('Configuration imported. Click Save to apply.');
    } catch (error) {
      showSettingsError(`Failed to import configuration: ${error.message}`);
    }
    
    // Reset input
    input.value = '';
  };
}

// Show settings error
function showSettingsError(message) {
  const errorEl = document.getElementById('settingsError');
  const messageEl = document.getElementById('settingsErrorMessage');
  messageEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// Hide settings error
function hideSettingsError() {
  const errorEl = document.getElementById('settingsError');
  errorEl.classList.add('hidden');
}

// Show settings warning
function showSettingsWarning() {
  const warningEl = document.getElementById('settingsWarning');
  warningEl.classList.remove('hidden');
}

// Hide settings warning
function hideSettingsWarning() {
  const warningEl = document.getElementById('settingsWarning');
  warningEl.classList.add('hidden');
}

// Close settings modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('settingsModal');
  if (e.target === modal) {
    closeSettings();
  }
});
