"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { demos, inspectIngredients, SnackProduct } from "@/lib/products";
import { scoreNutrition } from "@/lib/scoring";
import { buildComparisonRows, comparisonScore, isStoredSnackProduct } from "@/lib/comparison";

function concernClass(score: number | null) {
  if (score === null) return "pill unknown";
  return score <= 40 ? "pill good" : "pill";
}

function alternatives(product: SnackProduct) {
  const category = (product.category || product.name).toLowerCase();
  if (category.includes("biscuit") || category.includes("cookie") || category.includes("sweet")) {
    return ["Fresh fruit", "Plain yoghurt", "Unsalted nuts"];
  }
  if (category.includes("chip") || category.includes("potato") || category.includes("namkeen")) {
    return ["Roasted makhana", "Roasted chana", "Plain popcorn"];
  }
  return ["Roasted chana", "Fresh fruit", "Unsalted nuts"];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SnackProduct[]>(demos);
  const [selected, setSelected] = useState<SnackProduct>(demos[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState("");
  const [compareProducts, setCompareProducts] = useState<SnackProduct[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [compareMessage, setCompareMessage] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("snacksafe:compare:v1");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCompareProducts(parsed.filter(isStoredSnackProduct).slice(0, 3));
        }
      }
    } catch {
      // Storage may be unavailable or contain invalid JSON; start with an empty comparison.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem("snacksafe:compare:v1", JSON.stringify(compareProducts));
    } catch {
      setCompareMessage("This browser could not save your comparison. It will remain available until you close this page.");
    }
  }, [compareProducts, storageReady]);

  const analysis = useMemo(() => scoreNutrition(selected.nutrients), [selected]);
  const ingredientFindings = useMemo(() => inspectIngredients(selected), [selected]);
  const comparisonRows = useMemo(() => buildComparisonRows(compareProducts), [compareProducts]);

  const toggleComparison = useCallback((product: SnackProduct) => {
    const alreadyAdded = compareProducts.some(item => item.id === product.id);
    if (alreadyAdded) {
      setCompareProducts(current => current.filter(item => item.id !== product.id));
      setCompareMessage(`${product.name} removed from comparison.`);
      return;
    }
    if (compareProducts.length >= 3) {
      setCompareMessage("Compare up to three products at a time. Remove one before adding another.");
      return;
    }
    setCompareProducts(current => [...current.filter(item => item.id !== product.id), product]);
    setCompareMessage(`${product.name} added to comparison.`);
  }, [compareProducts]);

  const lookupBarcode = useCallback(async (code: string) => {
    setScannerOpen(false);
    setBarcodeBusy(true);
    setBarcodeMessage("");
    setError("");
    try {
      const response = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Barcode lookup failed.");
      setSelected(data.product);
      setProducts(current => [data.product, ...current.filter(product => product.id !== data.product.id)]);
      setSearched(true);
      setBarcodeMessage(`Barcode ${code} identified from Open Food Facts.`);
    } catch (err) {
      setBarcodeMessage(err instanceof Error ? err.message : "Could not look up this barcode.");
    } finally {
      setBarcodeBusy(false);
    }
  }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    setSearched(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");
      if (data.products.length) {
        setProducts(data.products);
        setSelected(data.products[0]);
      } else {
        setProducts(demos);
        setSelected(demos[0]);
        setError("No matching products found. Showing clearly labelled illustrative examples instead.");
      }
    } catch (err) {
      setProducts(demos);
      setSelected(demos[0]);
      setError(err instanceof Error ? err.message : "Could not search right now. Showing illustrative examples.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="nav">
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.2px", color: "#718078", marginBottom: "7px" }}>BUILT BY SARVEYASHA SODHIYA</div>
          <div className="logo">🥬 Snack<span>Safe</span></div>
        </div>
        <div className="navtag">NUTRITION, MADE CLEAR</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">A smarter way to snack</div>
          <h1>Know what’s<br />inside your snack.</h1>
          <p>Search packaged foods, understand their nutrition, and discover everyday alternatives that help you make more informed choices.</p>
          <form className={`searchbox ${busy ? "loading" : ""}`} onSubmit={search}>
            <input aria-label="Search snacks" placeholder="Search chips, biscuits or namkeen…" value={query} onChange={event => setQuery(event.target.value)} />
            <button className="primary" disabled={busy}>{busy ? "Searching…" : "Analyse snack →"}</button>
          </form>
          <div className="scan-actions">
            <button className="secondary" onClick={() => setScannerOpen(true)} disabled={barcodeBusy}>▦ Scan barcode</button>
            {barcodeBusy && <span className="muted">Looking up product…</span>}
            {barcodeMessage && <span className="muted" role="status">{barcodeMessage}</span>}
          </div>
          {error && <div className="error" role="alert">{error}</div>}
        </div>
        <div className="hero-art"><div className="food-circle">🥜</div></div>
      </section>

      <section>
        <div className="sectionhead">
          <div>
            <h2>{searched ? "Search results" : "Explore illustrative examples"}</h2>
            <p>{searched ? "Choose a product to inspect its nutrition." : "Try the demo examples, or search the Open Food Facts catalogue."}</p>
          </div>
          <span className="muted">{products.length} products</span>
        </div>
        <div className="grid">
          {products.map(product => {
            const result = scoreNutrition(product.nutrients);
            const inComparison = compareProducts.some(item => item.id === product.id);
            return (
              <article key={product.id} className={`product ${selected.id === product.id ? "selected-product" : ""}`}>
                <button className="product-main" onClick={() => setSelected(product)} aria-label={`Analyse ${product.name}`}>
                  <div className="producttop">
                    <div className="thumb">{product.image ? <img src={product.image} alt={`${product.name} package`} /> : "🥨"}</div>
                    <div>
                      <h3>{product.name}</h3>
                      <div className="muted">{product.brand}</div>
                      <div className="muted">{product.source}</div>
                    </div>
                  </div>
                  <div className="productbottom">
                    <div>
                      <div className="score">{result.score === null ? "—" : result.score}<small>{result.score === null ? "" : " /100"}</small></div>
                      <div className="muted">{result.score === null ? "Insufficient label data" : "Experimental concern score"}</div>
                    </div>
                    <span className={concernClass(result.score)}>{result.band}</span>
                  </div>
                </button>
                <button className={`compare-toggle ${inComparison ? "active" : ""}`} onClick={() => toggleComparison(product)} aria-pressed={inComparison}>
                  {inComparison ? "✓ Added to compare" : "+ Compare product"}
                </button>
              </article>
            );
          })}
        </div>
      </section>


      <section className="compare-panel" aria-labelledby="compare-title">
        <div className="sectionhead compare-sectionhead">
          <div>
            <div className="eyebrow">Side-by-side nutrition</div>
            <h2 id="compare-title">Compare products <span className="compare-count">{compareProducts.length}/3</span></h2>
            <p>Values are compared per 100 g only. Missing label values are shown as not reported.</p>
          </div>
          {compareProducts.length > 0 && <button className="text-button" onClick={() => { setCompareProducts([]); setCompareMessage("Comparison cleared."); }}>Clear comparison</button>}
        </div>
        {compareMessage && <p className="compare-status" role="status">{compareMessage}</p>}
        {compareProducts.length < 2 ? (
          <div className="compare-empty">
            <strong>{compareProducts.length === 0 ? "Choose two or three snacks to compare." : "Add one more product to see the comparison."}</strong>
            <p>Select “Compare product” on any product card above. Your selection is saved on this device only.</p>
          </div>
        ) : (
          <div className="comparison-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">Nutrition · per 100 g</th>
                  {compareProducts.map(product => (
                    <th scope="col" key={product.id}>
                      <div className="compare-product-heading">
                        <span>{product.name}</span>
                        <small>{product.brand} · {product.source}</small>
                        <button className="remove-compare" onClick={() => toggleComparison(product)} aria-label={`Remove ${product.name} from comparison`}>Remove</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(row => (
                  <tr key={row.key}>
                    <th scope="row">
                      {row.label}
                      <small>{row.note}</small>
                    </th>
                    {compareProducts.map((product, index) => {
                      const value = row.values[index];
                      const leads = row.leadingProductIds.includes(product.id);
                      return (
                        <td key={product.id} className={leads ? "metric-leader" : ""}>
                          {value === undefined ? <span className="not-reported">Not reported</span> : <><strong>{value.toFixed(row.key === "energy" ? 0 : 2)}</strong> <small>{row.unit}</small>{leads && <span className="metric-tag">{row.direction === "lower" ? "Lowest reported" : "Highest reported"}</span>}</>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="score-row">
                  <th scope="row">Experimental concern indicator<small>Prototype score only; not an overall health ranking.</small></th>
                  {compareProducts.map(product => {
                    const score = comparisonScore(product);
                    return <td key={product.id}><strong>{score === null ? "Not enough data" : `${score}/100`}</strong></td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="compare-disclaimer">A metric leader is highlighted only when every selected product has that nutrient reported. “Lowest” or “highest” applies to that one nutrient only; it does not mean the product is healthiest overall. Demo products contain illustrative values.</p>
      </section>

      <section className="panel">
        <div className="analysishead">
          <div>
            <div className="eyebrow">Product breakdown</div>
            <h2>{selected.name}</h2>
            <div className="muted">{selected.brand} · {selected.source}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="scorebig">{analysis.score === null ? "—" : analysis.score}<small>{analysis.score === null ? "" : "/100"}</small></div>
            <span className={concernClass(analysis.score)}>{analysis.band}</span>
          </div>
        </div>
        <div className="bar"><span style={{ width: `${analysis.score ?? 0}%` }} /></div>
        <p className="muted">{analysis.summary} Confidence: {analysis.confidence}.</p>

        {selected.source === "Demo" && <div className="demo-warning">Illustrative demo data only — these are not verified values from a real manufacturer's package.</div>}
        <div className="data-chips">
          {selected.barcode && <span>Barcode: {selected.barcode}</span>}
          {selected.quantity && <span>Pack: {selected.quantity}</span>}
          {selected.nutriScoreGrade && <span>Nutri-Score label: {selected.nutriScoreGrade}</span>}
          <span>Data coverage: {selected.dataCompleteness || "illustrative demo"}</span>
          {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">View Open Food Facts record ↗</a>}
        </div>

        <div style={{ marginTop: 18 }}>
          {analysis.factors.filter(factor => factor.available).map(factor => (
            <div className="factor" key={factor.key}>
              <strong>{factor.label}{factor.value !== undefined ? ` · ${factor.value} ${factor.unit}` : ""}</strong>
              <span className="muted">{Math.round(factor.score)} / 100 factor indicator</span>
              <p>{factor.detail}</p>
            </div>
          ))}
        </div>
        {analysis.missing.length > 0 && <p className="muted">Missing label data: {analysis.missing.join(", ")}.</p>}

        <div className="ingredient-panel">
          <div className="sectionhead">
            <div>
              <h2>Ingredient & allergen notes</h2>
              <p>Rule-based label observations, not an AI safety verdict.</p>
            </div>
          </div>
          {selected.ingredients ? <p className="ingredient-text">{selected.ingredients}</p> : <p className="muted">Ingredient text is not available for this product in the database.</p>}
          {selected.allergens && <p className="muted"><strong>Declared allergens:</strong> {selected.allergens}</p>}
          {selected.additives && selected.additives.length > 0 && <p className="muted"><strong>Database additive tags:</strong> {selected.additives.join(", ")}</p>}
          {ingredientFindings.length ? ingredientFindings.map((finding, index) => (
            <div className="finding" key={`${finding.category}-${finding.ingredient}-${index}`}>
              <span className={`finding-tag ${finding.category}`}>{finding.category}</span>
              <div>
                <strong>{finding.ingredient}: {finding.note}</strong>
                <p>{finding.context}</p>
                <span className="finding-source">Matched in {finding.source}</span>
              </div>
            </div>
          )) : <p className="muted">No matching ingredient notes were identified by the current rules. This does not mean the product is risk-free.</p>}
        </div>

        <div className="sectionhead" style={{ marginTop: 24 }}>
          <div><h2>Try these alternatives</h2><p>General ideas; compare actual labels and portion sizes.</p></div>
        </div>
        <div className="alternatives">{alternatives(selected).map(item => <span className="alt" key={item}>✓ {item}</span>)}</div>

        <div className="notice"><strong>Important:</strong> SnackSafe’s score is an experimental, educational nutrition indicator using per-100 g values and prototype thresholds. It is not an official FSSAI rating, medical diagnosis, or probability of harm. A numerical score is withheld when fewer than 3 of 6 factors are available. Missing values are not treated as zero. Serving size, frequency, dietary needs and the full diet matter. Product data is community-contributed and may be incomplete or incorrect. Verify the physical package before making decisions.</div>
      </section>

      <footer className="notice" style={{ border: 0, textAlign: "center" }}>Product data: Open Food Facts · Ingredient observations are limited keyword matches · SnackSafe prototype v1.3</footer>
      {scannerOpen && <BarcodeScanner onDetected={lookupBarcode} onClose={() => setScannerOpen(false)} />}
    </main>
  );
}
