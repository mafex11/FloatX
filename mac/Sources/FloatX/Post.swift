import Foundation

/// A harvested X post, mirroring the extension's `Post` shape. Sent over the
/// WebSocket bridge as JSON, one object per message.
struct Post: Codable, Identifiable, Equatable {
    let id: String
    var author: String
    var handle: String
    var avatarURL: String
    var verified: Bool
    var text: String
    var media: [Media]
    var timeDisplay: String
    var timestamp: String   // ISO 8601, e.g. "2026-06-19T12:34:56.000Z"
    var engagement: Engagement
    var permalink: String

    /// "Jun 19, 2026 · 6:04 PM" from the ISO timestamp, or "" if unparseable.
    var absoluteDate: String {
        guard !timestamp.isEmpty else { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp)
        guard let date else { return "" }
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy · h:mm a"
        return f.string(from: date)
    }

    struct Media: Codable, Equatable {
        enum Kind: String, Codable { case image, video }
        let type: Kind
        /// For video this is the poster; `videoURL` (if present) is the playable stream.
        let url: String
        var videoURL: String?
    }

    struct Engagement: Codable, Equatable {
        var replies: String
        var reposts: String
        var likes: String
        var views: String
    }

    /// Map the extension's camelCase keys; tolerate missing optionals.
    enum CodingKeys: String, CodingKey {
        case id, author, handle, avatarURL = "avatarUrl", verified, text, media
        case timeDisplay, timestamp, engagement, permalink
    }
}
