import SwiftUI

/// The glass tweet card. Phase 2a: header + text + (image) media + engagement,
/// on a Liquid Glass surface. Controls/video come in 2b/2c.
struct CardView: View {
    @ObservedObject var store: PostStore

    var body: some View {
        ZStack {
            if let post = store.current {
                content(post)
            } else {
                waiting
            }
        }
        .frame(width: 360, height: 320)
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
    }

    private func content(_ post: Post) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            header(post)
            if !post.text.isEmpty {
                Text(post.text)
                    .font(.system(size: 15))
                    .foregroundStyle(.primary)
                    .lineLimit(post.media.isEmpty ? 9 : 3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let media = post.media.first(where: { !$0.url.isEmpty }) {
                MediaView(media: media)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Spacer(minLength: 0)
            }
            engagement(post.engagement)
        }
        .padding(16)
    }

    private func header(_ post: Post) -> some View {
        HStack(spacing: 10) {
            Avatar(url: post.avatarURL, name: post.author)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(post.author.isEmpty ? "Unknown" : post.author)
                        .font(.system(size: 15, weight: .bold))
                        .lineLimit(1)
                    if post.verified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(red: 0.11, green: 0.61, blue: 0.94))
                    }
                }
                Text("@\(post.handle)")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(post.timeDisplay)
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
        }
    }

    private func engagement(_ e: Post.Engagement) -> some View {
        HStack(spacing: 0) {
            stat("bubble.left", e.replies)
            stat("arrow.2.squarepath", e.reposts)
            stat("heart", e.likes)
            stat("chart.bar", e.views)
        }
        .foregroundStyle(.secondary)
        .font(.system(size: 12))
    }

    private func stat(_ symbol: String, _ value: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 12))
            Text(value.isEmpty ? "0" : value)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var waiting: some View {
        VStack(spacing: 6) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 22))
                .foregroundStyle(.secondary)
            Text("waiting for posts…")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
            Text("open x.com with the FloatX extension")
                .font(.system(size: 12))
                .foregroundStyle(.tertiary)
        }
        .padding()
    }
}

private struct Avatar: View {
    let url: String
    let name: String
    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            if let img = phase.image {
                img.resizable().scaledToFill()
            } else {
                Circle().fill(.gray.opacity(0.3))
                    .overlay(Text(String(name.first ?? "?")).font(.system(size: 16, weight: .bold)))
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
    }
}

private struct MediaView: View {
    let media: Post.Media
    var body: some View {
        AsyncImage(url: URL(string: media.url)) { phase in
            if let img = phase.image {
                img.resizable().scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.06))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
