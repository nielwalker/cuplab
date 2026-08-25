import { Link } from 'react-router-dom'
export function NotFoundPage(){return <main className="grid min-h-screen place-items-center text-center"><div><h1 className="text-4xl font-bold">Page not found</h1><Link to="/pos" className="mt-4 inline-block text-brand-600">Return to POS</Link></div></main>}
