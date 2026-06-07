export default function ContactPage() {
  return (
      <main
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      }}
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_8%,rgba(144,171,188,0.95)_0%,rgba(95,126,137,0.72)_22%,transparent_42%),radial-gradient(circle_at_72%_22%,rgba(184,190,137,0.72)_0%,rgba(118,137,92,0.58)_30%,transparent_56%),radial-gradient(circle_at_35%_88%,rgba(38,82,61,0.95)_0%,rgba(43,74,55,0.88)_35%,transparent_62%),linear-gradient(135deg,#425f6f_0%,#536f66_28%,#69794e_55%,#263f33_100%)] text-white"
    >
      
      <h1 className="mt-4 ml-4 text-4xl font-bold">Our Team</h1>

      <p className="mt-4 ml-4 text-lg">
        Meet the PowerPuffGirls behind Reeracify.
      </p>

      <div className="mt-8 ml-4 grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Mushira</h2>
          <p className="mt-2">Frontend / Resume AI</p>
          <p className="mt-1">mushira@gmail.com</p>
        </div>

        <div className="rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Emira</h2>
          <p className="mt-2">Backend / Database</p>
          <p className="mt-1">emirasyazwani1@gmail.com</p>
        </div>

        <div className="mr-4 rounded-3xl bg-white/50 p-6 shadow-lg">
          <h2 className="text-xl font-bold">Julia</h2>
          <p className="mt-2">AI Evaluation Agent</p>
          <p className="mt-1">juliairsalinasani@gmail.com</p>
        </div>
      </div>
    </main>
  );
}