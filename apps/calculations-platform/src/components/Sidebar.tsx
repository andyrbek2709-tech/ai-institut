export default function Sidebar() {
  return (
    <aside className="w-64 bg-brand-700 text-white p-6">
      <div className="mb-12">
        <h1 className="text-2xl font-bold">EnGHub</h1>
        <p className="text-brand-50 text-sm mt-1">Calculation Platform</p>
      </div>

      <nav className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-brand-100 uppercase tracking-wider">Platform</h3>
          <a href="#" className="block px-4 py-2 rounded bg-brand-600 hover:bg-brand-500 transition">
            Calculate
          </a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-brand-600 transition">
            Templates
          </a>
          <a href="#" className="block px-4 py-2 rounded hover:bg-brand-600 transition">
            History
          </a>
        </div>
      </nav>

      <div className="mt-12 pt-6 border-t border-brand-600">
        <p className="text-xs text-brand-100">
          Foundation Phase v0.1.0
        </p>
      </div>
    </aside>
  )
}
