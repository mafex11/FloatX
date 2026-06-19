import AppKit
import SwiftUI

/// Borderless, always-on-top, non-activating floating panel — the Spotify-style
/// PiP shell. Hosts a SwiftUI root, is draggable anywhere, and rounds its corners.
final class GlassPanel: NSPanel {
    init<Content: View>(size: NSSize, root: Content) {
        super.init(
            contentRect: NSRect(origin: .zero, size: size),
            // .resizable lets the user drag the edges/corners to resize.
            styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView, .resizable],
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
        // Resize bounds.
        minSize = NSSize(width: 280, height: 220)
        maxSize = NSSize(width: 720, height: 900)

        let host = NSHostingView(rootView: root)
        host.wantsLayer = true
        host.layer?.cornerRadius = 20
        host.layer?.masksToBounds = true
        host.autoresizingMask = [.width, .height]
        contentView = host

        // Place near the top-right of the main screen by default.
        if let screen = NSScreen.main {
            let v = screen.visibleFrame
            setFrameOrigin(NSPoint(x: v.maxX - size.width - 24, y: v.maxY - size.height - 24))
        }
    }

    /// Resize to a preset size, keeping the top-left corner anchored (AppKit's
    /// origin is bottom-left, so we adjust y by the height delta).
    func applySize(_ size: NSSize) {
        var f = frame
        f.origin.y += (f.size.height - size.height)
        f.size = size
        setFrame(f, display: true, animate: true)
    }

    /// Float on top (normal) vs pinned to the desktop/wallpaper layer (behind
    /// other windows, like a desktop widget).
    func setDesktopMode(_ on: Bool) {
        if on {
            // Sit just above the desktop icons, below normal windows.
            level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
            collectionBehavior = [.canJoinAllSpaces, .stationary]
        } else {
            level = .floating
            collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        }
    }

    // Borderless panels reject key focus by default; allow it so controls work.
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}
