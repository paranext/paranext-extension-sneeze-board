// Placeholder web view content; Phase 9 fills this in.
function SneezeBoardWebView() {
  return (
    <div className="sneeze-board">
      <h2>Sneeze Board</h2>
      <p>Hello from the Sneeze Board web view.</p>
    </div>
  );
}

// globalThis.webViewComponent is the Platform.Bible convention for React web views —
// see paranext-extension-template for reference.
(globalThis as unknown as { webViewComponent: unknown }).webViewComponent = SneezeBoardWebView;
