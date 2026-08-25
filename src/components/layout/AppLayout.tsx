import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ConnectionBadge } from '../ui/ConnectionBadge'
export function AppLayout(){return <div className="flex h-screen overflow-hidden"><Sidebar/><main className="h-screen min-w-0 flex-1 overflow-y-auto"><div className="fixed right-4 top-4 z-20"><ConnectionBadge/></div><Outlet/></main></div>}
