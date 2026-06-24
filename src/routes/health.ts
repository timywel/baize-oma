// TODO: /health 路由拆出 (现有 inline, 后续可独立维护)
export const healthHandler = () => ({ status: 'healthy', last_check_at: new Date().toISOString(), latency_ms: 0 });
