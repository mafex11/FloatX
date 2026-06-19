import WebKit
import AppKit

/// Hosts the app's own logged-in x.com in a WKWebView and injects the harvester
/// JS. Posts parsed in-page are delivered to `onPost`. The persistent data store
/// keeps the X login across launches, so the user signs in once.
///
/// This is the standalone data source — no browser, no extension.
@MainActor
final class Harvester: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let webView: WKWebView
    var onPost: ((Post) -> Void)?
    var onStatus: ((String) -> Void)?

    static let store = WKWebsiteDataStore.default() // persistent: keeps login (shared)

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = Self.store
        // A desktop-ish UA so x.com serves the full web timeline.
        let ucc = WKUserContentController()
        cfg.userContentController = ucc

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1100, height: 900), configuration: cfg)
        super.init()

        ucc.add(self, name: "floatx")
        ucc.add(self, name: "translation")
        if let js = Self.harvesterJS() {
            ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        webView.navigationDelegate = self
        webView.customUserAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
    }

    func start() {
        load("https://x.com/home")
    }

    /// Reload the home timeline (fresh posts). Wired to the widget's reload button.
    func reloadHome() {
        load("https://x.com/home")
    }

    /// Ask the hidden timeline to scroll and load more posts. Called when the
    /// widget queue runs low so the user never hits a dead end while scrolling.
    func requestMore() {
        webView.evaluateJavaScript("window.__floatxScrollMore && window.__floatxScrollMore()",
                                   completionHandler: nil)
    }

    /// Translate a tweet via X's own translation; result arrives on `onTranslate`.
    var onTranslate: ((_ id: String, _ text: String) -> Void)?
    func translate(id: String) {
        let safeID = id.filter { $0.isNumber }
        webView.evaluateJavaScript("window.__floatxTranslate && window.__floatxTranslate('\(safeID)')",
                                   completionHandler: nil)
    }

    /// Perform a like/repost on a tweet in-place, by clicking its real button in
    /// the hidden timeline. `action` is "like" or "repost".
    func performAction(id: String, action: String) {
        let safeID = id.filter { $0.isNumber }
        let js = "window.__floatxAction && window.__floatxAction('\(safeID)','\(action)')"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    /// Clear all of x.com's cookies/storage from our data store, then reload so
    /// the page shows the logged-out state and the user can sign in fresh.
    func signOut(_ done: @escaping () -> Void) {
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        Self.store.removeData(ofTypes: types, modifiedSince: .distantPast) { [weak self] in
            self?.load("https://x.com/login")
            done()
        }
    }

    func load(_ url: String) {
        if let u = URL(string: url) { webView.load(URLRequest(url: u)) }
    }

    /// Heuristic: are we logged in? The home timeline has the primary nav +
    /// timeline; the logged-out page shows a Sign in / Log in CTA at /home → redirects.
    func checkLoginState(_ done: @escaping (Bool) -> Void) {
        let js = "!!document.querySelector('[data-testid=\"primaryColumn\"]') && !location.pathname.startsWith('/i/flow/login') && !location.pathname.startsWith('/login')"
        webView.evaluateJavaScript(js) { result, _ in
            done((result as? Bool) ?? false)
        }
    }

    // MARK: WKScriptMessageHandler
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        // Translation results come on a separate channel with {id, text}.
        if message.name == "translation",
           let b = message.body as? [String: Any],
           let id = b["id"] as? String {
            onTranslate?(id, (b["text"] as? String) ?? "")
            return
        }
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            onStatus?("harvester ready")
        case "post":
            if let payload = body["payload"],
               let data = try? JSONSerialization.data(withJSONObject: payload),
               let post = try? JSONDecoder().decode(Post.self, from: data) {
                onPost?(post)
            }
        default:
            break
        }
    }

    // MARK: WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onStatus?("loaded \(webView.url?.path ?? "")")
    }

    private static func harvesterJS() -> String? {
        // Embedded at build time (HarvesterScript.swift, generated from
        // Resources/harvester.js) — no resource bundle to ship or sign.
        HarvesterScript.source
    }
}
