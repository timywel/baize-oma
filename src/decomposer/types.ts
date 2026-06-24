// TODO(M3): OMADag / OMANode / OMAEdge 类型定义
// 当前: 占位骨架
export interface OMANode { id: string; title: string; description: string; agentRole: 'researcher' | 'architect' | 'coder' | 'reviewer' | 'generic'; dependsOn: string[]; }
export interface OMAEdge { from: string; to: string; }
export interface OMADag { nodes: OMANode[]; edges: OMAEdge[]; }
export interface DecomposeMeta { teamId: string; decomposedAt: string; decomposerModel: string; durationMs: number; }
export interface DecomposeOptions { depth?: number; maxDepth?: number; minNodes?: number; maxNodes?: number; }
