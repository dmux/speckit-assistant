import { FSWorkspaceRepository } from './secondary/fs/FSWorkspaceRepository';
import { ProcessAgentRunner } from './secondary/agent/ProcessAgentRunner';
import { FSAgentRepository } from './secondary/fs/FSAgentRepository';
import { FSMcpConfig } from './secondary/fs/FSMcpConfig';
import { FSSpecAgentRepository } from './secondary/fs/FSSpecAgentRepository';
import { FSExtensionRepository } from './secondary/fs/FSExtensionRepository';
import { ProcessSpecifyRunner } from './secondary/cli/ProcessSpecifyRunner';
import { WorkflowService } from '../domain/services/WorkflowService';

const workspaceRepo = new FSWorkspaceRepository();
const agentRunner = new ProcessAgentRunner();

export const workflowService = new WorkflowService(workspaceRepo, agentRunner);
export const agentRepository = new FSAgentRepository();
export const mcpConfig = new FSMcpConfig();
export const specAgentRepository = new FSSpecAgentRepository();
export const extensionRepository = new FSExtensionRepository();
export const specifyCli = new ProcessSpecifyRunner();
