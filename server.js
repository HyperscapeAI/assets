import { join, extname, relative, dirname, basename, normalize, sep } from 'path';
import { readdirSync, statSync, mkdirSync, unlinkSync, renameSync, existsSync, readFileSync, writeFileSync, rmdirSync, cpSync, copyFileSync } from 'fs';
import { ZipWriter, BlobWriter, ZipReader, BlobReader } from '@zip.js/zip.js';

const ROOT_DIR = process.cwd();

// Configuration Management
let config = null;
const CONFIG_PATH = join(ROOT_DIR, 'config.json');
const DEFAULT_CONFIG = {
  server: {
    port: 3000,
    host: "localhost"
  },
  cors: {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  },
  directories: {
    assets: ["models", "manifests", "emotes", "music", "world", "web"],
    upload: "uploads",
    backups: "backups"
  },
  security: {
    maxFileSize: 104857600,
    allowedFileTypes: [".glb", ".json", ".mp3", ".png", ".jpg", ".jpeg", ".woff2", ".vrm"],
    enableAuth: false
  },
  features: {
    enableValidation: true,
    enableBackups: true,
    autoBackupInterval: 86400000
  },
  ui: {
    theme: "dark",
    itemsPerPage: 50,
    defaultSort: "name"
  }
};

// Load configuration from file and merge with environment variables
function loadConfig() {
  try {
    // Load from file if exists
    if (existsSync(CONFIG_PATH)) {
      const fileContent = readFileSync(CONFIG_PATH, 'utf-8');
      config = JSON.parse(fileContent);
    } else {
      // Use default config
      config = { ...DEFAULT_CONFIG };
      saveConfig(config);
    }

    // Override with environment variables
    if (process.env.PORT) config.server.port = parseInt(process.env.PORT);
    if (process.env.HOST) config.server.host = process.env.HOST;
    if (process.env.CORS_ORIGINS) config.cors.allowedOrigins = process.env.CORS_ORIGINS.split(',');
    if (process.env.MAX_FILE_SIZE) config.security.maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
    if (process.env.ENABLE_AUTH) config.security.enableAuth = process.env.ENABLE_AUTH === 'true';

    console.log('Configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('Error loading config, using defaults:', error);
    config = { ...DEFAULT_CONFIG };
    return config;
  }
}

// Save configuration to file
function saveConfig(newConfig) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    console.log('Configuration saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Validate configuration
function validateConfig(configToValidate) {
  const errors = [];

  // Validate server
  if (!configToValidate.server || typeof configToValidate.server.port !== 'number') {
    errors.push('server.port must be a number');
  }
  if (configToValidate.server.port < 1 || configToValidate.server.port > 65535) {
    errors.push('server.port must be between 1 and 65535');
  }

  // Validate CORS
  if (!Array.isArray(configToValidate.cors.allowedOrigins)) {
    errors.push('cors.allowedOrigins must be an array');
  }
  if (!Array.isArray(configToValidate.cors.allowedMethods)) {
    errors.push('cors.allowedMethods must be an array');
  }

  // Validate directories
  if (!Array.isArray(configToValidate.directories.assets)) {
    errors.push('directories.assets must be an array');
  }

  // Validate security
  if (typeof configToValidate.security.maxFileSize !== 'number') {
    errors.push('security.maxFileSize must be a number');
  }
  if (!Array.isArray(configToValidate.security.allowedFileTypes)) {
    errors.push('security.allowedFileTypes must be an array');
  }

  return errors;
}

// Get sanitized config (without sensitive data)
function getSanitizedConfig() {
  const sanitized = JSON.parse(JSON.stringify(config));
  // Remove or mask sensitive fields if any in the future
  return sanitized;
}

// Initialize configuration
config = loadConfig();

const PORT = config.server.port;

// Directories to manage (from config)
const ASSET_DIRS = config.directories.assets;

// Environment configuration
const ENVIRONMENTS = ['draft', 'staging', 'production'];
const PRODUCTION_ENV = 'production'; // Production uses root-level directories

// Current active environment (default to production)
let currentEnvironment = 'production';

// Environment utilities
function getEnvironmentPath(environment) {
  if (environment === 'production') {
    return ROOT_DIR;
  }
  return join(ROOT_DIR, environment);
}

function getEnvironmentAssetDirs(environment) {
  const basePath = getEnvironmentPath(environment);
  return ASSET_DIRS.map(dir => join(basePath, dir));
}

function validateEnvironment(env) {
  return ENVIRONMENTS.includes(env);
}

function ensureEnvironmentDirectories() {
  // Create draft and staging directories if they don't exist
  ['draft', 'staging'].forEach(env => {
    ASSET_DIRS.forEach(dir => {
      const dirPath = join(ROOT_DIR, env, dir);
      try {
        mkdirSync(dirPath, { recursive: true });
      } catch (err) {
        console.error(`Error creating ${dirPath}:`, err);
      }
    });
  });
}

// Initialize environment directories on startup
ensureEnvironmentDirectories();

// Helper: Validate path to prevent traversal attacks
function isValidPath(userPath) {
  const normalizedPath = normalize(join(ROOT_DIR, userPath));
  return normalizedPath.startsWith(ROOT_DIR) && !userPath.includes('..');
}

// Helper: Get all files recursively
function getAllFiles(dir, fileList = []) {
  try {
    const files = readdirSync(dir);
    files.forEach(file => {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList);
        } else {
          fileList.push({
            path: relative(ROOT_DIR, filePath),
            name: file,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type: extname(file)
          });
        }
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return fileList;
}

// Helper: Get directory tree structure
function getDirectoryTree(dir, basePath = '') {
  const tree = [];
  try {
    const items = readdirSync(dir);
    items.forEach(item => {
      const itemPath = join(dir, item);
      const relativePath = basePath ? join(basePath, item) : item;

      try {
        const stat = statSync(itemPath);
        if (stat.isDirectory()) {
          const files = getAllFiles(itemPath);
          tree.push({
            name: item,
            path: relativePath,
            type: 'directory',
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            children: getDirectoryTree(itemPath, relativePath)
          });
        }
      } catch (err) {
        console.error(`Error reading ${itemPath}:`, err);
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return tree;
}

// Helper: Check if directory is empty
function isDirectoryEmpty(dirPath) {
  try {
    const items = readdirSync(dirPath);
    return items.length === 0;
  } catch (err) {
    return false;
  }
}

// CORS headers (from config)
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': config.cors.allowedOrigins.join(', '),
    'Access-Control-Allow-Methods': config.cors.allowedMethods.join(', '),
    'Access-Control-Allow-Headers': config.cors.allowedHeaders.join(', '),
  };
}

let corsHeaders = getCorsHeaders();

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // API Routes
    if (pathname.startsWith('/api/')) {

      // List all files
      if (pathname === '/api/files' && request.method === 'GET') {
        const files = [];
        ASSET_DIRS.forEach(dir => {
          const dirPath = join(ROOT_DIR, dir);
          try {
            getAllFiles(dirPath, files);
          } catch (err) {
            console.error(`Error listing ${dir}:`, err);
          }
        });

        // Also include root-level files
        try {
          const rootFiles = readdirSync(ROOT_DIR);
          rootFiles.forEach(file => {
            const filePath = join(ROOT_DIR, file);
            try {
              const stat = statSync(filePath);
              if (!stat.isDirectory() && file !== 'server.js') {
                files.push({
                  path: file,
                  name: file,
                  size: stat.size,
                  modified: stat.mtime.toISOString(),
                  type: extname(file)
                });
              }
            } catch (err) {}
          });
        } catch (err) {}

        return new Response(JSON.stringify({ files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Upload files
      if (pathname === '/api/upload' && request.method === 'POST') {
        try {
          const formData = await request.formData();
          const files = formData.getAll('files');
          const targetDir = formData.get('directory') || 'models';

          const uploadedFiles = [];

          for (const file of files) {
            if (file instanceof File) {
              const targetPath = join(ROOT_DIR, targetDir, file.name);
              const dirPath = join(ROOT_DIR, targetDir);

              // Ensure directory exists
              try {
                mkdirSync(dirPath, { recursive: true });
              } catch (err) {}

              // Write file
              const buffer = await file.arrayBuffer();
              await Bun.write(targetPath, buffer);

              uploadedFiles.push({
                name: file.name,
                size: file.size,
                path: join(targetDir, file.name)
              });
            }
          }

          return new Response(JSON.stringify({
            success: true,
            files: uploadedFiles
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Rename file
      if (pathname === '/api/rename' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { oldPath, newName } = body;

          // Validate inputs
          if (!oldPath || !newName) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing oldPath or newName'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Security: validate newName doesn't contain path separators or dangerous characters
          if (newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid filename: cannot contain path separators or ..'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Construct full paths
          const oldFullPath = join(ROOT_DIR, oldPath);
          const newFullPath = join(dirname(oldFullPath), newName);

          // Security check: ensure both paths are within ROOT_DIR
          if (!oldFullPath.startsWith(ROOT_DIR) || !newFullPath.startsWith(ROOT_DIR)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid path: outside root directory'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if old file exists
          if (!existsSync(oldFullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'File not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if new file already exists
          if (existsSync(newFullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'A file with that name already exists'
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Rename the file
          renameSync(oldFullPath, newFullPath);

          const newPath = relative(ROOT_DIR, newFullPath);

          return new Response(JSON.stringify({
            success: true,
            message: `Renamed to ${newName}`,
            newPath: newPath
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Delete file
      if (pathname.startsWith('/api/delete/') && request.method === 'DELETE') {
        try {
          const filePath = decodeURIComponent(pathname.replace('/api/delete/', ''));
          const fullPath = join(ROOT_DIR, filePath);

          // Security check: ensure path is within ROOT_DIR
          if (!fullPath.startsWith(ROOT_DIR)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid path'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          unlinkSync(fullPath);

          return new Response(JSON.stringify({
            success: true,
            message: `Deleted ${filePath}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Get directory structure
      if (pathname === '/api/directories' && request.method === 'GET') {
        const dirs = ASSET_DIRS.map(dir => {
          const dirPath = join(ROOT_DIR, dir);
          try {
            const stat = statSync(dirPath);
            const files = getAllFiles(dirPath);
            return {
              name: dir,
              path: dir,
              fileCount: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0)
            };
          } catch (err) {
            return null;
          }
        }).filter(Boolean);

        return new Response(JSON.stringify({ directories: dirs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate asset references
      if (pathname === '/api/validate-references' && request.method === 'GET') {
        try {
          const manifestDir = join(ROOT_DIR, 'manifests');
          const manifestFiles = readdirSync(manifestDir)
            .filter(file => file.endsWith('.json') && file !== 'batch-generation.json' && file !== 'transform-to-npcs.js');

          const validationResults = {
            timestamp: new Date().toISOString(),
            totalReferences: 0,
            validReferences: 0,
            missingReferences: 0,
            manifests: {}
          };

          // Helper function to recursively extract asset:// paths from objects
          function extractAssetPaths(obj, currentPath = '') {
            const paths = [];

            if (typeof obj === 'string' && obj.startsWith('asset://')) {
              return [{ path: obj, location: currentPath }];
            }

            if (Array.isArray(obj)) {
              obj.forEach((item, index) => {
                paths.push(...extractAssetPaths(item, `${currentPath}[${index}]`));
              });
            } else if (obj && typeof obj === 'object') {
              Object.entries(obj).forEach(([key, value]) => {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                paths.push(...extractAssetPaths(value, newPath));
              });
            }

            return paths;
          }

          // Process each manifest file
          for (const manifestFile of manifestFiles) {
            const manifestPath = join(manifestDir, manifestFile);

            try {
              const content = await Bun.file(manifestPath).text();
              const data = JSON.parse(content);

              const assetRefs = extractAssetPaths(data);
              const manifestResult = {
                totalReferences: assetRefs.length,
                validReferences: 0,
                missing: []
              };

              // Check each asset reference
              for (const ref of assetRefs) {
                validationResults.totalReferences++;

                // Strip "asset://" prefix to get file path
                const assetPath = ref.path.replace('asset://', '');
                const fullPath = join(ROOT_DIR, assetPath);

                if (existsSync(fullPath)) {
                  manifestResult.validReferences++;
                  validationResults.validReferences++;
                } else {
                  manifestResult.missing.push({
                    assetPath: ref.path,
                    location: ref.location,
                    resolvedPath: assetPath,
                    suggestion: `File not found: ${assetPath}`
                  });
                  validationResults.missingReferences++;
                }
              }

              validationResults.manifests[manifestFile] = manifestResult;
            } catch (err) {
              console.error(`Error processing ${manifestFile}:`, err);
              validationResults.manifests[manifestFile] = {
                error: err.message
              };
            }
          }

          return new Response(JSON.stringify(validationResults), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Bulk download files as ZIP
      if (pathname === '/api/bulk-download' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { filePaths } = body;

          // Validate input
          if (!Array.isArray(filePaths) || filePaths.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid or empty filePaths array'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Create ZIP file in memory
          const blobWriter = new BlobWriter('application/zip');
          const zipWriter = new ZipWriter(blobWriter);

          // Add each file to the ZIP
          for (const filePath of filePaths) {
            const fullPath = join(ROOT_DIR, filePath);

            // Security check: ensure path is within ROOT_DIR
            if (!fullPath.startsWith(ROOT_DIR)) {
              continue; // Skip invalid paths
            }

            // Check if file exists
            if (!existsSync(fullPath)) {
              continue; // Skip missing files
            }

            try {
              // Read file content
              const fileContent = readFileSync(fullPath);

              // Add file to ZIP with its relative path
              await zipWriter.add(filePath, new Blob([fileContent]).stream());
            } catch (err) {
              console.error(`Error adding ${filePath} to ZIP:`, err);
              // Continue with other files
            }
          }

          // Close the ZIP writer
          const zipBlob = await zipWriter.close();
          const zipBuffer = await zipBlob.arrayBuffer();

          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `hyperscape-assets-${timestamp}.zip`;

          return new Response(zipBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${filename}"`
            }
          });
        } catch (error) {
          console.error('Bulk download error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Configuration API endpoints
// Environment API endpoints - INSERT THESE BEFORE LINE 683 IN server.js

      // Get list of environments with stats
      if (pathname === '/api/environments' && request.method === 'GET') {
        try {
          const environmentStats = ENVIRONMENTS.map(env => {
            const basePath = getEnvironmentPath(env);
            const files = [];

            ASSET_DIRS.forEach(dir => {
              const dirPath = join(basePath, dir);
              try {
                if (existsSync(dirPath)) {
                  getAllFiles(dirPath, files);
                }
              } catch (err) {
                console.error(`Error listing ${dir} in ${env}:`, err);
              }
            });

            return {
              name: env,
              fileCount: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0),
              isCurrent: env === currentEnvironment
            };
          });

          return new Response(JSON.stringify({
            environments: environmentStats,
            current: currentEnvironment
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Set current active environment
      if (pathname === '/api/set-environment' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { environment } = body;

          if (!validateEnvironment(environment)) {
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid environment. Must be one of: ${ENVIRONMENTS.join(', ')}`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          currentEnvironment = environment;

          return new Response(JSON.stringify({
            success: true,
            environment: currentEnvironment,
            message: `Environment set to ${environment}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Promote files between environments
      if (pathname === '/api/promote' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { filePaths, fromEnv, toEnv } = body;

          // Validate inputs
          if (!Array.isArray(filePaths) || filePaths.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'filePaths must be a non-empty array'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!validateEnvironment(fromEnv) || !validateEnvironment(toEnv)) {
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid environment. Must be one of: ${ENVIRONMENTS.join(', ')}`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (fromEnv === toEnv) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Source and destination environments must be different'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const fromBasePath = getEnvironmentPath(fromEnv);
          const toBasePath = getEnvironmentPath(toEnv);

          const results = {
            promoted: [],
            failed: [],
            warnings: []
          };

          // Promote each file
          for (const filePath of filePaths) {
            try {
              // For production environment, file paths are relative to ROOT_DIR
              // For draft/staging, paths include the environment name
              let relativeFilePath = filePath;

              // Strip environment prefix if present
              if (fromEnv !== 'production' && filePath.startsWith(`${fromEnv}/`)) {
                relativeFilePath = filePath.substring(`${fromEnv}/`.length);
              } else if (filePath.startsWith(`${fromEnv}/`)) {
                relativeFilePath = filePath.substring(`${fromEnv}/`.length);
              }

              const fromFullPath = join(fromBasePath, relativeFilePath);
              const toFullPath = join(toBasePath, relativeFilePath);

              // Check if source file exists
              if (!existsSync(fromFullPath)) {
                results.failed.push({
                  path: filePath,
                  error: 'Source file not found'
                });
                continue;
              }

              // Check if destination file already exists
              if (existsSync(toFullPath)) {
                results.warnings.push({
                  path: filePath,
                  message: 'File already exists in destination, will be overwritten'
                });
              }

              // Ensure destination directory exists
              const destDir = dirname(toFullPath);
              mkdirSync(destDir, { recursive: true });

              // Copy the file
              copyFileSync(fromFullPath, toFullPath);

              results.promoted.push({
                path: relativeFilePath,
                from: fromEnv,
                to: toEnv
              });

            } catch (error) {
              results.failed.push({
                path: filePath,
                error: error.message
              });
            }
          }

          return new Response(JSON.stringify({
            success: true,
            promoted: results.promoted.length,
            failed: results.failed.length,
            results: results
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Compare two environments
      if (pathname === '/api/compare-environments' && request.method === 'GET') {
        try {
          const env1 = url.searchParams.get('env1');
          const env2 = url.searchParams.get('env2');

          if (!validateEnvironment(env1) || !validateEnvironment(env2)) {
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid environment. Must be one of: ${ENVIRONMENTS.join(', ')}`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Get files from both environments
          const files1 = [];
          const files2 = [];

          ASSET_DIRS.forEach(dir => {
            const dirPath1 = join(getEnvironmentPath(env1), dir);
            const dirPath2 = join(getEnvironmentPath(env2), dir);

            try {
              if (existsSync(dirPath1)) {
                getAllFiles(dirPath1, files1);
              }
            } catch (err) {
              console.error(`Error listing ${dir} in ${env1}:`, err);
            }

            try {
              if (existsSync(dirPath2)) {
                getAllFiles(dirPath2, files2);
              }
            } catch (err) {
              console.error(`Error listing ${dir} in ${env2}:`, err);
            }
          });

          // Normalize file paths (remove environment prefix for comparison)
          const normalizePath = (path, env) => {
            if (env === 'production') return path;
            return path.startsWith(`${env}/`) ? path.substring(`${env}/`.length) : path;
          };

          const files1Map = new Map(files1.map(f => [normalizePath(f.path, env1), f]));
          const files2Map = new Map(files2.map(f => [normalizePath(f.path, env2), f]));

          const comparison = {
            env1: env1,
            env2: env2,
            onlyInEnv1: [],
            onlyInEnv2: [],
            different: [],
            identical: []
          };

          // Check files in env1
          for (const [normalizedPath, file1] of files1Map.entries()) {
            const file2 = files2Map.get(normalizedPath);

            if (!file2) {
              comparison.onlyInEnv1.push({
                path: normalizedPath,
                size: file1.size,
                modified: file1.modified
              });
            } else {
              if (file1.size !== file2.size || file1.modified !== file2.modified) {
                comparison.different.push({
                  path: normalizedPath,
                  env1File: {
                    size: file1.size,
                    modified: file1.modified
                  },
                  env2File: {
                    size: file2.size,
                    modified: file2.modified
                  }
                });
              } else {
                comparison.identical.push(normalizedPath);
              }
            }
          }

          // Check files only in env2
          for (const [normalizedPath, file2] of files2Map.entries()) {
            if (!files1Map.has(normalizedPath)) {
              comparison.onlyInEnv2.push({
                path: normalizedPath,
                size: file2.size,
                modified: file2.modified
              });
            }
          }

          return new Response(JSON.stringify(comparison), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Get current configuration
      if (pathname === '/api/config' && request.method === 'GET') {
        return new Response(JSON.stringify({
          success: true,
          config: getSanitizedConfig()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update configuration
      if (pathname === '/api/config' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { config: newConfig } = body;

          if (!newConfig) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Configuration data is required'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Merge with existing config
          const mergedConfig = {
            ...config,
            ...newConfig,
            server: { ...config.server, ...newConfig.server },
            cors: { ...config.cors, ...newConfig.cors },
            directories: { ...config.directories, ...newConfig.directories },
            security: { ...config.security, ...newConfig.security },
            features: { ...config.features, ...newConfig.features },
            ui: { ...config.ui, ...newConfig.ui }
          };

          // Validate the new configuration
          const errors = validateConfig(mergedConfig);
          if (errors.length > 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Configuration validation failed',
              errors: errors
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Save configuration
          const saved = saveConfig(mergedConfig);
          if (!saved) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Failed to save configuration'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Update in-memory config
          config = mergedConfig;

          // Update CORS headers if changed
          corsHeaders = getCorsHeaders();

          // Check if restart is required
          const restartRequired =
            newConfig.server?.port !== undefined ||
            newConfig.server?.host !== undefined;

          // Log config change
          console.log(`[${new Date().toISOString()}] Configuration updated`);

          return new Response(JSON.stringify({
            success: true,
            message: 'Configuration updated successfully',
            restartRequired,
            config: getSanitizedConfig()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Reset configuration to defaults
      if (pathname === '/api/config/reset' && request.method === 'POST') {
        try {
          const resetConfig = { ...DEFAULT_CONFIG };
          const saved = saveConfig(resetConfig);

          if (!saved) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Failed to reset configuration'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          config = resetConfig;
          corsHeaders = getCorsHeaders();

          console.log(`[${new Date().toISOString()}] Configuration reset to defaults`);

          return new Response(JSON.stringify({
            success: true,
            message: 'Configuration reset to defaults',
            restartRequired: true,
            config: getSanitizedConfig()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Get configuration schema
      if (pathname === '/api/config/schema' && request.method === 'GET') {
        const schema = {
          server: {
            port: { type: 'number', min: 1, max: 65535, description: 'Server port number' },
            host: { type: 'string', description: 'Server host address' }
          },
          cors: {
            allowedOrigins: { type: 'array', items: 'string', description: 'Allowed CORS origins' },
            allowedMethods: { type: 'array', items: 'string', description: 'Allowed HTTP methods' },
            allowedHeaders: { type: 'array', items: 'string', description: 'Allowed HTTP headers' }
          },
          directories: {
            assets: { type: 'array', items: 'string', description: 'Asset directory names' },
            upload: { type: 'string', description: 'Upload directory name' },
            backups: { type: 'string', description: 'Backup directory name' }
          },
          security: {
            maxFileSize: { type: 'number', description: 'Maximum file upload size in bytes' },
            allowedFileTypes: { type: 'array', items: 'string', description: 'Allowed file extensions' },
            enableAuth: { type: 'boolean', description: 'Enable authentication' }
          },
          features: {
            enableValidation: { type: 'boolean', description: 'Enable asset validation' },
            enableBackups: { type: 'boolean', description: 'Enable automatic backups' },
            autoBackupInterval: { type: 'number', description: 'Auto backup interval in milliseconds' }
          },
          ui: {
            theme: { type: 'string', enum: ['dark', 'light'], description: 'UI theme' },
            itemsPerPage: { type: 'number', min: 10, max: 200, description: 'Items per page' },
            defaultSort: { type: 'string', enum: ['name', 'size', 'modified', 'path'], description: 'Default sort column' }
          }
        };

        return new Response(JSON.stringify({
          success: true,
          schema
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bulk delete files
      if (pathname === '/api/bulk-delete' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { filePaths } = body;

          // Validate input
          if (!Array.isArray(filePaths) || filePaths.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid or empty filePaths array'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const results = {
            deleted: [],
            failed: []
          };

          // Delete each file
          for (const filePath of filePaths) {
            const fullPath = join(ROOT_DIR, filePath);

            // Security check: ensure path is within ROOT_DIR
            if (!fullPath.startsWith(ROOT_DIR)) {
              results.failed.push({
                path: filePath,
                error: 'Invalid path: outside root directory'
              });
              continue;
            }

            try {
              if (existsSync(fullPath)) {
                unlinkSync(fullPath);
                results.deleted.push(filePath);
              } else {
                results.failed.push({
                  path: filePath,
                  error: 'File not found'
                });
              }
            } catch (error) {
              results.failed.push({
                path: filePath,
                error: error.message
              });
            }
          }

          return new Response(JSON.stringify({
            success: true,
            deleted: results.deleted.length,
            failed: results.failed.length,
            results: results
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }


      // Export full backup as ZIP
      if (pathname === '/api/export-full' && request.method === 'GET') {
        try {
          const EXCLUDED_DIRS = ['node_modules', '.git', 'dashboard', 'backups', 'draft', 'staging'];
          const blobWriter = new BlobWriter('application/zip');
          const zipWriter = new ZipWriter(blobWriter);

          // Collect all files to export
          const filesToExport = [];

          // Add ASSET_DIRS files
          ASSET_DIRS.forEach(dir => {
            const dirPath = join(ROOT_DIR, dir);
            if (existsSync(dirPath)) {
              const files = getAllFiles(dirPath);
              filesToExport.push(...files);
            }
          });

          // Add root-level files (excluding server.js and other system files)
          try {
            const rootFiles = readdirSync(ROOT_DIR);
            rootFiles.forEach(file => {
              const filePath = join(ROOT_DIR, file);
              try {
                const stat = statSync(filePath);
                if (!stat.isDirectory() && !['server.js', 'package.json', 'package-lock.json', 'bun.lockb', '.DS_Store', 'config.json'].includes(file)) {
                  filesToExport.push({
                    path: file,
                    name: file,
                    size: stat.size
                  });
                }
              } catch (err) {}
            });
          } catch (err) {}

          // Create manifest
          const manifest = {
            exportDate: new Date().toISOString(),
            fileCount: filesToExport.length,
            totalSize: filesToExport.reduce((sum, f) => sum + f.size, 0),
            directories: ASSET_DIRS,
            files: filesToExport.map(f => ({ path: f.path, size: f.size }))
          };

          // Add manifest to ZIP
          await zipWriter.add('manifest.json', new Blob([JSON.stringify(manifest, null, 2)]).stream());

          // Add all files to ZIP
          for (const file of filesToExport) {
            const fullPath = join(ROOT_DIR, file.path);
            if (existsSync(fullPath)) {
              try {
                const fileContent = readFileSync(fullPath);
                await zipWriter.add(file.path, new Blob([fileContent]).stream());
              } catch (err) {
                console.error(`Error adding ${file.path} to ZIP:`, err);
              }
            }
          }

          const zipBlob = await zipWriter.close();
          const zipBuffer = await zipBlob.arrayBuffer();

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `hyperscape-full-backup-${timestamp}.zip`;

          return new Response(zipBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${filename}"`
            }
          });
        } catch (error) {
          console.error('Export full error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Export single directory as ZIP
      if (pathname.startsWith('/api/export-directory/') && request.method === 'GET') {
        try {
          const dirName = decodeURIComponent(pathname.replace('/api/export-directory/', ''));

          // Validate directory name
          if (!ASSET_DIRS.includes(dirName)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid directory name'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const dirPath = join(ROOT_DIR, dirName);

          if (!existsSync(dirPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Directory not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const blobWriter = new BlobWriter('application/zip');
          const zipWriter = new ZipWriter(blobWriter);

          // Get all files in directory
          const files = getAllFiles(dirPath);

          // Add all files to ZIP
          for (const file of files) {
            const fullPath = join(ROOT_DIR, file.path);
            if (existsSync(fullPath)) {
              try {
                const fileContent = readFileSync(fullPath);
                await zipWriter.add(file.path, new Blob([fileContent]).stream());
              } catch (err) {
                console.error(`Error adding ${file.path} to ZIP:`, err);
              }
            }
          }

          const zipBlob = await zipWriter.close();
          const zipBuffer = await zipBlob.arrayBuffer();

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `hyperscape-${dirName}-${timestamp}.zip`;

          return new Response(zipBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${filename}"`
            }
          });
        } catch (error) {
          console.error('Export directory error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Import/restore from ZIP
      if (pathname === '/api/import-zip' && request.method === 'POST') {
        try {
          const formData = await request.formData();
          const zipFile = formData.get('file');
          const targetDir = formData.get('targetDirectory') || '';
          const conflictResolution = formData.get('conflictResolution') || 'skip';

          if (!zipFile || !(zipFile instanceof File)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No ZIP file provided'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Security: Check ZIP file size (max 500MB to prevent zip bombs)
          const maxSize = 500 * 1024 * 1024;
          if (zipFile.size > maxSize) {
            return new Response(JSON.stringify({
              success: false,
              error: `ZIP file too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
            }), {
              status: 413,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Read ZIP file
          const zipBuffer = await zipFile.arrayBuffer();
          const zipBlob = new Blob([zipBuffer]);
          const zipReader = new ZipReader(new BlobReader(zipBlob));
          const entries = await zipReader.getEntries();

          // Security: Check for zip bombs (too many files or deeply nested)
          if (entries.length > 10000) {
            await zipReader.close();
            return new Response(JSON.stringify({
              success: false,
              error: 'ZIP file contains too many entries (max 10,000)'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const results = {
            extracted: [],
            skipped: [],
            failed: [],
            overwritten: []
          };

          // Process each entry
          for (const entry of entries) {
            if (entry.directory) continue;

            const fileName = entry.filename;

            // Security: validate filename
            if (fileName.includes('..') || fileName.startsWith('/') || fileName.includes('\\')) {
              results.failed.push({
                file: fileName,
                error: 'Invalid file path'
              });
              continue;
            }

            // Skip manifest.json from extraction
            if (fileName === 'manifest.json') {
              continue;
            }

            // Security: Check for path traversal in nested paths
            const pathParts = fileName.split('/');
            if (pathParts.some(part => part === '..' || part === '.' || part === '')) {
              results.failed.push({
                file: fileName,
                error: 'Invalid file path'
              });
              continue;
            }

            // Determine target path
            let targetPath;
            if (targetDir) {
              targetPath = join(ROOT_DIR, targetDir, fileName);
            } else {
              targetPath = join(ROOT_DIR, fileName);
            }

            // Security check
            const normalizedTarget = normalize(targetPath);
            if (!normalizedTarget.startsWith(ROOT_DIR)) {
              results.failed.push({
                file: fileName,
                error: 'Invalid target path (outside root directory)'
              });
              continue;
            }

            try {
              // Check if file exists
              const fileExists = existsSync(targetPath);

              if (fileExists && conflictResolution === 'skip') {
                results.skipped.push(fileName);
                continue;
              }

              // Ensure directory exists
              const dir = dirname(targetPath);
              mkdirSync(dir, { recursive: true });

              // Extract file content as blob (handles binary files properly)
              const blobWriter = new BlobWriter();
              const blob = await entry.getData(blobWriter);
              const arrayBuffer = await blob.arrayBuffer();

              // Write file
              writeFileSync(targetPath, new Uint8Array(arrayBuffer));

              if (fileExists) {
                results.overwritten.push(fileName);
              } else {
                results.extracted.push(fileName);
              }
            } catch (error) {
              results.failed.push({
                file: fileName,
                error: error.message
              });
            }
          }

          await zipReader.close();

          return new Response(JSON.stringify({
            success: true,
            extracted: results.extracted.length,
            skipped: results.skipped.length,
            failed: results.failed.length,
            overwritten: results.overwritten.length,
            results: results
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Import ZIP error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Preview ZIP contents
      if (pathname === '/api/preview-zip' && request.method === 'POST') {
        try {
          const formData = await request.formData();
          const zipFile = formData.get('file');

          if (!zipFile || !(zipFile instanceof File)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No ZIP file provided'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Security: Check ZIP file size
          const maxSize = 500 * 1024 * 1024;
          if (zipFile.size > maxSize) {
            return new Response(JSON.stringify({
              success: false,
              error: `ZIP file too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
            }), {
              status: 413,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Read ZIP file
          const zipBuffer = await zipFile.arrayBuffer();
          const zipBlob = new Blob([zipBuffer]);
          const zipReader = new ZipReader(new BlobReader(zipBlob));
          const entries = await zipReader.getEntries();

          const files = [];
          let totalSize = 0;
          let hasManifest = false;

          for (const entry of entries) {
            if (!entry.directory) {
              files.push({
                name: entry.filename,
                size: entry.uncompressedSize,
                compressedSize: entry.compressedSize,
                date: entry.lastModDate ? entry.lastModDate.toISOString() : null
              });
              totalSize += entry.uncompressedSize;

              if (entry.filename === 'manifest.json') {
                hasManifest = true;
              }
            }
          }

          await zipReader.close();

          return new Response(JSON.stringify({
            success: true,
            fileCount: files.length,
            totalSize: totalSize,
            hasManifest: hasManifest,
            files: files
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Preview ZIP error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Create new directory
      if (pathname === '/api/create-directory' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { parentPath, directoryName } = body;

          // Validate inputs
          if (!directoryName || typeof directoryName !== 'string') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid directory name'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Validate directory name doesn't contain dangerous characters
          if (directoryName.includes('/') || directoryName.includes('\\') || directoryName.includes('..') || directoryName.trim() === '') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Directory name cannot contain path separators, "..", or be empty'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Build full path
          const parentDir = parentPath && parentPath.trim() !== '' ? parentPath : '';
          const newDirPath = parentDir ? join(parentDir, directoryName) : directoryName;

          // Validate path is safe
          if (!isValidPath(newDirPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid path: outside root directory'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const fullPath = join(ROOT_DIR, newDirPath);

          // Check if directory already exists
          if (existsSync(fullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Directory already exists'
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Create directory (recursive: true allows creating nested directories)
          mkdirSync(fullPath, { recursive: true });

          return new Response(JSON.stringify({
            success: true,
            message: `Created directory: ${newDirPath}`,
            path: newDirPath
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Move or copy file
      if (pathname === '/api/move-file' && request.method === 'POST') {
        try {
          const body = await request.json();
          const { sourcePath, destinationPath, operation } = body;

          // Validate inputs
          if (!sourcePath || !destinationPath) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing sourcePath or destinationPath'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (operation !== 'move' && operation !== 'copy') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Operation must be "move" or "copy"'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Validate paths
          if (!isValidPath(sourcePath) || !isValidPath(destinationPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid path: outside root directory'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const sourceFullPath = join(ROOT_DIR, sourcePath);
          const destFullPath = join(ROOT_DIR, destinationPath);

          // Check if source exists
          if (!existsSync(sourceFullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Source file not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if destination already exists
          if (existsSync(destFullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Destination file already exists',
              conflict: true
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Ensure destination directory exists
          const destDir = dirname(destFullPath);
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }

          // Perform operation
          if (operation === 'move') {
            renameSync(sourceFullPath, destFullPath);
          } else {
            copyFileSync(sourceFullPath, destFullPath);
          }

          return new Response(JSON.stringify({
            success: true,
            message: `${operation === 'move' ? 'Moved' : 'Copied'} file successfully`,
            newPath: destinationPath
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Delete empty directory
      if (pathname === '/api/delete-directory' && request.method === 'DELETE') {
        try {
          const body = await request.json();
          const { directoryPath } = body;

          // Validate input
          if (!directoryPath) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing directoryPath'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Validate path
          if (!isValidPath(directoryPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Invalid path: outside root directory'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const fullPath = join(ROOT_DIR, directoryPath);

          // Check if directory exists
          if (!existsSync(fullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Directory not found'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if it's actually a directory
          const stat = statSync(fullPath);
          if (!stat.isDirectory()) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Path is not a directory'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Prevent deletion of root asset directories
          if (ASSET_DIRS.includes(directoryPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Cannot delete root asset directories'
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if directory is empty
          if (!isDirectoryEmpty(fullPath)) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Directory is not empty. Please delete all files first.'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Delete directory
          rmdirSync(fullPath);

          return new Response(JSON.stringify({
            success: true,
            message: `Deleted directory: ${directoryPath}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Get directory tree
      if (pathname === '/api/directory-tree' && request.method === 'GET') {
        try {
          const tree = getDirectoryTree(ROOT_DIR);

          return new Response(JSON.stringify({
            success: true,
            tree: tree
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    }

    // Serve dashboard
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const file = Bun.file(join(ROOT_DIR, 'dashboard', 'index.html'));
      return new Response(file, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      });
    }

    // Serve dashboard assets
    if (pathname.startsWith('/dashboard/')) {
      const filePath = join(ROOT_DIR, pathname);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        const contentType = file.type || 'application/octet-stream';
        return new Response(file, {
          headers: { ...corsHeaders, 'Content-Type': contentType }
        });
      }
    }

    // Serve static files (existing assets)
    const filePath = join(ROOT_DIR, pathname === '/' ? 'README.md' : pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      const contentType = file.type || 'application/octet-stream';
      return new Response(file, {
        headers: { ...corsHeaders, 'Content-Type': contentType }
      });
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  },
});

console.log(`🚀 HyperScape Assets Server running on http://localhost:${PORT}`);
console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
console.log(`🎮 Assets: http://localhost:${PORT}/models, /manifests, etc.`);
