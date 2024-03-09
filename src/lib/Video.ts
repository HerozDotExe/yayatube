import ytdl from "ytdl-core";
import path from "path"
import { dev } from "$app/environment";
import fs from "fs/promises";
import { homedir } from "os"
import child_process, { ChildProcess } from "child_process";
import type { Readable } from "stream";
import { tasksWritable } from "./server/stores";

const { default: ffmpegPath } = dev ? await import("ffmpeg-static") : "ffmpeg" // FFMPEG ANDROID PATH

const OUT_DIR = (await fs.readFile(path.join(process.cwd(), "outPath.txt"), { encoding: "utf-8" })).replace("~", homedir())

async function file_exists(path: string) {
    try {
        await fs.stat(path)
        return true
    } catch (error) {
        return false
    }
}

// function handleError(e: unknown) {
//     console.error("ERREUR:", e)
// }

export default class Video {
    link: string
    quality: "max" | "mid" | "min"
    format: "mp4" | "mkv"
    outPath: string | null
    streams: { audio: Readable | null, video: Readable | null }
    ffmpegProcess: ChildProcess | null
    progress: { audio: number, video: number, merge: unknown }
    videoDetails: ytdl.videoInfo["videoDetails"] | null
    constructor({ link, quality, format }: { link: string, quality: "max" | "mid" | "min", format: "mp4" | "mkv" }) {
        this.link = link
        this.quality = quality
        this.format = format
        this.outPath = null
        this.streams = { audio: null, video: null }
        this.ffmpegProcess = null
        this.progress = { audio: 0, video: 0, merge: 0 }
        this.videoDetails = null
    }

    async download() {
        const videoInfo = await ytdl.getBasicInfo(this.link)
        this.videoDetails = videoInfo.videoDetails
        this.outPath = path.join(OUT_DIR, this.videoDetails.title + `.${this.format}`)

        const tracker = {
            start: Date.now(),
            audio: { downloaded: 0, total: Infinity },
            video: { downloaded: 0, total: Infinity },
            merged: { frame: 0, speed: "0x", fps: 0 },
        };

        if (await file_exists(this.outPath)) throw new Error("VideoExists", { cause: this.videoDetails.title })

        this.streams.audio = ytdl(this.link, { quality: "highestaudio" })
            .on("progress", (_, downloaded, total) => {
                this.progress.audio = downloaded / total * 100
                tracker.audio = { downloaded, total };
            })
        this.streams.video = ytdl(this.link, { quality: "highestvideo" })
            .on("progress", (_, downloaded, total) => {
                this.progress.video = downloaded / total * 100
                tracker.video = { downloaded, total };
            })

        this.ffmpegProcess = child_process.spawn(ffmpegPath as string, [
            // Remove ffmpeg"s console spamming
            "-loglevel", "8", "-hide_banner",
            // Redirect/Enable progress messages
            "-progress", "pipe:3",
            // Set inputs
            "-i", "pipe:4",
            "-i", "pipe:5",
            // Map audio & video from streams
            "-map", "0:a",
            "-map", "1:v",
            // Keep encoding
            "-c:v", "copy",
            // Define output file
            this.outPath,
        ], {
            windowsHide: false,
            stdio: [
                /* Standard: stdin, stdout, stderr */
                "inherit", "inherit", "inherit",
                /* Custom: pipe:3, pipe:4, pipe:5 */
                "pipe", "pipe", "pipe",
            ],
        });
        this.ffmpegProcess.on("close", () => {
            clearInterval(showProgressInterval)
            tasksWritable.update((tasks) => {
                let id;
                tasks.forEach((task, index) => {
                    if (task.link === this.link) id = index
                })
                return [...(tasks.splice(id! + 1, 1))]
            })
            console.log(`[${this.videoDetails?.title}/MERGE]: DONE IN ${((Date.now() - tracker.start) / 1000) > 60 ? `${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)}} MINUTES` : `${((Date.now() - tracker.start) / 1000).toFixed(2)} SECONDS`}`)
        });

        // Link streams
        // FFmpeg creates the transformer streams and we just have to insert / read data
        this.ffmpegProcess.stdio[3]!.on("data", chunk => {
            // Start the progress bar
            // if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
            // Parse the param=value list returned by ffmpeg
            const lines = chunk.toString().trim().split("\n");
            const args: typeof tracker.merged = tracker.merged;
            for (const l of lines) {
                const [key, value] = l.split("=");
                args[key.trim() as "frame" | "speed", "fps"] = value.trim();
            }
            this.progress.merge = args;
            tracker.merged = args
        });

        //@ts-expect-error i don"t understand so shut up typescript
        this.streams.audio.pipe(this.ffmpegProcess.stdio[4]);
        //@ts-expect-error i don"t understand so shut up typescript
        this.streams.video.pipe(this.ffmpegProcess.stdio[5]);

        const showProgressInterval = setInterval(() => {
            console.log(`[${this.videoDetails?.title}/AUDIO]: ${this.progress.audio}%`)
            console.log(`[${this.videoDetails?.title}/VIDEO]: ${this.progress.video}%`)

            // readline.cursorTo(process.stdout, 0);
            // const toMB = (i: number) => (i / 1024 / 1024).toFixed(2);

            // process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
            // process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${" ".repeat(10)}\n`);

            // process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
            // process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${" ".repeat(10)}\n`);

            // process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
            // process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${" ".repeat(10)}\n`);

            // process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
            // readline.moveCursor(process.stdout, 0, -3);
        }, 1000)
    }
    async cancel() {
        try {
            if (this.streams.audio) {
                console.log("audio stop")
                this.streams.audio.destroy();
                this.streams.audio = null;
            }
            if (this.streams.video) {
                console.log("video stop")
                this.streams.video.destroy();
                this.streams.video = null;
            }

            if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
                console.log("ffmpeg stop")
                this.ffmpegProcess.kill();
                this.ffmpegProcess = null;
            }

            if (await file_exists(this.outPath!)) await fs.unlink(this.outPath!)
        } catch (e) {
            console.trace(e)
        }
        // if (this.streams.audio !== null || this.streams.video !== null || !this.ffmpegProcess?.killed) {
        //     try {
        //         this.ffmpegProcess?.stdin?.write("q")
        //         // this.ffmpegProcess?.kill()
        //         this.streams.audio?.destroy()
        //         this.streams.video?.destroy()
        //         // this.ffmpegProcess?.kill()
        //         console.log("stop?")
        //     } catch (error) {
        //         console.log(error)
        //     }
        // } else setTimeout(this.cancel, 500)
    }
}

