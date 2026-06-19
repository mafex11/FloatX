import SwiftUI
import WebKit

/// Plays an X video inline by loading the official tweet embed in a WKWebView.
/// X serves timeline video as blob/MSE (AVPlayer can't open it), so the embed
/// player is the reliable route. We load X's complete embed PAGE directly —
/// `platform.twitter.com/embed/Tweet.html?id=…` — which renders the tweet with
/// a working video player; no widgets.js/blockquote processing to go wrong.
struct VideoView: NSViewRepresentable {
    let tweetID: String

    func makeNSView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.navigationDelegate = context.coordinator
        load(wv)
        return wv
    }

    func updateNSView(_ wv: WKWebView, context: Context) {
        if context.coordinator.loadedID != tweetID { load(wv) }
    }

    private func load(_ wv: WKWebView) {
        let id = tweetID.filter { $0.isNumber }
        guard !id.isEmpty,
              let url = URL(string: "https://platform.twitter.com/embed/Tweet.html?id=\(id)&theme=dark&dnt=true&hideCard=false&hideThread=true")
        else { return }
        wv.load(URLRequest(url: url))
    }

    func makeCoordinator() -> Coordinator { Coordinator(tweetID: tweetID) }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var loadedID: String?
        init(tweetID: String) { self.loadedID = tweetID }
        // Autoplay the embed's video once it appears. The <video> is created by
        // X's embed script after load, so poll briefly. Mute first — WebKit
        // blocks unmuted autoplay.
        func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
            // Poll for the <video> (X's embed builds it after load, inside a
            // same-origin iframe). When found: hoist it to fill the page, hide
            // all the surrounding tweet chrome, mute + autoplay.
            let js = """
            (function(){
              function isolate(doc){
                var v = doc.querySelector('video');
                if (!v) return false;
                v.muted = true; v.play().catch(function(){});
                // Strip everything, then re-add just the video, filling the frame.
                var html = doc.documentElement, body = doc.body;
                html.style.background = 'transparent';
                body.style.cssText = 'margin:0;padding:0;background:transparent;overflow:hidden;height:100vh';
                v.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;border-radius:14px';
                // Detach the video's ancestors' siblings so only it shows.
                var node = v;
                while (node && node !== body) {
                  var p = node.parentNode;
                  if (p) {
                    Array.prototype.slice.call(p.children).forEach(function(c){
                      if (c !== node) c.style.display = 'none';
                    });
                    p.style.cssText = 'margin:0;padding:0;border:0;background:transparent';
                  }
                  node = p;
                }
                body.appendChild(v);
                return true;
              }
              var tries = 0;
              var t = setInterval(function(){
                var done = isolate(document);
                // Also try inside any iframe the embed created.
                if (!done) {
                  var f = document.querySelector('iframe');
                  if (f && f.contentDocument) done = isolate(f.contentDocument);
                }
                if (done || ++tries > 60) clearInterval(t);
              }, 200);
            })();
            """
            wv.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
