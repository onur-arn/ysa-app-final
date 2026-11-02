import { redirect } from "next/navigation"
import { Logo } from "@/components/logo"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata = { title: "Configuration" }

const STEPS = [
  {
    title: "Créer un projet Supabase",
    body: (
      <>
        Sur <a className="font-semibold text-primary" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com/dashboard</a>, crée un projet (gratuit).
      </>
    ),
  },
  {
    title: "Créer les tables",
    body: (
      <>
        Dans <b>SQL Editor</b>, colle tout le contenu de <code>supabase/schema.sql</code> puis clique sur <b>Run</b>.
      </>
    ),
  },
  {
    title: "Renseigner les clés",
    body: (
      <>
        Dans <b>Project Settings → API</b>, copie l&apos;URL et les clés dans un fichier <code>.env.local</code> à la racine du projet :
        <pre className="mt-2 overflow-x-auto rounded-xl bg-secondary p-3 text-xs leading-relaxed text-foreground">
{`NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon / publishable>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role / secret>
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
        </pre>
      </>
    ),
  },
  {
    title: "Autoriser la redirection",
    body: (
      <>
        Dans <b>Authentication → URL Configuration</b>, ajoute <code>http://localhost:3000/auth/callback</code> aux <i>Redirect URLs</i>.
      </>
    ),
  },
  {
    title: "Redémarrer",
    body: (
      <>
        Arrête <code>npm run dev</code> (Ctrl+C) et relance-le : les variables ne sont lues qu&apos;au démarrage. Le premier compte créé devient administrateur.
      </>
    ),
  },
]

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/auth/login")
  return (
    <main className="flex min-h-dvh justify-center bg-background px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-foreground">Configuration requise</h1>
          <p className="mt-1 text-sm text-muted-foreground">L&apos;application doit être reliée à Supabase avant de démarrer.</p>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 font-bold text-primary">{i + 1}</span>
              <div className="min-w-0">
                <p className="mb-1 font-semibold text-foreground">{s.title}</p>
                {s.body}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  )
}
