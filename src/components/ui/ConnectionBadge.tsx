import { Wifi,WifiOff,RefreshCw } from 'lucide-react'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
export function ConnectionBadge(){const status=useConnectionStatus();const Icon=status==='ONLINE'?Wifi:status==='OFFLINE'?WifiOff:RefreshCw;return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${status==='ONLINE'?'bg-emerald-100 text-emerald-800':status==='OFFLINE'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}><Icon size={13} className={status==='RECONNECTING'?'animate-spin':''}/>{status}</span>}
