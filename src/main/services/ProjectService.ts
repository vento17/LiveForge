import { readFile, writeFile } from 'fs/promises';
import type { Project } from '../../shared/types/project';
import { SCHEMA_VERSION } from '../../shared/constants';

export class ProjectService {
  async write(filePath: string, project: Project): Promise<void> {
    const json = JSON.stringify(project, null, 2);
    await writeFile(filePath, json, 'utf-8');
  }

  async read(filePath: string): Promise<Project | null> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as Project;
      if (data.schemaVersion !== SCHEMA_VERSION) {
        console.warn(`Schema version mismatch: expected ${SCHEMA_VERSION}, got ${data.schemaVersion}`);
      }
      return data;
    } catch (err) {
      console.error('Failed to load project:', err);
      return null;
    }
  }
}
