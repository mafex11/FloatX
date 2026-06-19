import AppKit
import WebKit

/// A normal browsable X window: its own WKWebView (sharing the harvester's login
/// cookie store), so the user can scroll the real feed inside the app. Separate
/// from the harvester's web view so manual scrolling doesn't fight auto-scroll.
@MainActor
final class FeedWindow: NSWindowController, NSWindowDelegate {
    private let webView: WKWebView

    init() {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = Harvester.store // same session → already logged in
        cfg.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 500, height: 820), configuration: cfg)
        webView.customUserAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

        let win = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 500, height: 820),
            styleMask: [.titled, .closable, .resizable, .miniaturizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        win.title = "X — FloatX"
        win.titlebarAppearsTransparent = true
        win.center()
        super.init(window: win)
        win.delegate = self
        win.contentView = webView
        webView.load(URLRequest(url: URL(string: "https://x.com/home")!))
    }

    required init?(coder: NSCoder) { fatalError() }

    func present() {
        if webView.url == nil {
            webView.load(URLRequest(url: URL(string: "https://x.com/home")!))
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
