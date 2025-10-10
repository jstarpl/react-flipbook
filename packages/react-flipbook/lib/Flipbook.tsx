import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { isArrayEqual } from "./lib";

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

interface IBase {
	className?: string;
	source: IFlipbookManifest;
}

interface IFrameControl {
	frame: number;
}

interface IStepControl {
	step: number;
	steps: number[];
	onStepCompleted?: (e: { step: number }) => void;
}

type IFrameControlledProps = IBase & IFrameControl;
type IStepControlledProps = IBase & IStepControl;

const debug: ((...args: unknown[]) => void) = () => {};
// Keep textures warm with a gentle refresh roughly every 160ms (~4-8 FPS depending on framerate)
const KEEP_ALIVE_INTERVAL_MS = 160;

export function Flipbook(props: IFrameControlledProps): React.JSX.Element;
export function Flipbook(props: IStepControlledProps): React.JSX.Element;
export function Flipbook(
	props: IFrameControlledProps | IStepControlledProps
): React.JSX.Element {
	const { source: incomingSource, className } = props;

	const [source, setSource] = useState(incomingSource);

	const [sourceReady, setSourceReady] = useState(false);
	const sourceReadyRef = useRef(sourceReady);

	const controlledFrame = "frame" in props ? props.frame : undefined;
	const controlledStep = "step" in props ? props.step : undefined;
	const incomingSteps = "steps" in props ? props.steps : undefined;
	const onStepCompleted =
		"onStepCompleted" in props ? props.onStepCompleted : undefined;

	const [steps, setSteps] = useState(incomingSteps);

	// function getInitialFrame() {
	// 	if (controlledFrame) return controlledFrame;
	// 	if (controlledStep && steps) {
	// 		if (controlledStep < 0) return 0;
	// 		if (controlledStep >= steps.length) return source.totalFrames - 1;
	// 		return steps[controlledStep] || 0;
	// 	}
	// 	return 0;
	// }

	// const [frame, setFrame] = useState(getInitialFrame());
	const frame = useRef(-1);
	const el = useRef<HTMLCanvasElement>(null);
	const ctx = useRef<CanvasRenderingContext2D | null>(null);

	const targetStep = useRef(controlledStep);
	const animationFrameClb = useRef<number | undefined>(undefined);
	const keepAliveTimeout = useRef<number | undefined>(undefined);
	const keepAliveRaf = useRef<number | undefined>(undefined);
	const keepAliveActive = useRef(false);

	const [allAtlases, setAllAtlases] = useState<HTMLImageElement[]>([]);

	const cancelPendingAnimationFrame = useCallback(() => {
		if (animationFrameClb.current !== undefined) {
			window.cancelAnimationFrame(animationFrameClb.current);
			animationFrameClb.current = undefined;
		}
	}, []);

	const setFrame = useCallback(
		function setFrame(newFrame: number) {
			let currentFrame = Math.max(
				0,
				Math.min(newFrame, source.totalFrames - 1)
			);

			let currentAtlasIndex = Math.floor(currentFrame / source.framesPerAtlas);
			if (currentAtlasIndex > source.atlases.length - 1) {
				currentAtlasIndex = 0;
				currentFrame = 0;
			}

			const currentAtlas = source.atlases[currentAtlasIndex];
			if (!currentAtlas) {
				return;
			}

			frame.current = currentFrame;

			if (!ctx.current || !el.current) return;

			const canvasCtx = ctx.current;

			const imageElement = allAtlases[currentAtlasIndex];
			if (!imageElement) return;

			const currentFrameInAtlas = currentFrame % source.framesPerAtlas;

			const currentVirtualX = currentFrameInAtlas * source.width;
			const currentX = currentVirtualX % currentAtlas.width;
			const currentY =
				Math.floor(currentVirtualX / currentAtlas.width) * source.height;

			if (!sourceReady) return;

			canvasCtx.clearRect(0, 0, source.width, source.height);
			canvasCtx.drawImage(
				imageElement,
				currentX,
				currentY,
				source.width,
				source.height,
				0,
				0,
				source.width,
				source.height
			);
		},
		[source, allAtlases, sourceReady]
	);

	const latestSetFrameRef = useRef<(value: number) => void>(setFrame);

	useEffect(() => {
		latestSetFrameRef.current = setFrame;
	}, [setFrame]);

	useEffect(() => {
		sourceReadyRef.current = sourceReady;
	}, [sourceReady]);

	const stopKeepAlive = useCallback(() => {
		keepAliveActive.current = false;

		if (keepAliveTimeout.current !== undefined) {
			window.clearTimeout(keepAliveTimeout.current);
			keepAliveTimeout.current = undefined;
		}

		if (keepAliveRaf.current !== undefined) {
			window.cancelAnimationFrame(keepAliveRaf.current);
			keepAliveRaf.current = undefined;
		}
	}, []);

	const scheduleKeepAlive = useCallback(() => {
		if (!keepAliveActive.current) return;

		keepAliveTimeout.current = window.setTimeout(() => {
			keepAliveTimeout.current = undefined;

			keepAliveRaf.current = window.requestAnimationFrame(() => {
				keepAliveRaf.current = undefined;

				if (!keepAliveActive.current) return;
				if (!sourceReadyRef.current) {
					scheduleKeepAlive();
					return;
				}
				if (frame.current >= 0) {
					latestSetFrameRef.current(frame.current);
				}
				scheduleKeepAlive();
			});
		}, KEEP_ALIVE_INTERVAL_MS);
	}, []);

	const startKeepAlive = useCallback(() => {
		if (keepAliveActive.current) return;

		keepAliveActive.current = true;
		scheduleKeepAlive();
	}, [scheduleKeepAlive]);

	useLayoutEffect(() => {
		if (controlledFrame === undefined) {
			return;
		}

		stopKeepAlive();
		cancelPendingAnimationFrame();

		const targetFrame = controlledFrame;
		setFrame(targetFrame);
		startKeepAlive();

		return () => {
			stopKeepAlive();
		};
	}, [
		controlledFrame,
		setFrame,
		cancelPendingAnimationFrame,
		startKeepAlive,
		stopKeepAlive,
	]);

	useEffect(() => {
		setSource(incomingSource);
	}, [incomingSource]);

	useEffect(() => {
		setSteps((oldValue) => {
			if (oldValue === undefined || incomingSteps === undefined)
				return incomingSteps;
			if (isArrayEqual(oldValue, incomingSteps)) return oldValue;
			return incomingSteps;
		});
	}, [incomingSteps]);

	useEffect(() => {
		if (controlledStep === undefined || steps == undefined) return;
		if (typeof controlledStep !== typeof targetStep.current) {
			console.error(
				`Changing from step-controlled to frame-controlled after mount is not supported.`
			);
			return;
		}

		const oldTargetStep = targetStep.current;
		targetStep.current = controlledStep;

		debug(oldTargetStep, controlledStep);

		const targetFrame =
			controlledStep < 0
				? 0
				: controlledStep > steps.length - 1
					? source.totalFrames - 1
					: steps[controlledStep];

		const maintainFrame = (logMessage?: string) => {
			if (logMessage) {
				debug(logMessage);
			}
			cancelPendingAnimationFrame();
			stopKeepAlive();
			setFrame(targetFrame);
			startKeepAlive();
		};

		if (oldTargetStep === undefined) {
			maintainFrame("spinOnFrame: no oldTargetStep");
			return () => {
				stopKeepAlive();
			};
		}

		if (oldTargetStep === controlledStep) {
			maintainFrame("spinOnFrame: oldTargetStep === controlledStep");
			return () => {
				stopKeepAlive();
			};
		}

		if (
			oldTargetStep !== undefined &&
			((oldTargetStep > steps.length - 1 && controlledStep < 0) ||
				(oldTargetStep < 0 && controlledStep > steps.length - 1))
		) {
			maintainFrame("spinOnFrame: jump between ends");
			return () => {
				stopKeepAlive();
			};
		}

		stopKeepAlive();

		const transitionStart = performance.now();
		let transitionStartFrame = frame.current;

		const beginFrame =
			controlledStep - 1 < 0
				? 0
				: controlledStep - 1 > steps.length - 1
					? source.totalFrames - 1
					: steps[controlledStep - 1];
		setFrame(beginFrame);
		transitionStartFrame = beginFrame;

		let onStepCompletedFired = false;

		function animateToTargetStep(ts: number) {
			const diff = ts - transitionStart;
			const newFrame = Math.max(
				0,
				Math.min(
					transitionStartFrame + Math.floor(diff / source.frameDurationMs),
					source.totalFrames - 1,
					targetFrame
				)
			);

			setFrame(newFrame);

			if (newFrame >= targetFrame) {
				if (!onStepCompletedFired) {
					// controlledStep is certainly not `undefined`, because if it were, `animateToTargetStep` would not be scheduled
					onStepCompleted?.({ step: controlledStep! });
					onStepCompletedFired = true;
				}
				cancelPendingAnimationFrame();
				startKeepAlive();
				return;
			}

			animationFrameClb.current =
				window.requestAnimationFrame(animateToTargetStep);
		}

		cancelPendingAnimationFrame();

		debug(`animating: from ${beginFrame} to ${targetFrame}`);

		animationFrameClb.current =
			window.requestAnimationFrame(animateToTargetStep);

		return () => {
			cancelPendingAnimationFrame();
			stopKeepAlive();
		};
	}, [
		controlledStep,
		source,
		steps,
		setFrame,
		onStepCompleted,
		cancelPendingAnimationFrame,
		startKeepAlive,
		stopKeepAlive,
	]);

	useEffect(() => {
		return () => {
			stopKeepAlive();
			cancelPendingAnimationFrame();
		};
	}, [stopKeepAlive, cancelPendingAnimationFrame]);

	useLayoutEffect(() => {
		if (!el.current) return;

		setSourceReady(false);

		const allPromises: Promise<void>[] = [];

		const allImages: HTMLImageElement[] = source.atlases.map((atlas) => {
			const image = document.createElement("img");
			image.src = atlas.src;
			image.fetchPriority = "high";
			allPromises.push(
				new Promise((resolve, reject) => {
					image.onerror = (e) => {
						reject(new Error(`Could not load ${atlas.src}: ${e}`));
					};
					image.onload = () => {
						resolve();
					};
				})
			);
			return image;
		});

		const abort = new AbortController();
		Promise.all(allPromises)
			.then(() => {
				if (abort.signal.aborted) return;
				setAllAtlases(allImages);
				setSourceReady(true);
			})
			.catch((e) => {
				console.error("Failed to load all sources: ", e);
			});

		return () => {
			abort.abort();
		};
	}, [source]);

	useLayoutEffect(() => {
		if (!el.current) {
			ctx.current = null;
			return;
		}

		const canvasCtx = el.current.getContext("2d");

		if (!canvasCtx) {
			ctx.current = null;
			console.error("Could not create a 2D rendering context");
			return;
		}

		canvasCtx.imageSmoothingEnabled = false;
		ctx.current = canvasCtx;

		return () => {
			ctx.current = null;
		};
	}, []);

	return (
		<canvas
			ref={el}
			data-flipbook
			className={className}
			width={source.width}
			height={source.height}
		></canvas>
	);
}
