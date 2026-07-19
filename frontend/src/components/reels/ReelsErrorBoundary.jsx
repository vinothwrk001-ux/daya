import { Component } from "react";
import { AlertCircle, Home } from "lucide-react";

export class ReelsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("Reels Error Boundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {this.state.error?.message || "Unable to load reels at this time"}
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 bg-zinc-900 p-3 rounded-lg text-left">
                  <summary className="text-xs text-zinc-300 cursor-pointer font-semibold">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs text-red-400 overflow-auto max-h-[200px]">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-6 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
