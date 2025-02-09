declare module "*.flipb" {
	interface Atlas {
		readonly src: string;
		readonly width: number;
		readonly height: number;
	}

	interface IFlipbookManifest {
		readonly atlases: Array<Atlas>;
		readonly totalFrames: number;
		readonly frameDurationMs: number;
		readonly width: number;
		readonly height: number;
		readonly framesPerAtlas: number;
	}

	const Flipbook: IFlipbookManifest;

	export default Flipbook;
}
