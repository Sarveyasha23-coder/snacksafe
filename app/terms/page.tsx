export const metadata = {
  title: "Terms of use | SnackSafe",
  description: "Terms and important limitations for using the SnackSafe prototype."
};

export default function TermsPage() {
  return (
    <main className="shell" style={{ maxWidth: 820, paddingTop: 48, paddingBottom: 64 }}>
      <a href="/" className="text-button">← Back to SnackSafe</a>
      <div className="eyebrow" style={{ marginTop: 28 }}>Legal information</div>
      <h1>Terms of use</h1>
      <p className="muted">Last updated: 27 November 2026 · Prototype terms; obtain legal review before commercial launch.</p>

      <h2>Informational use only</h2>
      <p>SnackSafe is an experimental food-label information tool. Its nutrition indicator, ingredient observations, and suggested alternatives are educational prototypes. They are not medical advice, diagnosis, treatment, an official FSSAI rating, or a guarantee that a food is safe or suitable for any person.</p>

      <h2>Always verify the physical package</h2>
      <p>Product records are community-contributed and may be missing, inaccurate, or out of date. Formulations and manufacturing facilities can change. Always read the current package, including ingredient lists, allergen declarations, cross-contact warnings, and local regulatory labels. If you have a food allergy or medical dietary requirement, consult an appropriately qualified professional and the manufacturer where necessary.</p>

      <h2>Third-party data</h2>
      <p>Product information is retrieved from Open Food Facts. SnackSafe does not manufacture, test, certify, or independently verify the products listed. Third-party services are subject to their own terms and availability.</p>

      <h2>Acceptable use</h2>
      <p>Do not misuse the service, attempt to disrupt it, bypass rate limits, probe systems without authorization, or submit unlawful content. Automated access must respect applicable service limits and third-party data terms.</p>

      <h2>Availability and changes</h2>
      <p>The prototype is provided on an as-available basis. Features, data sources, and availability may change. No service-level commitment is made by this prototype notice.</p>

      <h2>Contact and governing terms</h2>
      <p>The operator must add a real support contact, legal entity details, and jurisdiction-specific provisions before public commercial use. This page is not a substitute for legal advice or a complete consumer contract.</p>
    </main>
  );
}
