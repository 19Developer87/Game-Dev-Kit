import {
  ASSET_IMAGE_DATABASE_NAME,
  ASSET_IMAGE_STORE_NAME,
  BACKUP_STORAGE_KEY,
  STORAGE_KEY,
} from "./EditorTypes.js";
import { createStarterProject, normalizeProject } from "./LevelManager.js";

export async function loadProject() {
  const savedProject = localStorage.getItem(STORAGE_KEY);

  if (!savedProject) {
    return {
      project: createStarterProject(),
      source: "new",
      message: "Created a new empty Starter Level.",
    };
  }

  try {
    const project = normalizeProject(JSON.parse(savedProject));
    await restoreImportedAssetImages(project);

    return {
      project,
      source: "saved",
      message: "Loaded saved editor data from this browser.",
    };
  } catch (error) {
    console.warn("Saved editor data could not be loaded.", error);
    return {
      project: createStarterProject(),
      source: "recovered",
      message: "Saved data was unreadable, so a new Starter Level was created.",
    };
  }
}

export async function saveProject(project) {
  const storedProject = await createStoredProject(project);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storedProject));
}

export function createProjectBackup(project, reason) {
  const backups = loadBackups();
  const backup = {
    id: `backup-${Date.now()}`,
    createdAt: new Date().toISOString(),
    reason,
    project,
  };

  backups.unshift(backup);
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups.slice(0, 10)));
  return backup;
}

async function createStoredProject(project) {
  const assetRegistry = project.assetRegistry || { categories: [], assets: [] };
  const assets = [];

  for (const asset of assetRegistry.assets || []) {
    if (asset.isImported && typeof asset.src === "string" && asset.src.startsWith("data:")) {
      try {
        await storeImportedImage(asset.id, asset.src);
        assets.push({
          ...asset,
          src: `indexeddb:${asset.id}`,
          imageStorageKey: asset.id,
        });
        continue;
      } catch (error) {
        console.warn(`Could not store image data for ${asset.id}; using project storage fallback.`, error);
      }
    }

    assets.push({ ...asset });
  }

  const storedProject = {
    ...project,
    assetRegistry: {
      ...assetRegistry,
      assets,
    },
  };

  // The live alias is rebuilt by normalizeProject; storing it duplicates every imported image.
  delete storedProject.assets;
  return storedProject;
}

async function restoreImportedAssetImages(project) {
  for (const asset of project.assetRegistry?.assets || []) {
    const storageKey = asset.imageStorageKey ||
      (typeof asset.src === "string" && asset.src.startsWith("indexeddb:")
        ? asset.src.slice("indexeddb:".length)
        : null);

    if (!storageKey) {
      continue;
    }

    try {
      const savedSrc = await readImportedImage(storageKey);
      if (savedSrc) {
        asset.src = savedSrc;
      }
    } catch (error) {
      console.warn(`Could not restore image data for ${asset.id}.`, error);
    }
  }

  project.assets = project.assetRegistry?.assets || [];
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = window.indexedDB.open(ASSET_IMAGE_DATABASE_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_IMAGE_STORE_NAME)) {
        database.createObjectStore(ASSET_IMAGE_STORE_NAME);
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function storeImportedImage(assetId, src) {
  const database = await openImageDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(ASSET_IMAGE_STORE_NAME).put(src, assetId);
    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

async function readImportedImage(assetId) {
  const database = await openImageDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_IMAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(ASSET_IMAGE_STORE_NAME).get(assetId);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => database.close());
  });
}

function loadBackups() {
  const savedBackups = localStorage.getItem(BACKUP_STORAGE_KEY);

  if (!savedBackups) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedBackups);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Saved backups could not be loaded.", error);
    return [];
  }
}
