const fs = require('fs');
const path = require('path');

// Configuration (can be overridden by env vars)
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || 'admin-static-token';
const WP_UPLOADS_DIR = process.env.WP_UPLOADS_DIR || './wp-content/uploads';

/**
 * Traverses a directory recursively and returns all file paths.
 */
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

/**
 * Uploads a single file to Directus.
 */
async function uploadToDirectus(filePath) {
  const fileName = path.basename(filePath);
  
  // Skip WordPress auto-generated thumbnails (e.g. image-150x150.jpg)
  if (fileName.match(/-\d+x\d+\.\w+$/)) {
    console.log(`Skipping thumbnail: ${fileName}`);
    return;
  }

  const fileData = fs.readFileSync(filePath);
  const formData = new FormData();
  
  // Convert Node Buffer to Blob
  const blob = new Blob([fileData]);
  formData.append('file', blob, fileName);

  try {
    const response = await fetch(`${DIRECTUS_URL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    console.log(`Success: ${fileName} -> Directus ID: ${json.data.id}`);
  } catch (error) {
    console.error(`Failed to upload ${fileName}:`, error.message);
  }
}

async function run() {
  console.log(`[Media Migration] Scanning ${WP_UPLOADS_DIR}...`);
  if (!fs.existsSync(WP_UPLOADS_DIR)) {
    console.error(`Directory not found: ${WP_UPLOADS_DIR}`);
    process.exit(1);
  }

  const allFiles = getAllFiles(WP_UPLOADS_DIR);
  console.log(`[Media Migration] Found ${allFiles.length} total files.`);

  // Upload files sequentially to avoid overwhelming the Directus instance/Azure Blob
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    console.log(`[${i + 1}/${allFiles.length}] Processing ${file}...`);
    await uploadToDirectus(file);
  }

  console.log('[Media Migration] Complete.');
}

run();
