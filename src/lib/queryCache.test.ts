import { beforeEach,describe,expect,it,vi } from 'vitest'
import { cachedQuery,clearQueryCache,invalidateQuery } from './queryCache'

describe('query cache',()=>{
  beforeEach(clearQueryCache)

  it('reuses cached values across consumers',async()=>{
    const fetcher=vi.fn(async()=>['coffee'])
    expect(await cachedQuery('products',fetcher)).toEqual(['coffee'])
    expect(await cachedQuery('products',fetcher)).toEqual(['coffee'])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('deduplicates simultaneous requests',async()=>{
    const fetcher=vi.fn(async()=>['ice'])
    await Promise.all([cachedQuery('tiers',fetcher),cachedQuery('tiers',fetcher)])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refetches after targeted invalidation',async()=>{
    const fetcher=vi.fn(async()=>fetcher.mock.calls.length)
    expect(await cachedQuery('products:active',fetcher)).toBe(1)
    invalidateQuery('products')
    expect(await cachedQuery('products:active',fetcher)).toBe(2)
  })
})
