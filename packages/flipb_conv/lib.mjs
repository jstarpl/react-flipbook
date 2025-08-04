import process from 'node:process'
import cp from 'node:child_process'
import util from 'node:util'
import fs from 'node:fs/promises'

const MAX_PNG_SIZE = 23150
const INT_MAX = 2147483647

const exec = util.promisify(cp.exec)
const spawn = util.promisify(cp.spawn)

export function escapeFileArg(arg) {
    if (process.platform === 'win32') {
        return `"${arg}"`
    } else {
        return arg.replaceAll(/ /g, '\\ ')
    }
}

export function formatDuration(time) {
	const timeInSec = time / 1000;
	const seconds = timeInSec % 60;
	const minutes = Math.floor((timeInSec / 60) % 60);
	const hours = Math.floor(timeInSec / (60 * 60));
	return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export async function getFileInfo(resolvedPath) {
    const probeOutput = await exec(
        `ffprobe -i ${escapeFileArg(
            resolvedPath
        )} -print_format json -hide_banner -show_format -show_streams`
    )
    const ffprobeResult = JSON.parse(probeOutput.stdout.trim())

    const firstVideoStream = ffprobeResult.streams.find(
        (stream) => stream.codec_type === 'video'
    )

    const frameRateParts = firstVideoStream.r_frame_rate.split('/')

    const result = {
        width: firstVideoStream.width,
        height: firstVideoStream.height,
        durationMs: Number(firstVideoStream.duration) * 1000,
        frameRate: {
            num: Number(frameRateParts[0]),
            den: Number(frameRateParts[1]),
        },
    }

    return result
}

export async function generateAtlas(resolvedPath, atlasInfo, targetPath) {
    const ffmpeg = exec(
        `ffmpeg -ss ${atlasInfo.startTimeMs / 1000} -i ${escapeFileArg(
            resolvedPath
        )} -frames 1 -vf "tile=${atlasInfo.matrixSize.x}x${
            atlasInfo.matrixSize.y
        }:color=0x000000@0x00" -y ${escapeFileArg(targetPath)}`
    )
    await ffmpeg
}

export function getMaxMatrixSize(fileInfo) {
    let valid = false
    let fitsInWidth = 0, fitsInHeight = 0

    fitsInWidth = Math.floor(MAX_PNG_SIZE / fileInfo.width)
    fitsInHeight = Math.floor(MAX_PNG_SIZE / fileInfo.height)
    
    while (!valid) {
        const totalWidth = ((fileInfo.width * fitsInWidth * 8) + 1024) * (fileInfo.height * fitsInHeight + 128)
        if (totalWidth > INT_MAX) {
            if (fitsInWidth > 1) {
                fitsInWidth--
            } else if (fitsInHeight > 1) {
                fitsInHeight--
            } else {
                throw new Error(`Can't fit image of size ${fileInfo.width}x${fileInfo.height} into an atlas, size is too big`)
            }
        } else {
            valid = true
        }
    }

    return {
        x: fitsInWidth,
        y: fitsInHeight,
    }
}

export function getFrameDurationMs(fileInfo) {
    return (fileInfo.frameRate.den * 1000) / fileInfo.frameRate.num
}

export function getAtlasPlan(
    fileInfo,
    frameDurationMs,
    totalFrames,
    maxMatrixSize
) {
    const atlases = []

    let framesRemaining = totalFrames
    let startTimeMs = 0
    let i = 0
    while (framesRemaining > 0) {
        const matrixSizeX = Math.min(maxMatrixSize.x, framesRemaining)
        const matrixSizeY = Math.min(
            maxMatrixSize.y,
            Math.ceil(framesRemaining / matrixSizeX)
        )
        const framesInAtlas = matrixSizeX * matrixSizeY
        atlases.push({
            fileName: `${i}.png`,
            startTimeMs,
            matrixSize: {
                x: matrixSizeX,
                y: matrixSizeY,
            },
        })
        framesRemaining = Math.max(0, framesRemaining - framesInAtlas)
        startTimeMs = startTimeMs + framesInAtlas * frameDurationMs
        i++
    }

    return atlases
}

export async function createTOC(
    fileInfo,
    frameDurationMs,
    totalFrames,
    atlasInfo,
    targetPath
) {
    const toc = {
        width: fileInfo.width,
        height: fileInfo.height,
        durationMs: fileInfo.durationMs,
        frameRate: `${fileInfo.frameRate.num}/${fileInfo.frameRate.den}`,
        frameDurationMs,
        totalFrames,
        date: new Date().toISOString(),
        atlases: atlasInfo.map((atlas) => ({
            src: `./${atlas.fileName}`,
            width: atlas.matrixSize.x * fileInfo.width,
            height: atlas.matrixSize.y * fileInfo.height,
        })),
        framesPerAtlas: atlasInfo[0].matrixSize.x * atlasInfo[0].matrixSize.y,
    }

    await fs.writeFile(targetPath, JSON.stringify(toc), { encoding: 'utf-8' })
}
