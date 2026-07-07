// Loading placeholder that mimics the shape of AgreementCard. Kept in a
// separate component so the skeleton never diverges from the real card.

export function SkeletonCard() {
  return (
    <article className="card card--skel" aria-hidden="true">
      <header className="card__head">
        <span className="skel skel--tag" />
        <span className="skel skel--tag skel--tag-r" />
      </header>
      <div className="skel skel--title" />
      <div className="skel skel--title skel--title-2" />

      <div className="skel skel--verdict" />

      <div className="card__flags">
        <div className="skel skel--flag" />
        <div className="skel skel--flag" />
        <div className="skel skel--flag" />
        <div className="skel skel--flag" />
        <div className="skel skel--flag" />
      </div>

      <div className="card__meta">
        <div>
          <div className="skel skel--line skel--line-s" />
          <div className="skel skel--line" />
        </div>
        <div>
          <div className="skel skel--line skel--line-s" />
          <div className="skel skel--line" />
        </div>
        <div>
          <div className="skel skel--line skel--line-s" />
          <div className="skel skel--line" />
        </div>
        <div>
          <div className="skel skel--line skel--line-s" />
          <div className="skel skel--line" />
        </div>
      </div>

      <footer className="card__parties">
        <div className="skel skel--line skel--line-mono" />
        <div className="skel skel--line skel--line-mono" />
        <div className="skel skel--line skel--line-mono" />
      </footer>
    </article>
  );
}
