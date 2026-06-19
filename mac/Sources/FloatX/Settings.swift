import SwiftUI

/// Widget size presets, mirroring the macOS widget family sizes.
enum WidgetSize: String, CaseIterable {
    case small, medium, large, xlarge

    var label: String {
        switch self {
        case .small: "Small"
        case .medium: "Medium"
        case .large: "Large"
        case .xlarge: "Extra Large"
        }
    }

    var dimensions: NSSize {
        switch self {
        case .small: NSSize(width: 280, height: 200)
        case .medium: NSSize(width: 360, height: 320)
        case .large: NSSize(width: 440, height: 480)
        case .xlarge: NSSize(width: 560, height: 640)
        }
    }

    /// Layout density derived from size — drives font/spacing scaling in the card.
    var scale: CGFloat {
        switch self {
        case .small: 0.88
        case .medium: 1.0
        case .large: 1.12
        case .xlarge: 1.28
        }
    }
}

/// User settings, persisted in UserDefaults and observable by the UI.
@MainActor
final class Settings: ObservableObject {
    static let shared = Settings()

    @AppStorage("intervalSec") var intervalSec: Int = 300 {
        willSet { objectWillChange.send() }
    }
    /// Widget glass opacity, 0.35…1.0 (lower = more see-through).
    @AppStorage("opacity") var opacity: Double = 1.0 {
        willSet { objectWillChange.send() }
    }
    @AppStorage("skipReplies") var skipReplies: Bool = true {
        willSet { objectWillChange.send() }
    }
    @AppStorage("keepReposts") var keepReposts: Bool = true {
        willSet { objectWillChange.send() }
    }
    /// Desktop mode: pin the widget to the desktop/wallpaper layer (behind other
    /// windows) instead of floating on top.
    @AppStorage("desktopMode") var desktopMode: Bool = false {
        willSet { objectWillChange.send() }
    }
    /// Widget size preset (small / medium / large / xlarge).
    @AppStorage("sizePreset") var sizePresetRaw: String = WidgetSize.medium.rawValue {
        willSet { objectWillChange.send() }
    }
    var sizePreset: WidgetSize {
        get { WidgetSize(rawValue: sizePresetRaw) ?? .medium }
        set { sizePresetRaw = newValue.rawValue }
    }

    private init() {}

    var clampedInterval: Int { max(3, min(3600, intervalSec)) }
    var clampedOpacity: Double { max(0.35, min(1.0, opacity)) }
}
