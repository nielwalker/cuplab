import { BarChart3,LogOut,Package,Settings,Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

const sections=[
  {to:'/products',label:'Manage Products',icon:Package},
  {to:'/settings',label:'Settings',icon:Settings},
  {to:'/staff',label:'Staff & Attendance',icon:Users},
  {to:'/sales',label:'Sales',icon:BarChart3}
]

export function AdminPage(){const {signOut}=useAuth();return <div className="flex min-h-full flex-col p-4 pt-16 lg:p-8"><header className="mb-7"><p className="text-sm font-bold uppercase tracking-wider text-brand-600">CUP LAB</p><h1 className="text-3xl font-bold">Admin settings</h1><p className="mt-1 text-stone-500">Choose an administrative section.</p></header><div className="grid max-w-3xl gap-5 md:grid-cols-2">{sections.map(({to,label,icon:Icon})=><Link key={to} to={to} className="group rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"><span className="mb-5 inline-flex rounded-xl bg-brand-100 p-3 text-brand-600"><Icon size={26}/></span><h2 className="text-xl font-bold group-hover:text-brand-600">{label}</h2></Link>)}</div><button onClick={signOut} className="mt-auto flex w-fit items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-600 hover:bg-red-50"><LogOut size={18}/>Logout</button></div>}
