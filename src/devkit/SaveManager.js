import { STORAGE_KEY } from "./EditorTypes.js";
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
