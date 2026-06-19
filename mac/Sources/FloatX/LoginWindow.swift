import AppKit
import WebKit

/// A normal resizable window that shows the Harvester's WKWebView so the user
/// can log into X. Once logged in, this window is closed and the same web view
/// keeps harvesting in the background (it's the same instance).
@MainActor
final class LoginWindow: NSWindowController, NSWindowDelegate {
    private let webView: WKWebView
    var onClosed: (() -> Void)?

    init(webView: WKWebView) {
        self.webView = webView
        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1100, height: 900),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        win.title = "FloatX — sign in to X"
        win.center()
        super.init(window: win)
        win.delegate = self
        win.contentView = webView
    }

    required init?(coder: NSCoder) { fatalError() }

    func present() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func windowWillClose(_ note: Notification) {
        // Detach the web view so it survives (keeps harvesting) after the window closes.
        window?.contentView = nil
        onClosed?()
    }
}
