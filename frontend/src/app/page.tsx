/**
 * Root landing page — ZivaBI.
 *
 * Milestone 1 placeholder. This page confirms the frontend is deployed and
 * reachable. It will be replaced by the actual marketing / login landing page
 * in Milestone 2 once authentication is built.
 *
 * Server Component (no "use client") — rendered at build time on Render.
 */

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">ZivaBI</h1>
        <p className="mt-4 text-lg text-gray-500">
          Intelligent Finance &amp; Operations Automation
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Foundation deployed — authentication coming next.
        </p>
      </div>
    </main>
  );
}
