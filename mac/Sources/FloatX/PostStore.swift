import SwiftUI

/// Queue + bounded history + cursor, mirroring the extension store: the newest
/// post is the live front, advancing past history walks toward fresh content,
/// and re-sent posts enrich the existing entry in place.
@MainActor
final class PostStore: ObservableObject {
    @Published private(set) var current: Post?
    @Published private(set) var queueCount = 0
    @Published private(set) var historyCount = 0

    private var posts: [Post] = []
    private var indexByID: [String: Int] = [:]
    private var cursor = -1

    private let historyMax = 50

    var canAdvance: Bool { cursor + 1 < posts.count }
    var canBack: Bool { cursor > 0 }

    /// Wipe everything (used on sign-out).
    func clearAll() {
        posts.removeAll()
        indexByID.removeAll()
        cursor = -1
        current = nil
        queueCount = 0
        historyCount = 0
    }

    func upsert(_ post: Post) {
        if let idx = indexByID[post.id] {
            let merged = Self.merge(posts[idx], post)
            if merged != posts[idx] {
                posts[idx] = merged
                if idx == cursor { current = merged }
            }
        } else {
            indexByID[post.id] = posts.count
            posts.append(post)
            // Show the very first post as soon as it lands.
            if cursor < 0 { advance() } else { publishCounts() }
        }
    }

    @discardableResult
    func advance() -> Bool {
        guard cursor + 1 < posts.count else { return false }
        cursor += 1
        trimHistory()
        current = posts[cursor]
        publishCounts()
        return true
    }

    @discardableResult
    func back() -> Bool {
        guard cursor > 0 else { return false }
        cursor -= 1
        current = posts[cursor]
        publishCounts()
        return true
    }

    private func trimHistory() {
        let overflow = max(0, cursor) - historyMax
        guard overflow > 0 else { return }
        let removed = posts.prefix(overflow)
        removed.forEach { indexByID[$0.id] = nil }
        posts.removeFirst(overflow)
        cursor -= overflow
        reindex()
    }

    private func reindex() {
        indexByID.removeAll(keepingCapacity: true)
        for (i, p) in posts.enumerated() { indexByID[p.id] = i }
    }

    private func publishCounts() {
        queueCount = max(0, posts.count - 1 - cursor)
        historyCount = max(0, cursor)
    }

    /// Take the richer value per field (matches the extension's mergePost).
    static func merge(_ existing: Post, _ incoming: Post) -> Post {
        var next = existing
        if existing.avatarURL.isEmpty, !incoming.avatarURL.isEmpty { next.avatarURL = incoming.avatarURL }
        let real = { (p: Post) in p.media.filter { !$0.url.isEmpty }.count }
        if real(incoming) > real(existing) { next.media = incoming.media }
        if incoming.text.count > existing.text.count { next.text = incoming.text }
        if incoming.verified, !existing.verified { next.verified = true }
        if existing.author.isEmpty, !incoming.author.isEmpty { next.author = incoming.author }
        if existing.timeDisplay.isEmpty, !incoming.timeDisplay.isEmpty { next.timeDisplay = incoming.timeDisplay }
        let e = incoming.engagement
        let hasEngagement = !e.replies.isEmpty || !e.reposts.isEmpty || !e.likes.isEmpty || !e.views.isEmpty
        if hasEngagement { next.engagement = e }
        return next
    }
}
