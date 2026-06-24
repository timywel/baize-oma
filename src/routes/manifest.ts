// TODO: /manifest 路由拆出 (现有 inline)
import slotJson from '../../slot.json' with { type: 'json' };
export const manifestHandler = () => slotJson;
