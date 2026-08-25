import { describe,expect,it } from 'vitest'
import type { IcePriceTier } from '../types/database'
import { calculateCartTotal,calculateNormalLineTotal,formatMoney,pesosToCentavos } from './money'
import { calculateIceTotal,findIceTier } from './icePricing'
import { authGuardDestination,canAddProduct,canCompleteOrder } from './orderRules'
import { usernameToAuthEmail } from './auth'
const tiers:IcePriceTier[]=[{id:'1',min_kg:1,max_kg:9,price_per_kg_centavos:1500,is_active:true},{id:'2',min_kg:20,max_kg:29,price_per_kg_centavos:1300,is_active:true}]
describe('money',()=>{it('converts and formats integer centavos',()=>{expect(pesosToCentavos('80.00')).toBe(8000);expect(formatMoney(8000)).toContain('80.00')});it('rejects excessive precision',()=>expect(()=>pesosToCentavos('1.005')).toThrow());it('calculates cart and normal lines',()=>{expect(calculateNormalLineTotal(8000,2)).toBe(16000);expect(calculateCartTotal([{line_total_centavos:16000},{line_total_centavos:3000}])).toBe(19000)})})
describe('ICE pricing',()=>{it('finds known tiers and calculates totals',()=>{expect(findIceTier(8,tiers)?.price_per_kg_centavos).toBe(1500);expect(calculateIceTotal(25,1300)).toBe(32500)});it('returns no tier for gaps',()=>expect(findIceTier(12,tiers)).toBeNull())})
describe('business guards',()=>{it('blocks unavailable products',()=>expect(canAddProduct({is_active:true,is_available:false})).toBe(false));it('protects completed orders from completion',()=>expect(canCompleteOrder('COMPLETED',2)).toBe(false));it('requires authentication for private routes',()=>{expect(authGuardDestination(false,'/products')).toBe('/login');expect(authGuardDestination(true,'/products')).toBe('/products')})})
describe('username login',()=>{it('maps normalized usernames to the private auth alias',()=>expect(usernameToAuthEmail(' Admin ')).toBe('admin@coffee-shop.local'));it('rejects malformed usernames',()=>expect(()=>usernameToAuthEmail('a@b')).toThrow())})
