import SwiftUI
import AppKit

/// The glass tweet card:
///  - top progress bar (auto-advance countdown)
///  - header + text + media + a bottom ACTION BAR
///  - bottom bar: reply / repost / like (with counts, open the tweet in browser),
///    plus subtle reload + open-in-X buttons
///  - prev / pause / next reveal on hover over the left / center / right edges
struct CardView: View {
    @ObservedObject var store: PostStore
    @ObservedObject var player: Player
    @ObservedObject var settings = Settings.shared
    var onReload: () -> Void = {}
    var onLike: (String) -> Void = { _ in }
    var onRepost: (String) -> Void = { _ in }

    // Persisted per-tweet so the liked/reposted state stays filled after tapping.
    @State private var liked: Set<String> = []
    @State private var reposted: Set<String> = []

    var body: some View {
        ZStack(alignment: .top) {
            if let post = store.current {
                content(post)
            } else {
                waiting
            }
            hoverControls          // prev / pause / next on edge hover
            progressBar            // thin countdown bar pinned to the top
            resizeGrip             // bottom-right drag-to-resize handle
        }
        .frame(minWidth: 280, minHeight: 220)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Fade only the glass background; content (text, avatar, media) stays
        // fully opaque and readable. The glass is its own layer behind content.
        .background {
            Color.clear
                .glassEffect(.regular, in: .rect(cornerRadius: 20))
                .opacity(settings.clampedOpacity)
        }
    }

    private func openTweet(_ post: Post) {
        guard let url = URL(string: post.permalink), !post.permalink.isEmpty else { return }
        NSWorkspace.shared.open(url)
    }

    // MARK: card content
    private func content(_ post: Post) -> some View {
        let scale = settings.sizePreset.scale
        // More text lines fit as the widget grows.
        let maxLines = post.media.contains(where: { !$0.url.isEmpty })
            ? Int(3 * scale) : Int(8 * scale)
        return VStack(alignment: .leading, spacing: 9 * scale) {
            header(post)
            if !post.text.isEmpty {
                Text(post.text)
                    .font(.system(size: 15 * scale))
                    .foregroundStyle(.primary)
                    .lineLimit(maxLines)
                    .fixedSize(horizontal: false, vertical: true)
            }
            mediaArea(post)
            metaRow(post)
            actionBar(post)
        }
        .padding(14 * scale)
        .padding(.top, 6) // clear the top progress bar
    }

    // MARK: media — image, or tap-to-play inline video
    @ViewBuilder
    private func mediaArea(_ post: Post) -> some View {
        if let video = post.media.first(where: { $0.type == .video }) {
            VideoArea(post: post, posterURL: video.url)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let media = post.media.first(where: { !$0.url.isEmpty }) {
            MediaView(media: media)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Spacer(minLength: 0)
        }
    }

    private func header(_ post: Post) -> some View {
        HStack(spacing: 10) {
            Avatar(url: post.avatarURL, name: post.author)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(post.author.isEmpty ? "Unknown" : post.author)
                        .font(.system(size: 15, weight: .bold)).lineLimit(1)
                    if post.verified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(red: 0.11, green: 0.61, blue: 0.94))
                    }
                }
                Text("@\(post.handle)").font(.system(size: 13))
                    .foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Text(post.timeDisplay).font(.system(size: 13)).foregroundStyle(.secondary)
        }
    }

    // MARK: bottom action bar — interactive
    private func actionBar(_ post: Post) -> some View {
        HStack(spacing: 0) {
            // Reply → open the tweet in the browser to reply there.
            ActionStat(symbol: "bubble.left", filledSymbol: "bubble.left.fill",
                       value: post.engagement.replies, tint: .secondary, active: false) { openTweet(post) }
            // Repost → toggle in-place in the X session; state persists.
            ActionStat(symbol: "arrow.2.squarepath", filledSymbol: "arrow.2.squarepath",
                       value: post.engagement.reposts, tint: .green, active: reposted.contains(post.id)) {
                toggle(&reposted, post.id); onRepost(post.id)
            }
            // Like → toggle in-place in the X session; state persists.
            ActionStat(symbol: "heart", filledSymbol: "heart.fill",
                       value: post.engagement.likes, tint: .pink, active: liked.contains(post.id)) {
                toggle(&liked, post.id); onLike(post.id)
            }
            Spacer(minLength: 6)
            iconButton("arrow.clockwise", help: "Reload timeline", action: onReload)
            iconButton("arrow.up.right.square", help: "Open tweet in browser") { openTweet(post) }
        }
        .font(.system(size: 12))
    }

    private func toggle(_ set: inout Set<String>, _ id: String) {
        if set.contains(id) { set.remove(id) } else { set.insert(id) }
    }

    // MARK: meta row — absolute date · views (X-style, under the content)
    private func metaRow(_ post: Post) -> some View {
        let date = post.absoluteDate
        let views = post.engagement.views
        return HStack(spacing: 6) {
            if !date.isEmpty {
                Text(date)
            }
            if !date.isEmpty && !views.isEmpty {
                Text("·")
            }
            if !views.isEmpty {
                Text("\(views) Views").fontWeight(.semibold).foregroundStyle(.secondary)
            }
        }
        .font(.system(size: 12))
        .foregroundStyle(.tertiary)
        .lineLimit(1)
    }

    private func iconButton(_ symbol: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 26, height: 26)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
        .hoverHighlight()
    }

    // MARK: top progress bar — flush to the very top edge, full width
    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(.white.opacity(0.12))
                Rectangle()
                    .fill(player.paused ? Color.yellow : Color(red: 0.11, green: 0.61, blue: 0.94))
                    .frame(width: max(2, geo.size.width * player.progress))
                    // Interpolate between the 0.1s ticks so the bar glides instead
                    // of stepping. Linear matches the constant countdown rate.
                    .animation(.linear(duration: 0.1), value: player.progress)
            }
        }
        .frame(height: 3)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    // MARK: prev / pause / next — reveal on hover over each edge zone
    private var hoverControls: some View {
        HStack(spacing: 0) {
            EdgeControl(symbol: "backward.fill", enabled: store.canBack, align: .leading) { player.back() }
            EdgeControl(symbol: player.paused ? "play.fill" : "pause.fill", enabled: true, align: .center) { player.togglePause() }
            EdgeControl(symbol: "forward.fill", enabled: store.canAdvance, align: .trailing) { player.advance() }
        }
        .padding(.bottom, 40) // sit above the action bar
        .padding(.top, 56)    // below header
    }

    // MARK: resize grip — bottom-right corner
    private var resizeGrip: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                ResizeGrip()
            }
        }
        .padding(4)
    }

    private var waiting: some View {
        VStack(spacing: 6) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 22)).foregroundStyle(.secondary)
            Text("waiting for posts…").font(.system(size: 14)).foregroundStyle(.secondary)
            Text("scroll your x.com feed in the background")
                .font(.system(size: 12)).foregroundStyle(.tertiary)
        }
        .padding()
    }
}

