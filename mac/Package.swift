// swift-tools-version:6.2
import PackageDescription

let package = Package(
    name: "FloatX",
    platforms: [.macOS("26.0")],
    targets: [
        .executableTarget(
            name: "FloatX",
            path: "Sources/FloatX"
        )
    ]
)
