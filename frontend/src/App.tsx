function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#e8edf5)] px-4 py-10 sm:px-6 lg:px-10">
      <main className="mx-auto max-w-5xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Household Asset and Commitment Tracker
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Frontend runtime baseline is ready</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            This workspace now provides the React + Vite + TypeScript entrypoint and styling
            primitives for the upcoming shell, providers, routing, and bilingual UI plans.
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border bg-background p-4">
            <h2 className="text-sm font-medium">Shell</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sidebar navigation and header scaffolding.</p>
          </article>
          <article className="rounded-xl border bg-background p-4">
            <h2 className="text-sm font-medium">Providers</h2>
            <p className="mt-2 text-sm text-muted-foreground">Query, i18n, and app-level context mounting.</p>
          </article>
          <article className="rounded-xl border bg-background p-4">
            <h2 className="text-sm font-medium">Routing</h2>
            <p className="mt-2 text-sm text-muted-foreground">Dashboard, items, and events route orchestration.</p>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App
