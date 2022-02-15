import { AdbBackend, ReadableStream, TransformStream, WritableStream } from '@yume-chan/adb';
import { EventEmitter } from '@yume-chan/event';

declare global {
    interface TCPSocket {
        close(): Promise<void>;

        readonly remoteAddress: string;
        readonly remotePort: number;
        readonly readable: ReadableStream;
        readonly writable: WritableStream;
    }

    interface SocketOptions {
        localAddress?: string | undefined;
        localPort?: number | undefined;

        remoteAddress: string;
        remotePort: number;

        sendBufferSize?: number;
        receiveBufferSize?: number;

        keepAlive?: number;
        noDelay?: boolean;
    }

    interface Navigator {
        openTCPSocket(options?: SocketOptions): Promise<TCPSocket>;
    }
}

export default class AdbDirectSocketsBackend implements AdbBackend {
    public static isSupported(): boolean {
        return typeof window !== 'undefined' && !!window.navigator?.openTCPSocket;
    }

    public readonly serial: string;

    public readonly address: string;

    public readonly port: number;

    public name: string | undefined;

    private socket: TCPSocket | undefined;

    private _readablePassthrough = new TransformStream<Uint8Array, ArrayBuffer>({
        transform(chunk, controller) {
            controller.enqueue(chunk.buffer);
        },
    });
    public get readable(): ReadableStream<ArrayBuffer> {
        return this._readablePassthrough.readable;
    }

    private _writablePassthrough = new TransformStream<ArrayBuffer, Uint8Array>({
        transform(chunk, controller) {
            controller.enqueue(new Uint8Array(chunk));
        },
    });
    public get writable(): WritableStream<ArrayBuffer> {
        return this._writablePassthrough.writable;
    }

    private _connected = false;
    public get connected() { return this._connected; }

    private readonly disconnectEvent = new EventEmitter<void>();
    public readonly onDisconnected = this.disconnectEvent.event;

    public constructor(address: string, port: number = 5555, name?: string) {
        this.address = address;
        this.port = port;
        this.serial = `${address}:${port}`;
        this.name = name;
    }

    public async connect() {
        const socket = await navigator.openTCPSocket({
            remoteAddress: this.address,
            remotePort: this.port,
            noDelay: true,
        });

        this.socket = socket;
        this.socket.readable.pipeTo(this._readablePassthrough.writable);
        this._writablePassthrough.readable.pipeTo(this.socket.writable);

        this._connected = true;
    }

    public dispose(): void | Promise<void> {
        this.socket?.close();
        this._connected = false;
    }
}