process.on("uncaughtException", (e: { code: string }) => {
    if (e.code !== "ECONNRESET") console.trace(e)
})

// import ytdl from "ytdl-core"
// import path from "path"
// import ffmpegPath from "ffmpeg-static"
// import child_process, { ChildProcess } from "child_process"
// import { Server } from "socket.io"
// import { Readable } from "stream"
// import fs_exists from "./fs_exists"

// const OUT_DIR = path.join(__dirname, "..", "out")

// export class VideoExists extends Error {
//     path: string
//     constructor(message: string, path: string){
//         super(message)
//         this.name = "VideoExists"
//         this.path = path
//     }
// }

// export class Video {
//     id: number
//     link: string
//     quality: "max" | "min"
//     format: "mp4" | "mkv"
//     videoInfo: ytdl.videoInfo | null
//     streams: {
//         video: Readable | null
//         audio: Readable | null
//     }
//     io: Server
//     tracker: {
//         id: number,
//         start: number
//         audio: { downloaded: number, total: number }
//         video: { downloaded: number, total: number }
//         merged: { frame: number, speed: string, fps: number }
//     };
//     ffmpegProcess: ChildProcess | null
//     cancelled: boolean

//     constructor(id: number, io: Server, link: string, quality: "max" | "min", format: "mp4" | "mkv") {
//         this.id = id
//         this.link = link
//         this.quality = quality
//         this.format = format
//         this.videoInfo = null
//         this.streams = { video: null, audio: null }
//         this.io = io
//         this.tracker = {
//             id: this.id,
//             start: Date.now(),
//             audio: { downloaded: 0, total: Infinity },
//             video: { downloaded: 0, total: Infinity },
//             merged: { frame: 0, speed: "0x", fps: 0 },
//         };
//         this.ffmpegProcess = null
//         this.cancelled = false
//     }

//     async start() {
//         this.videoInfo = await ytdl.getInfo(this.link)
//         const outPath = path.join(OUT_DIR, this.videoInfo.videoDetails.title + "." + this.format)

//         if (await fs_exists(outPath)) {
//             throw new VideoExists("This video was already downloaded", outPath)
//         }

//         this.streams.audio = ytdl(this.link, { quality: "highestaudio" })
//             .on("progress", (_, downloaded, total) => {
//                 this.tracker.audio = { downloaded, total };
//                 this.sendProgress()
//             });
//         this.streams.video = ytdl(this.link, { quality: "highestvideo" })
//             .on("progress", (_, downloaded, total) => {
//                 this.tracker.video = { downloaded, total };
//                 this.sendProgress()
//             });

//         this.ffmpegProcess = child_process.spawn(ffmpegPath!, [
//             // Remove ffmpeg"s console spamming
//             "-loglevel", "8", "-hide_banner",
//             // Redirect/Enable progress messages
//             "-progress", "pipe:3",
//             // Set inputs
//             "-i", "pipe:4",
//             "-i", "pipe:5",
//             // Map audio & video from streams
//             "-map", "0:a",
//             "-map", "1:v",
//             // Keep encoding
//             "-c:v", "copy",
//             // Define output file
//             outPath,
//         ], {
//             windowsHide: true,
//             stdio: [
//                 /* Standard: stdin, stdout, stderr */
//                 "inherit", "inherit", "inherit",
//                 /* Custom: pipe:3, pipe:4, pipe:5 */
//                 "pipe", "pipe", "pipe",
//             ],
//         });
//         this.ffmpegProcess.on("close", () => {
//             this.sendProgress()
//             console.log("done");
//             // // Cleanup
//             // process.stdout.write("\n\n\n\n");
//             // clearInterval(progressbarHandle);
//         });

//         // Link streams
//         // FFmpeg creates the transformer streams and we just have to insert / read data
//         this.ffmpegProcess.stdio[3]!.on("data", chunk => {
//             // Start the progress bar
//             // if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
//             // Parse the param=value list returned by ffmpeg
//             const lines = chunk.toString().trim().split("\n");
//             const args: typeof this.tracker.merged = this.tracker.merged;
//             for (const l of lines) {
//                 const [key, value] = l.split("=");
//                 args[key.trim() as "frame" | "speed", "fps"] = value.trim();
//             }
//             this.tracker.merged = args;
//             this.sendProgress()
//         });

//         //@ts-ignore
//         this.streams.audio.pipe(this.ffmpegProcess.stdio[4]);
//         //@ts-ignore
//         this.streams.video.pipe(this.ffmpegProcess.stdio[5]);
//     }

//     sendProgress() {
//         this.io.emit("progress", this.id, this.tracker)
//     }

//     cancel() {
//         this.cancelled = true
//         if (this.streams.audio !== null || this.streams.video !== null || !this.ffmpegProcess?.killed) {
//             this.streams.audio?.destroy()
//             this.streams.video?.destroy()
//             this.ffmpegProcess?.kill()
//         } else setTimeout(this.cancel, 1000)
//     }
// }