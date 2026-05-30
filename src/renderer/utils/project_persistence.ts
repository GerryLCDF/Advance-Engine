const api = () => window.advanceAPI;
const PROJECTS_DIR = 'AdvanceEngineProjects';

export interface EditorState {
  scenes: any[];
  sceneConnections: any[];
  backgrounds: any[];
  sprites: any[];
  songs: any[];
  sounds: any[];
  dialogues: any[];
  scripts: any[];
}

export async function saveProject(projectId: string, name: string, state: EditorState): Promise<string | null> {
  const result = await api().project.save(projectId, { name, state });
  if (!result.success) {
    console.error('Error saving project:', result.reason);
    return null;
  }
  return result.path ?? null;
}

export async function loadProject(projectPath: string): Promise<{ manifest: any; state: EditorState } | null> {
  const result = await api().project.load(projectPath);
  if (!result.success) {
    console.error('Error loading project:', result.reason);
    return null;
  }
  return { manifest: result.manifest, state: result.state ?? { scenes: [], sceneConnections: [], backgrounds: [], sprites: [], songs: [], sounds: [], dialogues: [], scripts: [] } };
}

export async function saveAsset(projectDir: string, assetType: string, assetId: string, data: any): Promise<boolean> {
  const dir = `${projectDir}/${assetType}`;
  await api().dir.create(dir);
  const result = await api().file.writeText(`${dir}/${assetId}.json`, JSON.stringify(data, null, 2));
  return result.success;
}

export async function loadAsset(projectDir: string, assetType: string, assetId: string): Promise<any | null> {
  const result = await api().file.readText(`${projectDir}/${assetType}/${assetId}.json`);
  if (!result.success) return null;
  try { return JSON.parse(result.data!); } catch { return null; }
}

export async function copyImageToProject(srcPath: string, projectDir: string, assetType: string, fileName: string): Promise<string | null> {
  const destDir = `${projectDir}/${assetType}`;
  await api().dir.create(destDir);
  const destPath = `${destDir}/${fileName}`;
  const result = await api().file.copy(srcPath, destPath);
  return result.success ? destPath : null;
}

export async function readImageAsDataUrl(filePath: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const result = await api().file.readImage(filePath);
  if (!result.success) return null;
  return { dataUrl: result.dataUrl!, width: result.width!, height: result.height! };
}
