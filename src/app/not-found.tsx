import Link from "next/link";

export default function NotFound() {
  return (
    <main className="sad404">
      <div className="sad404__lights" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <section className="sad404__content">
        <div className="sad404__mac">
          <figure className="sad404__figure">
            <div className="sad-mac" />
            <figcaption className="sad404__caption">
              <span className="sr-text">Error 404: Not Found</span>
              <span className="e" />
              <span className="r" />
              <span className="r" />
              <span className="o" />
              <span className="r" />
              <span className="_4" />
              <span className="_0" />
              <span className="_4" />
              <span className="n" />
              <span className="o" />
              <span className="t" />
              <span className="f" />
              <span className="o" />
              <span className="u" />
              <span className="n" />
              <span className="d" />
            </figcaption>
          </figure>
          <div className="sad404__error">ERROR 404</div>
        </div>
        <div className="sad404__text">
          <h1>Stránka nenalezena</h1>
          <p>Zkus se vrátit zpět na Home. Tahle stránka už tady nejspíš není.</p>
          <Link href="/" className="sad404__home">
            Zpět na Home
          </Link>
        </div>
      </section>
    </main>
  );
}
