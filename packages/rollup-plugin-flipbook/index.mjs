import path from "node:path";
import fs from "node:fs/promises";
import { normalizePath } from "vite";

export default function flipbookResolverPlugin() {
	let config;

	return {
		name: "flipbook-resolver",

		async resolveId(source, importer) {
			if (!source.endsWith(".flipb")) return;

			const resolvedId = path.resolve(path.dirname(importer), source);
			return resolvedId;
		},

		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},

		async load(id) {
			if (!id.endsWith(".flipb")) return;

			const isServe = config.command === "serve";

			const tocPath = path.resolve(path.join(id, `toc.json`));

			const toc = JSON.parse(await fs.readFile(tocPath, { encoding: "utf-8" }));

			if (!isServe) {
				for (const atlas of toc.atlases) {
					const fullPath = path.resolve(path.join(id, atlas.src));
					const referenceId = this.emitFile({
						type: "asset",
						name: `${path.basename(id)}-${path.basename(atlas.src)}`,
						source: await fs.readFile(fullPath),
					});

					atlas.referenceId = referenceId;
				}
			} else {
				for (const atlas of toc.atlases) {
					const fullPath = normalizePath(
						path.resolve(path.join(id, atlas.src))
					);

					atlas.src = fullPath.replace(config.root, "");
				}
			}

			return `export default {
				totalFrames: ${toc.totalFrames || 0},
				width: ${toc.width || 0},
				height: ${toc.height || 0},
				frameDurationMs: ${toc.frameDurationMs || 0},
				framesPerAtlas: ${toc.framesPerAtlas || 0},
				atlases: [
					${toc.atlases
						.map(
							(atlas) => `{
						src: ${atlas.referenceId ? `import.meta.ROLLUP_FILE_URL_${atlas.referenceId}` : '"' + atlas.src + '"'},
						width: ${atlas.width},
						height: ${atlas.height}
					}`
						)
						.join(`,`)}
				],
			};`;
		},
	};
}
