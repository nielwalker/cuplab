import type { IcePriceTier } from '../types/database'
export function findIceTier(weightKg:number,tiers:IcePriceTier[]) { if(!Number.isFinite(weightKg)||weightKg<=0)return null; return tiers.find(t=>t.is_active&&weightKg>=t.min_kg&&weightKg<=t.max_kg)??null }
export function calculateIceTotal(weightKg:number,pricePerKgCentavos:number) { if(!Number.isFinite(weightKg)||weightKg<=0||!Number.isInteger(pricePerKgCentavos)||pricePerKgCentavos<0)throw new Error('Invalid ICE price'); return Math.round(weightKg*pricePerKgCentavos) }
