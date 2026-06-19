import SwiftUI
import Combine

/// Owns the auto-advance countdown over the PostStore. Drives the progress ring
/// and exposes pause + manual prev/next. Interval comes from Settings (live).
@MainActor
final class Player: ObservableObject {
    @Published var paused = false
    @Published var progress: Double = 0 // 0…1 toward the next advance

    private let store: PostStore
    private let settings: Settings
    private var timer: Timer?
    private var elapsed: Double = 0
    private let tick = 0.1

    init(store: PostStore, settings: Settings = .shared) {
        self.store = store
        self.settings = settings
        start()
    }

    private func start() {
        timer = Timer.scheduledTimer(withTimeInterval: tick, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.step() }
        }
    }

    private func step() {
        guard !paused, let post = store.current else { return }
        // Don't auto-advance off a video — let it play until the user hits next.
        if post.media.contains(where: { $0.type == .video }) {
            progress = 0
            return
        }
        elapsed += tick
        let interval = Double(settings.clampedInterval)
        if elapsed >= interval {
            advance()
        } else {
            progress = elapsed / interval
        }
    }

    func advance() {
        store.advance()
        resetCountdown()
    }

    func back() {
        store.back()
        resetCountdown()
    }

    func togglePause() { paused.toggle() }

    private func resetCountdown() {
        elapsed = 0
        progress = 0
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }
}
