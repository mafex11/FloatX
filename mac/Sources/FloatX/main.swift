import AppKit
import SwiftUI

@MainActor
final class AppController: NSObject, NSApplicationDelegate {
    private let store = PostStore()
    private let harvester = Harvester()
    private lazy var player = Player(store: store)
    private var statusItem: NSStatusItem!
    private var panel: GlassPanel?
    private var loginWindow: LoginWindow?
    private var feedWindow: FeedWindow?
    private var status = "starting…"
    private var loggedIn = false

    func applicationDidFinishLaunching(_ note: Notification) {
        NSApp.setActivationPolicy(.accessory) // menu-bar only

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let btn = statusItem.button {
            btn.image = MenuBarIcon.make()
            btn.action = #selector(iconClicked)
            btn.target = self
            btn.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        harvester.onPost = { [weak self] post in self?.store.upsert(post) }
        harvester.onStatus = { [weak self] s in
            self?.status = s
            self?.afterNavigation()
        }
        harvester.start()
        rebuildMenu()
    }

    /// After each navigation settles, decide whether we still need login.
    private var promptedLogin = false
    private var loginPoll: Timer?

    private func afterNavigation() {
        harvester.checkLoginState { [weak self] loggedIn in
            guard let self else { return }
            self.applyLoginState(loggedIn)
            if !loggedIn && !self.promptedLogin {
                self.promptedLogin = true
                self.showLogin()
            }
        }
    }

    private func applyLoginState(_ loggedIn: Bool) {
        self.loggedIn = loggedIn
        if loggedIn {
            status = "harvesting"
            // Auto-close the sign-in window the moment login is detected.
            stopLoginPoll()
            loginWindow?.close()
            loginWindow = nil
        }
    }

    private func showLogin() {
        let w = LoginWindow(webView: harvester.webView)
        w.onClosed = { [weak self] in
            self?.promptedLogin = false // allow re-prompt if they bailed
            self?.stopLoginPoll()
        }
        loginWindow = w
        w.present()
        status = "sign in to X to begin"
        // X completes login via SPA routing (no full navigation), so didFinish
        // won't re-fire. Poll login state while the window is open and auto-close
        // the instant we're in.
        startLoginPoll()
    }

    private func startLoginPoll() {
        stopLoginPoll()
        loginPoll = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.loginWindow != nil else { return }
                self.harvester.checkLoginState { ok in if ok { self.applyLoginState(true) } }
            }
        }
    }

    private func stopLoginPoll() {
        loginPoll?.invalidate()
        loginPoll = nil
    }

    // MARK: menu-bar
    @objc private func iconClicked() {
        let isRight = NSApp.currentEvent?.type == .rightMouseUp
            || (NSApp.currentEvent?.modifierFlags.contains(.control) ?? false)
        if isRight {
            statusItem.menu = buildMenu()
            statusItem.button?.performClick(nil)
            statusItem.menu = nil
        } else {
            togglePanel()
        }
    }

    @objc private func togglePanel() {
        if let panel, panel.isVisible {
            panel.orderOut(nil)
        } else {
            if panel == nil {
                panel = GlassPanel(size: Settings.shared.sizePreset.dimensions,
                                   root: CardView(store: store, player: player,
                                                  onReload: { [weak self] in self?.harvester.reloadHome() },
                                                  onLike: { [weak self] id in self?.harvester.performAction(id: id, action: "like") },
                                                  onRepost: { [weak self] id in self?.harvester.performAction(id: id, action: "repost") }))
            }
            panel?.setDesktopMode(Settings.shared.desktopMode)
            panel?.makeKeyAndOrderFront(nil)
        }
    }

    private func rebuildMenu() { /* menu is built on demand in iconClicked */ }

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()
        let title = NSMenuItem(title: "FloatX", action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        let s = NSMenuItem(title: status, action: nil, keyEquivalent: "")
        s.isEnabled = false
        menu.addItem(s)
        menu.addItem(.separator())

        menu.addItem(withTitle: "Show / hide widget", action: #selector(togglePanel), keyEquivalent: "f").target = self
        menu.addItem(withTitle: "Open X feed…", action: #selector(openFeed), keyEquivalent: "x").target = self

        let desktop = NSMenuItem(title: "Desktop mode (pin to wallpaper)",
                                 action: #selector(toggleDesktopMode), keyEquivalent: "")
        desktop.target = self
        desktop.state = Settings.shared.desktopMode ? .on : .off
        menu.addItem(desktop)

        // Interval submenu.
        let intervalItem = NSMenuItem(title: "Advance every", action: nil, keyEquivalent: "")
        let intervalMenu = NSMenu()
        for (label, secs) in [("10s", 10), ("30s", 30), ("1m", 60), ("5m", 300), ("15m", 900)] {
            let mi = NSMenuItem(title: label, action: #selector(setInterval(_:)), keyEquivalent: "")
            mi.target = self
            mi.tag = secs
            mi.state = (Settings.shared.clampedInterval == secs) ? .on : .off
            intervalMenu.addItem(mi)
        }
        intervalItem.submenu = intervalMenu
        menu.addItem(intervalItem)

        // Transparency submenu.
        let transItem = NSMenuItem(title: "Transparency", action: nil, keyEquivalent: "")
        let transMenu = NSMenu()
        for (label, val) in [("Solid", 1.0), ("Light", 0.85), ("Medium", 0.65), ("Heavy", 0.45)] {
            let mi = NSMenuItem(title: label, action: #selector(setOpacity(_:)), keyEquivalent: "")
            mi.target = self
            mi.representedObject = val
            mi.state = abs(Settings.shared.clampedOpacity - val) < 0.01 ? .on : .off
            transMenu.addItem(mi)
        }
        transItem.submenu = transMenu
        menu.addItem(transItem)

        // Size submenu (S / M / L / XL).
        let sizeItem = NSMenuItem(title: "Size", action: nil, keyEquivalent: "")
        let sizeMenu = NSMenu()
        for preset in WidgetSize.allCases {
            let mi = NSMenuItem(title: preset.label, action: #selector(setSize(_:)), keyEquivalent: "")
            mi.target = self
            mi.representedObject = preset.rawValue
            mi.state = (Settings.shared.sizePreset == preset) ? .on : .off
            sizeMenu.addItem(mi)
        }
        sizeItem.submenu = sizeMenu
        menu.addItem(sizeItem)

        menu.addItem(.separator())
        if loggedIn {
            menu.addItem(withTitle: "Sign out of X", action: #selector(signOut), keyEquivalent: "").target = self
        } else {
            menu.addItem(withTitle: "Sign in to X…", action: #selector(openLogin), keyEquivalent: "").target = self
        }
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit FloatX", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        return menu
    }

    @objc private func setInterval(_ sender: NSMenuItem) {
        Settings.shared.intervalSec = sender.tag
    }

    @objc private func setOpacity(_ sender: NSMenuItem) {
        if let v = sender.representedObject as? Double { Settings.shared.opacity = v }
    }

    @objc private func setSize(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String,
              let preset = WidgetSize(rawValue: raw) else { return }
        Settings.shared.sizePreset = preset
        panel?.applySize(preset.dimensions)
    }

    @objc private func toggleDesktopMode() {
        Settings.shared.desktopMode.toggle()
        panel?.setDesktopMode(Settings.shared.desktopMode)
        if Settings.shared.desktopMode { panel?.orderBack(nil) } else { panel?.orderFrontRegardless() }
    }

    @objc private func openLogin() {
        if loginWindow == nil { showLogin() } else { loginWindow?.present() }
    }

    @objc private func openFeed() {
        if feedWindow == nil { feedWindow = FeedWindow() }
        feedWindow?.present()
    }

    @objc private func signOut() {
        harvester.signOut { [weak self] in
            guard let self else { return }
            self.loggedIn = false
            self.promptedLogin = false
            self.store.clearAll()
            self.showLogin()
        }
    }
}

let app = NSApplication.shared
let controller = AppController()
app.delegate = controller
app.run()
