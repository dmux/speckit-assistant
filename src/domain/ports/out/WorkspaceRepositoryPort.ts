import { WorkflowState } from '../../models/types';

export interface WorkspaceRepositoryPort {
  getWorkflowState(workspacePath: string): Promise<WorkflowState>;
  saveWorkflowState(workspacePath: string, state: WorkflowState): Promise<void>;
  toggleTask(workspacePath: string, featureName: string, lineIndex: number, checked: boolean): Promise<WorkflowState>;
  createFeature(workspacePath: string, name: string): Promise<WorkflowState>;
  deleteFeature(workspacePath: string, name: string): Promise<WorkflowState>;
  readFile(workspacePath: string, filePath: string): Promise<string>;
  writeFile(workspacePath: string, filePath: string, content: string): Promise<void>;
}
