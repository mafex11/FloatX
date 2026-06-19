import Foundation
import Network

/// Hosts a localhost WebSocket the browser extension's background worker connects
/// to. Each text message is one JSON `Post`. Decoded posts are handed to `onPost`.
///
/// Uses Network.framework's built-in WebSocket protocol option, so we get frame
/// handling for free — we just read/write text messages.
@MainActor
final class WSServer {
    /// Ports we try in order; the first free one wins. The extension scans the
    /// same list, so they rendezvous without configuration.
    static let ports: [UInt16] = [8787, 8788, 8789, 8790, 8791]

    private var listener: NWListener?
    private var connections: [NWConnection] = []
    private(set) var boundPort: UInt16?

    var onPost: ((Post) -> Void)?
    var onStatus: ((String) -> Void)?

    func start() {
        for port in Self.ports {
            if tryListen(on: port) {
                boundPort = port
                onStatus?("listening on \(port)")
                return
            }
        }
        onStatus?("no free port")
    }

    private func tryListen(on port: UInt16) -> Bool {
        let params = NWParameters(tls: nil, tcp: .init())
        // Loopback only — never expose this off-machine.
        params.requiredInterfaceType = .loopback
        let ws = NWProtocolWebSocket.Options()
        ws.autoReplyPing = true
        params.defaultProtocolStack.applicationProtocols.insert(ws, at: 0)

        guard let l = try? NWListener(using: params, on: .init(rawValue: port)!) else {
            return false
        }
        l.newConnectionHandler = { [weak self] conn in
            Task { @MainActor in self?.accept(conn) }
        }
        l.stateUpdateHandler = { [weak self] state in
            if case .failed = state {
                Task { @MainActor in self?.onStatus?("listener failed on \(port)") }
            }
        }
        l.start(queue: .main)
        listener = l
        return true
    }

    private func accept(_ conn: NWConnection) {
        connections.append(conn)
        onStatus?("extension connected")
        conn.start(queue: .main)
        receive(on: conn)
    }

    private func receive(on conn: NWConnection) {
        conn.receiveMessage { [weak self] data, context, _, error in
            Task { @MainActor in
                guard let self else { return }
                if let data, !data.isEmpty,
                   let _ = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) {
                    self.handle(data)
                }
                if error == nil {
                    self.receive(on: conn) // keep reading
                } else {
                    self.connections.removeAll { $0 === conn }
                    self.onStatus?("extension disconnected")
                }
            }
        }
    }

    private func handle(_ data: Data) {
        do {
            let post = try JSONDecoder().decode(Post.self, from: data)
            onPost?(post)
        } catch {
            // Could be a batch array; try that before giving up.
            if let posts = try? JSONDecoder().decode([Post].self, from: data) {
                posts.forEach { onPost?($0) }
            }
        }
    }
}
