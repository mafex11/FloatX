import AppKit
import SwiftUI

@MainActor
final class AppController: NSObject, NSApplicationDelegate {
    private let store = PostStore()
    private let server = WSServer()
    private var statusItem: NSStatusItem!
    private var panel: GlassPanel?

    func applicationDidFinishLaunching(_ note: Notification) {
        // Menu-bar only — no Dock icon.
        NSApp.setActivationPolicy(.accessory)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let btn = statusItem.button {
            btn.image = NSImage(systemSymbolName: "rectangle.on.rectangle.angled", accessibilityDescription: "FloatX")
            btn.action = #selector(togglePanel)
            btn.target = self
        }
        rebuildMenu(status: "starting…")

        server.onPost = { [weak self] post in self?.store.upsert(post) }
        server.onStatus = { [weak self] s in self?.rebuildMenu(status: s) }
        server.start()
    }

    private func rebuildMenu(status: String) {
        let menu = NSMenu()
        menu.addItem(withTitle: "FloatX", action: nil, keyEquivalent: "")
        let s = NSMenuItem(title: status, action: nil, keyEquivalent: "")
        s.isEnabled = false
        menu.addItem(s)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Show / hide widget", action: #selector(togglePanel), keyEquivalent: "f").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit FloatX", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        // Attach the menu only on right-click; left-click toggles directly.
        statusItem.menu = nil
        rightClickMenu = menu
    }

    private var rightClickMenu: NSMenu?

    @objc private func togglePanel() {
        // Right-click (or control-click) shows the menu; left-click toggles.
        if let event = NSApp.currentEvent,
           event.type == .rightMouseUp || event.modifierFlags.contains(.control),
           let menu = rightClickMenu {
            statusItem.menu = menu
            statusItem.button?.performClick(nil)
            statusItem.menu = nil
            return
        }
        if let panel, panel.isVisible {
            panel.orderOut(nil)
        } else {
            showPanel()
        }
    }

    private func showPanel() {
        if panel == nil {
            panel = GlassPanel(size: NSSize(width: 360, height: 320),
                               root: CardView(store: store))
        }
        panel?.orderFrontRegardless()
    }
}

let app = NSApplication.shared
let controller = AppController()
app.delegate = controller
app.run()
