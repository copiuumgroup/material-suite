import { db, type ProjectMetadata } from '../db/database';

/**
 * Persistence Service
 * Handles background auto-saving and preloading logic.
 */

let autoSaveTimer: any = null;

/**
 * Persists the current project state to the database.
 */
export async function saveProject(project: ProjectMetadata) {
  if (!project.id) return;
  
  try {
    await db.projects.update(project.id, {
      ...project,
      lastModified: Date.now()
    });
    console.log(`[AutoSave] Project ${project.id} persisted.`);
  } catch (error) {
    console.error('[Persistence] Failed to save project:', error);
  }
}

/**
 * Starts the auto-save loop.
 */
export function startAutoSave(getProject: () => ProjectMetadata | null, intervalMs = 30000) {
  if (autoSaveTimer) stopAutoSave();
  
  autoSaveTimer = setInterval(async () => {
    const project = getProject();
    if (project) {
      await saveProject(project);
    }
  }, intervalMs);
}

/**
 * Stops the auto-save loop.
 */
export function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/**
 * Preloads an audio file into the browser cache.
 * Useful for "gapless" transitions in the tool suite.
 */
export async function preloadAudio(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    // Just by fetching, the browser (or Electron) will likely cache it if served correctly.
    // For more robust preloading, we could decode it into an AudioBuffer and hold it in a Ref.
  } catch (error) {
    console.warn(`[Persistence] Preload failed for ${url}:`, error);
  }
}
