#!/usr/bin/env node

import process from "node:process";
import path from "node:path";
import fs from "node:fs/promises";
import ora from "ora";
import {
	createTOC,
	generateAtlas,
	getAtlasPlan,
	getFileInfo,
	getFrameDurationMs,
	getMaxMatrixSize,
	formatDuration,
} from "./lib.mjs";

async function processFile(file, index, size, maxSize) {
	function makeSuffix(suffix) {
		return `(${index + 1}/${size}): ${suffix}`;
	}

	const resolvedPath = path.resolve(file);
	const dirName = path.dirname(resolvedPath);
	const baseName = path.basename(resolvedPath);
	const baseNameExtension = path.extname(baseName);
	const baseNameNoExtension = baseName.substring(
		0,
		baseName.length - baseNameExtension.length
	);

	const spinner = ora(`${file}`).start();
	spinner.suffixText = makeSuffix("Getting file info");

	const info = await getFileInfo(resolvedPath);

	const maxMatrixSize = getMaxMatrixSize(info, maxSize);

	const frameDurationMs = getFrameDurationMs(info);
	const totalFrames = info.durationMs / frameDurationMs;
	const framesPerAtlas = maxMatrixSize.x * maxMatrixSize.y;

	const atlases = getAtlasPlan(
		info,
		frameDurationMs,
		totalFrames,
		maxMatrixSize
	);

	const targetBaseFolder = path.join(dirName, `${baseNameNoExtension}.flipb`);
	try {
		await fs.mkdir(targetBaseFolder);
	} catch (e) {
		// Ignore if the folder exists, that's fine
		if (e.code !== "EEXIST") throw e;
	}

	for (let i = 0; i < atlases.length; i++) {
		const atlas = atlases[i];
		spinner.suffixText = makeSuffix(
			`Generating atlas ${i + 1} of ${atlases.length}`
		);
		const newTargetPath = path.join(targetBaseFolder, atlas.fileName);
		await generateAtlas(resolvedPath, atlas, newTargetPath);
	}

	spinner.suffixText = makeSuffix(`Writing TOC`);

	const tocTargetPath = path.join(targetBaseFolder, `toc.json`);
	await createTOC(info, frameDurationMs, totalFrames, atlases, tocTargetPath);

	spinner.suffixText = "";
	spinner.stopAndPersist({
		symbol: "✅",
	});
}

const flags = [];
let inputFilesStartIndex = 2;
for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i];
	if (arg.startsWith("-")) {
		flags.push(arg);
		inputFilesStartIndex++;
	}
}

let maxDimensionSize = 23150;

for (const flag of flags) {
	if (flag.startsWith("--max-size=")) {
		const value = flag.substring("--max-size=".length);
		const parsedValue = parseInt(value, 10);
		if (!isNaN(parsedValue) && parsedValue > 0) {
			maxDimensionSize = parsedValue;
		} else {
			console.log(`Invalid value for --max-size: ${value}`);
			process.exit(1);
		}
	}
}

const inputFiles = process.argv.slice(inputFilesStartIndex);

if (inputFiles.length === 0) {
	console.log("No files provided for encoding");
	process.exit(1);
}

console.log("");

const startTime = Date.now();

for (let i = 0; i < inputFiles.length; i++) {
	const file = inputFiles[i];
	await processFile(file, i, inputFiles.length, maxDimensionSize);
}

console.log("");

const endTime = Date.now();

console.log(
	`Processed ${inputFiles.length} file(s) in ${formatDuration(endTime - startTime)}`
);
