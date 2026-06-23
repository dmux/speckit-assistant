import { FSWorkspaceRepository } from './secondary/fs/FSWorkspaceRepository';
import { ProcessAgentRunner } from './secondary/agent/ProcessAgentRunner';
import { FSAgentRepository } from './secondary/fs/FSAgentRepository';
import { FSMcpConfig } from './secondary/fs/FSMcpConfig';
import { FSSpecAgentRepository } from './secondary/fs/FSSpecAgentRepository';
import { FSDevOpsAgentRepository } from './secondary/fs/FSDevOpsAgentRepository';
import { FSExtensionRepository } from './secondary/fs/FSExtensionRepository';
import { FSExecutionHistory } from './secondary/fs/FSExecutionHistory';
import { ProcessSpecifyRunner } from './secondary/cli/ProcessSpecifyRunner';
import { WorkflowService } from '../domain/services/WorkflowService';

const workspaceRepo = new FSWorkspaceRepository();
const agentRunner = new ProcessAgentRunner();

export const executionHistory = new FSExecutionHistory();
export const workflowService = new WorkflowService(workspaceRepo, agentRunner, executionHistory);
export const agentRepository = new FSAgentRepository();
export const mcpConfig = new FSMcpConfig();
export const specAgentRepository = new FSSpecAgentRepository();
export const devopsAgentRepository = new FSDevOpsAgentRepository();
export const extensionRepository = new FSExtensionRepository();
export const specifyCli = new ProcessSpecifyRunner();
