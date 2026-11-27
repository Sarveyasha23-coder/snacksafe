import Link from "next/link";

export const metadata = {
  title: "Privacy notice | SnackSafe",
  description: "How the SnackSafe prototype handles product searches and comparison data."
};

export default function PrivacyPage() {
  return (
    <main className="shell" style={{ maxWidth: 820, paddingTop: 48, paddingBottom: 64 }}>
      <Link href="/" className="text-button">← Back to SnackSafe</Link>
      <div className="eyebrow" style={{ marginTop: 28 }}>Legal information</div>
      <h1>Privacy notice</h1>
      <p className="muted">Last updated: 27 November 2026 · Prototype notice; obtain legal review before public commercial launch.</p>

      <h2>What this prototype does</h2>
      <p>SnackSafe lets visitors search food products, look up barcodes, inspect product-label information, and compare up to three products. Product catalogue information is requested from Open Food Facts through SnackSafe's server-side API routes.</p>

      <h2>Information processed</h2>
      <ul>
        <li>Search terms and barcode values are sent to SnackSafe's server and then to Open Food Facts to retrieve matching product records.</li>
        <li>Comparison selections are stored in your current browser's local storage. They are not associated with an account and are not synchronized between devices.</li>
        <li>API infrastructure may process network information, including an IP address, to enforce rate limits and protect the service.</li>
        <li>The current prototype does not provide user accounts or ask visitors to submit health profiles.</li>
      </ul>

      <h2>Third-party product data</h2>
      <p>Product information is supplied by Open Food Facts and may be incomplete, outdated, or incorrect. When you follow an Open Food Facts source link, that service's own privacy terms apply.</p>

      <h2>Storage and retention</h2>
      <p>Comparison data remains in your browser until you remove it or clear browser storage. Server-side cache entries are temporary and expire according to configured cache lifetimes. Operational logs may be retained by the hosting and infrastructure providers under their own policies.</p>

      <h2>Your choices</h2>
      <p>You can clear SnackSafe comparison data by clearing this site's local storage in your browser. Do not submit personal, medical, or sensitive information to this prototype.</p>

      <h2>Children and sensitive information</h2>
      <p>SnackSafe is not designed to collect information from children or to store medical, allergy, or other sensitive health profiles. Do not use the prototype as a substitute for checking food packaging or seeking qualified advice.</p>

      <h2>Contact and legal review</h2>
      <p>This notice is a technical starting point, not jurisdiction-specific legal advice. Before public launch, the operator must add a monitored privacy contact, identify the legal entity and hosting providers, define applicable retention periods, and obtain review under the laws of the markets served.</p>
    </main>
  );
}
