import AppKit
import SwiftUI

/// Borderless, always-on-top, non-activating floating panel — the Spotify-style
/// PiP shell. Hosts a SwiftUI root, is draggable anywhere, and rounds its corners.
final class GlassPanel: NSPanel {
    init<Content: View>(size: NSSize, root: Content) {
        super.init(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        titleVisibility = .hidden
        titlebarAppearsTransparent = true
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true

        let host = NSHostingView(rootView: root)
        host.wantsLayer = true
        // Rounded content so the glass card's corners are clipped cleanly.
        host.layer?.cornerRadius = 20
        host.layer?.masksToBounds = true
        contentView = host

        // Place near the top-right of the main screen by default.
        if let screen = NSScreen.main {
            let v = screen.visibleFrame
            setFrameOrigin(NSPoint(x: v.maxX - size.width - 24, y: v.maxY - size.height - 24))
        }
    }

    // Borderless panels reject key focus by default; allow it so controls work.
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
