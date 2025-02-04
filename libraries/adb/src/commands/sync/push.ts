import {
    ChunkStream,
    WritableStream,
    pipeFrom,
    type BufferedReadableStream,
    type WritableStreamDefaultWriter,
} from "@yume-chan/stream-extra";
import Struct from "@yume-chan/struct";

import { AdbSyncRequestId, adbSyncWriteRequest } from "./request.js";
import { AdbSyncResponseId, adbSyncReadResponse } from "./response.js";
import { LinuxFileType } from "./stat.js";

export const AdbSyncOkResponse = new Struct({ littleEndian: true }).uint32(
    "unused"
);

export const ADB_SYNC_MAX_PACKET_SIZE = 64 * 1024;

export function adbSyncPush(
    stream: BufferedReadableStream,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    filename: string,
    mode: number = (LinuxFileType.File << 12) | 0o666,
    mtime: number = (Date.now() / 1000) | 0,
    packetSize: number = ADB_SYNC_MAX_PACKET_SIZE
): WritableStream<Uint8Array> {
    return pipeFrom(
        new WritableStream<Uint8Array>({
            async start() {
                const pathAndMode = `${filename},${mode.toString()}`;
                await adbSyncWriteRequest(
                    writer,
                    AdbSyncRequestId.Send,
                    pathAndMode
                );
            },
            async write(chunk) {
                await adbSyncWriteRequest(writer, AdbSyncRequestId.Data, chunk);
            },
            async close() {
                await adbSyncWriteRequest(writer, AdbSyncRequestId.Done, mtime);
                await adbSyncReadResponse(
                    stream,
                    AdbSyncResponseId.Ok,
                    AdbSyncOkResponse
                );
            },
        }),
        new ChunkStream(packetSize)
    );
}
