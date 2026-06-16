import { FSWorkspaceRepository } from './secondary/fs/FSWorkspaceRepository';
import { ProcessAgentRunner } from './secondary/agent/ProcessAgentRunner';
import { WorkflowService } from '../domain/services/WorkflowService';

const workspaceRepo = new FSWorkspaceRepository();
const agentRunner = new ProcessAgentRunner();

export const workflowService = new WorkflowService(workspaceRepo, agentRunner);
