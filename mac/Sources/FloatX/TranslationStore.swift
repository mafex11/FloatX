import SwiftUI

/// Holds translations by tweet id and which posts are currently showing the
/// translated text. Shared between the app (which receives translations from the
/// harvester) and the card (which displays + toggles them).
@MainActor
final class TranslationStore: ObservableObject {
    @Published private(set) var translations: [String: String] = [:]
    @Published private(set) var showing: Set<String> = []
    @Published private(set) var pending: Set<String> = []

    func text(for id: String) -> String? { translations[id] }
    func isShowing(_ id: String) -> Bool { showing.contains(id) }
    func isPending(_ id: String) -> Bool { pending.contains(id) }

    /// User tapped translate. Returns true if we need to fetch (caller triggers
    /// the harvester); false if we already have it and just toggled visibility.
    @discardableResult
    func toggle(_ id: String) -> Bool {
        if showing.contains(id) {
            showing.remove(id)
            return false
        }
        if translations[id] != nil {
            showing.insert(id)
            return false
        }
        pending.insert(id)
        return true // need to fetch
    }

    func receive(id: String, text: String) {
        pending.remove(id)
        guard !text.isEmpty else { return }
        translations[id] = text
        showing.insert(id)
    }
}