/// An engagement stat that acts on tap. `active` is the persisted state (liked/
/// reposted) — when true the icon fills and stays tinted.
private struct ActionStat: View {
    let symbol: String
    let filledSymbol: String
    let value: String
    let tint: Color
    let active: Bool
    let action: () -> Void
    @State private var bump = false

    var body: some View {
        Button {
            action()
            bump = true
            Task { try? await Task.sleep(for: .seconds(0.35)); bump = false }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: active ? filledSymbol : symbol).font(.system(size: 13))
                Text(value.isEmpty ? "0" : value)
            }
            .foregroundStyle(active ? tint : .secondary)
            .scaleEffect(bump ? 1.18 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.5), value: bump)
            .animation(.easeOut(duration: 0.15), value: active)
            .padding(.vertical, 4).padding(.horizontal, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverHighlight()
    }
}

/// Bottom-right drag handle that resizes the floating panel. Captures the
/// window's size at drag start so translation maps to an absolute new size.
private struct ResizeGrip: View {
    @State private var startSize: NSSize?
    var body: some View {
        Image(systemName: "arrow.up.left.and.arrow.down.right")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.secondary.opacity(0.55))
            .frame(width: 22, height: 22)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(coordinateSpace: .global)
                    .onChanged { g in
                        guard let win = panelWindow() else { return }
                        if startSize == nil { startSize = win.frame.size }
                        guard let s = startSize else { return }
                        let newW = min(720, max(280, s.width + g.translation.width))
                        let newH = min(900, max(220, s.height + g.translation.height))
                        var f = win.frame
                        // Anchor the top edge (AppKit origin is bottom-left).
                        f.origin.y += (f.size.height - newH)
                        f.size = NSSize(width: newW, height: newH)
                        win.setFrame(f, display: true)
                    }
                    .onEnded { _ in startSize = nil }
            )
            .help("Drag to resize")
    }
    private func panelWindow() -> NSWindow? {
        NSApp.windows.first(where: { $0 is GlassPanel })
    }
}

/// A third-of-the-card hover zone; shows its control only while hovered.
private struct EdgeControl: View {
    let symbol: String
    let enabled: Bool
    let align: Alignment
    let action: () -> Void
    @State private var hover = false

    var body: some View {
        ZStack(alignment: align) {
            Color.clear
            Button(action: action) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .foregroundStyle(.white)
                    .contentShape(Circle())
            }
            .buttonStyle(.glass)
            .clipShape(Circle())
            .disabled(!enabled)
            .opacity((hover && enabled) ? 1 : 0)
            .animation(.easeOut(duration: 0.15), value: hover)
            .padding(.horizontal, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onHover { hover = $0 }
    }
}

/// Subtle background highlight on hover, for the plain action buttons.
private struct HoverHighlight: ViewModifier {
    @State private var hover = false
    func body(content: Content) -> some View {
        content
            .background(RoundedRectangle(cornerRadius: 7).fill(.white.opacity(hover ? 0.10 : 0)))
            .onHover { hover = $0 }
    }
}
private extension View {
    func hoverHighlight() -> some View { modifier(HoverHighlight()) }
}

private struct Avatar: View {
    let url: String
    let name: String
    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            if let img = phase.image { img.resizable().scaledToFill() }
            else {
                Circle().fill(.gray.opacity(0.3))
                    .overlay(Text(String(name.first ?? "?")).font(.system(size: 16, weight: .bold)))
            }
        }
        .frame(width: 40, height: 40).clipShape(Circle())
    }
}

/// Video media: loads X's embed player (a WKWebView) immediately and autoplays
/// inline — no poster/tap step. Keyed by post id so it reloads on each new post.
private struct VideoArea: View {
    let post: Post
    let posterURL: String

    var body: some View {
        VideoView(tweetID: post.id)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .id(post.id) // fresh web view per post
    }
}

private struct MediaView: View {
    let media: Post.Media
    var body: some View {
        AsyncImage(url: URL(string: media.url)) { phase in
            if let img = phase.image { img.resizable().scaledToFit() }
            else { RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.06)) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .center) {
            if media.type == .video {
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 38))
                    .foregroundStyle(.white.opacity(0.9))
                    .shadow(radius: 6)
            }
        }
    }
}
