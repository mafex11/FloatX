import SwiftUI
import WebKit

/// Plays an X video inline by loading the official tweet embed in a WKWebView.
/// X serves timeline video as blob/MSE (AVPlayer can't open it), so the embed
/// player is the reliable route. We load X's complete embed PAGE directly —
/// `platform.twitter.com/embed/Tweet.html?id=…` — which renders the tweet with
/// a working video player. We isolate just the <video>, autoplay it muted, and
/// fire `onEnded` when it finishes so the shower can advance.
struct VideoView: NSViewRepresentable {
    let tweetID: String
    var onReady: () -> Void = {}
    var onEnded: () -> Void = {}

    func makeNSView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let ucc = WKUserContentController()
        ucc.add(context.coordinator, name: "videoEnded")
        ucc.add(context.coordinator, name: "videoReady")
        cfg.userContentController = ucc
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.navigationDelegate = context.coordinator
        load(wv)
        return wv
    }

    func updateNSView(_ wv: WKWebView, context: Context) {
        if context.coordinator.loadedID != tweetID {
            context.coordinator.loadedID = tweetID
            load(wv)
        }
    }

    private func load(_ wv: WKWebView) {
        let id = tweetID.filter { $0.isNumber }
        guard !id.isEmpty,
              let url = URL(string: "https://platform.twitter.com/embed/Tweet.html?id=\(id)&theme=dark&dnt=true&hideCard=false&hideThread=true")
        else { return }
        wv.load(URLRequest(url: url))
    }

    func makeCoordinator() -> Coordinator { Coordinator(tweetID: tweetID, onReady: onReady, onEnded: onEnded) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var loadedID: String?
        let onReady: () -> Void
        let onEnded: () -> Void
        init(tweetID: String, onReady: @escaping () -> Void, onEnded: @escaping () -> Void) {
            self.loadedID = tweetID
            self.onReady = onReady
            self.onEnded = onEnded
        }

        func userContentController(_ ucc: WKUserContentController, didReceive msg: WKScriptMessage) {
            if msg.name == "videoEnded" { Task { @MainActor in onEnded() } }
            if msg.name == "videoReady" { Task { @MainActor in onReady() } }
        }

        // Once the embed builds its <video>: isolate it to fill the frame, mute +
        // autoplay, and notify native when it ends (once).
        func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
            let js = """
            (function(){
              function isolate(doc){
                var v = doc.querySelector('video');
                if (!v) return false;
                v.muted = true; v.play().catch(function(){});
                if (!v.__fxReady) {
                  v.__fxReady = true;
                  var notifyReady = function(){
                    try { window.webkit.messageHandlers.videoReady.postMessage(1); } catch(e){}
                  };
                  if (v.readyState >= 2) notifyReady();
                  else v.addEventListener('loadeddata', notifyReady, { once: true });
                  v.addEventListener('playing', notifyReady, { once: true });
                  v.addEventListener('ended', function(){
                    try { window.webkit.messageHandlers.videoEnded.postMessage(1); } catch(e){}
                  });
                }
                var html = doc.documentElement, body = doc.body;
                html.style.background = 'transparent';
                body.style.cssText = 'margin:0;padding:0;background:transparent;overflow:hidden;height:100vh';
                v.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#000;border-radius:14px';
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
