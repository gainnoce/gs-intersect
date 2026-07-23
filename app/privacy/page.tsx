import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-xs text-az-platinum hover:text-az-mulberry transition-colors">
            ← Back to GS-Intersect
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-az-navy mb-1" style={{ fontFamily: "var(--font-heading)" }}>
          Privacy Policy
        </h1>
        <p className="text-xs text-az-platinum mb-8">Last updated: July 2026</p>

        <div className="space-y-8 text-sm text-az-graphite leading-relaxed">

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              1. Overview
            </h2>
            <p>
              GS-Intersect is a clinical trial design tool. This policy explains what
              information is processed when you use the tool, and how it is handled.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              2. Data We Process
            </h2>
            <p>
              When you run an optimisation, the numerical design parameters you enter
              (such as hazard ratios, response rates, sample size ranges, and error bounds)
              are transmitted to a server-side API for computation. These are purely
              statistical inputs; <strong>no personal data</strong>, patient data, or
              identifiable information is requested or required by the tool.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              3. Data Retention
            </h2>
            <p>
              GS-Intersect does not store or log the design parameters you submit.
              Computation requests are processed in memory and discarded immediately after
              a response is returned.
            </p>
            <p className="mt-2">
              Standard server and hosting infrastructure (Render, Vercel) may retain
              anonymised request metadata (such as IP address, request timestamp, and HTTP
              status codes) for a limited period for security and operational monitoring
              purposes, in accordance with those providers&apos; own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              4. Cookies and Tracking
            </h2>
            <p>
              GS-Intersect does not use cookies, analytics trackers, or any
              client-side tracking technology. No browsing behaviour or usage data is
              collected.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              5. Third-Party Services
            </h2>
            <p>
              The tool is hosted on <strong>Vercel</strong> (frontend) and{" "}
              <strong>Render</strong> (computation API). These providers may process
              connection-level data as described in their respective privacy policies:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-az-graphite">
              <li>
                <a href="https://vercel.com/legal/privacy-policy" className="text-az-mulberry hover:underline" target="_blank" rel="noopener noreferrer">
                  Vercel Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://render.com/privacy" className="text-az-mulberry hover:underline" target="_blank" rel="noopener noreferrer">
                  Render Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              6. Your Rights
            </h2>
            <p>
              Because GS-Intersect does not collect or store personal data, there is
              no personal data held about you to access, correct, or delete. If you have
              questions about data handling by the underlying hosting providers, please
              refer to their policies linked above.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              7. Changes to This Policy
            </h2>
            <p>
              This policy may be updated at any time. The &ldquo;last updated&rdquo; date
              at the top of this page reflects when the policy was most recently revised.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              8. Contact
            </h2>
            <p>
              Questions about this policy may be directed to the tool maintainers via the{" "}
              <a
                href="https://github.com/gainnoce/gs-intersect"
                className="text-az-mulberry hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                project repository
              </a>
              .
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
