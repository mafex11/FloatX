import AppKit

/// The FloatX menu-bar icon: the X logo glyph above the auto-advance bar, drawn
/// as a monochrome template image so macOS tints it for light/dark menu bars.
enum MenuBarIcon {
    static func make() -> NSImage {
        let size = NSSize(width: 18, height: 18)
        let image = NSImage(size: size, flipped: true) { _ in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            ctx.setFillColor(NSColor.black.cgColor)

            // Official X glyph path, authored in a 24×24 box. We scale it down
            // and lift it slightly to leave room for the bar underneath.
            let path = xGlyphPath()
            let scale: CGFloat = 13.5 / 24.0
            var t = CGAffineTransform(translationX: (18 - 13.5) / 2, y: 1.5)
                .scaledBy(x: scale, y: scale)
            if let scaled = path.copy(using: &t) {
                ctx.addPath(scaled)
                ctx.fillPath(using: .evenOdd) // cut out the counter
            }

            // Auto-advance bar beneath the X.
            ctx.fill(CGRect(x: 18 / 2 - 5, y: 15.0, width: 10, height: 2.0))
            return true
        }
        image.isTemplate = true
        return image
    }

    /// The X (Twitter) logo as a CGPath in a 0…24 coordinate box.
    private static func xGlyphPath() -> CGPath {
        let p = CGMutablePath()
        // From the canonical X svg: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17
        // l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231z
        // m-1.161 17.52h1.833L7.084 4.126H5.117z"
        p.move(to: CGPoint(x: 18.244, y: 2.25))
        p.addLine(to: CGPoint(x: 21.552, y: 2.25))
        p.addLine(to: CGPoint(x: 14.325, y: 10.51))
        p.addLine(to: CGPoint(x: 22.827, y: 21.75))
        p.addLine(to: CGPoint(x: 16.17, y: 21.75))
        p.addLine(to: CGPoint(x: 10.956, y: 14.933))
        p.addLine(to: CGPoint(x: 4.99, y: 21.75))
        p.addLine(to: CGPoint(x: 1.68, y: 21.75))
        p.addLine(to: CGPoint(x: 9.41, y: 12.915))
        p.addLine(to: CGPoint(x: 1.254, y: 2.25))
        p.addLine(to: CGPoint(x: 8.08, y: 2.25))
        p.addLine(to: CGPoint(x: 12.793, y: 8.481))
        p.closeSubpath()
        // inner counter
        p.move(to: CGPoint(x: 17.083, y: 19.77))
        p.addLine(to: CGPoint(x: 18.916, y: 19.77))
        p.addLine(to: CGPoint(x: 7.084, y: 4.126))
        p.addLine(to: CGPoint(x: 5.117, y: 4.126))
        p.closeSubpath()
        return p
    }
}
