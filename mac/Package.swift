// swift-tools-version:6.2
import PackageDescription

let package = Package(
    name: "FloatX",
    platforms: [.macOS("26.0")],
    targets: [
        .executableTarget(
            name: "FloatX",
            path: "Sources/FloatX",
            // harvester.js is embedded via HarvesterScript.swift (generated from
            // Resources/harvester.js); exclude the raw file from the build.
            exclude: ["Resources/harvester.js"]
        )
    ]
)
