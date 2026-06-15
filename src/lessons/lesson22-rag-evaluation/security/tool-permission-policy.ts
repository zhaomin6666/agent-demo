import type { ToolCall } from "../executor/tool-executor.js";
import type {
  ToolPermissionDecision,
  UserContext,
  UserRole,
} from "../graph/agent-state.js";

type ToolPermissionConfig = {
  requiredRoles: UserRole[];
  description: string;
};

const TOOL_PERMISSION_CONFIG: Record<string, ToolPermissionConfig> = {
  search_knowledge_base: {
    requiredRoles: ["viewer", "support", "admin"],
    description: "查询知识库，所有已登录用户都可以使用。",
  },
  create_ticket: {
    requiredRoles: ["support", "admin"],
    description: "创建工单，需要客服或管理员角色。",
  },
};

export function checkToolPermission(params: {
  toolCall: ToolCall;
  userContext: UserContext | null;
}): ToolPermissionDecision {
  const config = TOOL_PERMISSION_CONFIG[params.toolCall.name];
  if (!params.userContext) {
    return {
      allowed: false,
      toolName: params.toolCall.name,
      requiredRoles: config.requiredRoles,
      userRoles: [],
      reason: "当前请求缺少用户上下文，无法执行工具。",
    };
  }
  if (!config) {
    return {
      allowed: false,
      toolName: params.toolCall.name,
      requiredRoles: [],
      userRoles: params.userContext.roles,
      reason: `工具 ${params.toolCall.name} 未配置权限策略，默认拒绝执行。`,
    };
  }
  const allowed = config.requiredRoles.some((role) =>
    params.userContext?.roles.includes(role)
  );

  return {
    allowed: allowed,
    toolName: params.toolCall.name,
    requiredRoles: config.requiredRoles,
    userRoles: params.userContext.roles,
    reason: allowed
      ? `用户具备执行工具 ${params.toolCall.name} 的权限。`
      : `用户缺少执行工具 ${params.toolCall.name} 所需角色：${config.requiredRoles.join(
          ", ",
        )}`,
  };
}

export function findFirstDeniedToolPermission(params: {
  toolCalls: ToolCall[];
  userContext: UserContext | null;
}): ToolPermissionDecision | null {
  for (const toolCall of params.toolCalls) {
    const decision = checkToolPermission({
      toolCall,
      userContext: params.userContext,
    });

    if (!decision.allowed) {
      return decision;
    }
  }

  return null;
}