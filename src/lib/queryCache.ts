type CacheEntry<T>={value?:T;expiresAt:number;promise?:Promise<T>}
const cache=new Map<string,CacheEntry<unknown>>()
const DEFAULT_TTL_MS=5*60*1000

export async function cachedQuery<T>(key:string,fetcher:()=>Promise<T>,ttlMs=DEFAULT_TTL_MS):Promise<T>{
  const now=Date.now()
  const existing=cache.get(key) as CacheEntry<T>|undefined
  if(existing?.value!==undefined&&existing.expiresAt>now)return existing.value
  if(existing?.promise)return existing.promise
  const promise=fetcher().then(value=>{cache.set(key,{value,expiresAt:Date.now()+ttlMs});return value}).catch(error=>{cache.delete(key);throw error})
  cache.set(key,{...existing,expiresAt:existing?.expiresAt??0,promise})
  return promise
}

export function invalidateQuery(prefix:string){for(const key of cache.keys())if(key===prefix||key.startsWith(`${prefix}:`))cache.delete(key)}
export function clearQueryCache(){cache.clear()}
