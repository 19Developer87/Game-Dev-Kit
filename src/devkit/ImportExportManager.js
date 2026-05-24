export function exportJson(filename, data) {
  const json = JSON.stringify(data, null, 2);
  downloadJson(filename, json);
}

export async function saveJsonAs(filename, data) {
  const json = JSON.stringify(data, null, 2);

  if (typeof window.showSaveFilePicker !== "function") {
    tryDownloadJson(filename, json);
    return {
      fallback: true,
      filename,
    };
  }

  try {
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "JSON files",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });

    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();

    return {
      fallback: false,
      filename: fileHandle.name || filename,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    tryDownloadJson(filename, json);
    return {
      fallback: true,
      filename,
    };
  }
}

export async function copyJsonToClipboard(data) {
  const json = JSON.stringify(data, null, 2);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json);
      return;
    } catch (error) {
      console.warn("Clipboard API was unavailable, using text selection fallback.", error);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = json;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy command was not accepted by the browser.");
  }
}

export async function chooseProjectFolder() {
  if (typeof window.showDirectoryPicker !== "function") {
    return null;
  }

  return window.showDirectoryPicker({
    id: "game-dev-kit-root",
    mode: "readwrite",
  });
}

export async function saveProjectFilesToFolder({
  folderHandle,
  projectIndex,
  levels,
  deletedLevelFilenames = [],
}) {
  const projectFolder = await folderHandle.getDirectoryHandle("project", { create: true });
  const levelsFolder = await folderHandle.getDirectoryHandle("levels", { create: true });
  await folderHandle.getDirectoryHandle("assets", { create: true });

  await writeJsonFile(projectFolder, "game-dev-kit-project.json", projectIndex);

  for (const level of levels) {
    await writeJsonFile(levelsFolder, level.filename, level.data);
  }

  for (const filename of deletedLevelFilenames) {
    try {
      await levelsFolder.removeEntry(filename);
    } catch (error) {
      console.warn(`Could not remove deleted level file: ${filename}`, error);
    }
  }
}

export function downloadProjectFiles({ projectIndex, levels }) {
  tryDownloadJson("game-dev-kit-project.json", JSON.stringify(projectIndex, null, 2));

  levels.forEach((level) => {
    tryDownloadJson(level.filename, JSON.stringify(level.data, null, 2));
  });
}

export function createLevelExportName(level) {
  return `${slugify(level.name || level.id)}.json`;
}

export function createLevelSaveAsName(level) {
  return `current-level-${slugify(level.name || level.id)}.json`;
}

function downloadJson(filename, json) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function tryDownloadJson(filename, json) {
  try {
    downloadJson(filename, json);
  } catch (error) {
    console.warn("Browser download fallback could not be completed.", error);
  }
}

async function writeJsonFile(directoryHandle, filename, data) {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "level";
}
