import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-xs text-az-platinum hover:text-az-mulberry transition-colors">
            ← Back to GS-Intersect
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-az-navy mb-1" style={{ fontFamily: "var(--font-heading)" }}>
          Terms of Use
        </h1>
        <p className="text-xs text-az-platinum mb-8">Last updated: July 2026</p>

        <div className="space-y-8 text-sm text-az-graphite leading-relaxed">

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              1. Purpose and Scope
            </h2>
            <p>
              GS-Intersect is a research and educational tool designed to assist qualified
              statisticians and clinical researchers in exploring optimal power selection for
              group sequential, Simon 2-stage, paired, and two-arm clinical trial designs.
              It is provided solely for internal research and exploratory use.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              2. Not a Substitute for Professional Statistical Advice
            </h2>
            <p>
              The outputs produced by this tool — including optimal sample sizes, power
              estimates, critical values, and utility scores — are intended as a starting
              point for discussion and exploration only. They are <strong>not</strong> a
              substitute for review and validation by a qualified biostatistician, and are{" "}
              <strong>not</strong> intended for direct submission to any regulatory body
              (including but not limited to the FDA, EMA, or MHRA) without independent
              verification.
            </p>
            <p className="mt-2">
              Users are solely responsible for verifying all outputs against appropriate
              statistical reference material and applicable regulatory guidance before
              applying them to any clinical programme.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              3. No Warranty
            </h2>
            <p>
              This tool is provided <strong>&ldquo;as is&rdquo;</strong> without warranty
              of any kind, express or implied, including but not limited to warranties of
              merchantability, fitness for a particular purpose, or non-infringement. The
              authors make no representations regarding the accuracy, completeness, or
              suitability of the results for any specific use case.
            </p>
            <p className="mt-2">
              Computational results depend on third-party R packages (including{" "}
              <span className="font-mono text-xs">gsDesign</span>,{" "}
              <span className="font-mono text-xs">clinfun</span>, and their dependencies),
              which are subject to their own licences and may contain errors or
              approximations.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              4. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by applicable law, the authors and
              contributors of GS-Intersect shall not be liable for any direct, indirect,
              incidental, consequential, or punitive damages arising from the use of, or
              inability to use, this tool — including but not limited to losses arising
              from reliance on any output for clinical, regulatory, or commercial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              5. Third-Party Software
            </h2>
            <p>
              GS-Intersect relies on open-source software including R, the{" "}
              <span className="font-mono text-xs">gsDesign</span> package (GPL-3), and the{" "}
              <span className="font-mono text-xs">clinfun</span> package (GPL). Use of this
              tool implies acceptance of those licences.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              6. Changes to These Terms
            </h2>
            <p>
              These terms may be updated at any time without notice. Continued use of the
              tool following any change constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-az-navy mb-2" style={{ fontFamily: "var(--font-heading)" }}>
              7. Contact
            </h2>
            <p>
              Questions regarding these terms may be directed to the tool maintainers via
              the{" "}
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
