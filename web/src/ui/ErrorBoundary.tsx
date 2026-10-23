import { Component, type ReactNode } from "react";

/** Keeps a failing room from taking the whole game down: it shows a note instead, with a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="history">
        <p className="empty">
          Something went wrong in {this.props.label}. Your game is safe.{" "}
          <button type="button" className="link" onClick={() => location.reload()}>
            Reload
          </button>
        </p>
      </main>
    );
  }
}
