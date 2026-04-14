import MainTable from './components/MainTable/MainTable';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">ConferenceFinder</h1>
        <p className="text-xs text-slate-500">열유체·건물공조 학회 DB</p>
      </header>
      <main className="p-4">
        <MainTable />
      </main>
    </div>
  );
}

export default App;
