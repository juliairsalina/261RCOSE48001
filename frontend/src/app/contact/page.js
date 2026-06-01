export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#d7d8cd] px-6 py-10 text-[#2f332d]">
      <h1 className="text-4xl font-bold">Our Team</h1>

      <p className="mt-3 text-lg">
        Meet the PowerPuffGirls behind Reeracify.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Mushira</h2>
          <p className="mt-2">Frontend / Resume AI</p>
        </div>

        <div className="rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Emira</h2>
          <p className="mt-2">Backend / Database</p>
        </div>

        <div className="rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Julia</h2>
          <p className="mt-2">AI Evaluation Agent</p>
        </div>
      </div>
    </main>
  );
}