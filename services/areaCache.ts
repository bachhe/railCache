export const areaCache = new Map<string, any[]>();

export function setAreaCache(name: string, trains: any[]) {
  areaCache.set(name, trains);
}

export function getAreaCache(name: string) {
  return areaCache.get(name) ?? [];
}
