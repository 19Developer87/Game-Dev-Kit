import { BACKUP_STORAGE_KEY, STORAGE_KEY } from "./EditorTypes.js";
import { createStarterProject, normalizeProject } from "./LevelManager.js";

export function loadProject() {
  const savedProject = localStorage.getItem(STORAGE_KEY);

  if (!savedProject) {
    return {
      project: createStarterProject(),
      source: "new",
      message: "Created a new empty Starter Level.",
    };
  }

  try {
    return {
      project: normalizeProject(JSON.parse(savedProject)),
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

export function saveProject(project) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
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
