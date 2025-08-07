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

export function Flipbook(props: IFrameControlledProps): React.JSX.Element;
export function Flipbook(props: IStepControlledProps): React.JSX.Element;
export function Flipbook(
	props: IFrameControlledProps | IStepControlledProps
): React.JSX.Element {
	const { source: incomingSource, className } = props;

	const [source, setSource] = useState(incomingSource);

	const [sourceReady, setSourceReady] = useState(false);

	const controlledFrame = "frame" in props ? props.frame : undefined;
	const controlledStep = "step" in props ? props.step : undefined;
	const incomingSteps = "steps" in props ? props.steps : undefined;
	const onStepCompleted =
		"onStepCompleted" in props ? props.onStepCompleted : undefined;

	const [steps, setSteps] = useState(incomingSteps);

	function getInitialFrame() {
		if (controlledFrame) return controlledFrame;
		if (controlledStep && steps) {
			if (controlledStep < 0) return 0;
			if (controlledStep >= steps.length) return source.totalFrames - 1;
			return steps[controlledStep] || 0;
		}
		return 0;
	}

	// const [frame, setFrame] = useState(getInitialFrame());
	const frame = useRef(getInitialFrame());
	const el = useRef<HTMLCanvasElement>(null);
	const ctx = useRef<CanvasRenderingContext2D | null>(null);

	const targetStep = useRef(controlledStep);
	const animationFrameClb = useRef<number | undefined>(undefined);

	const [allAtlases, setAllAtlases] = useState<HTMLImageElement[]>([]);

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

			if (!ctx.current || !el.current) return;

			const canvasCtx = ctx.current;

			const imageElement = allAtlases[currentAtlasIndex];
			if (!imageElement) return;

			const currentFrameInAtlas = currentFrame % source.framesPerAtlas;

			const currentVirtualX = currentFrameInAtlas * source.width;
			const currentX = currentVirtualX % currentAtlas.width;
			const currentY =
				Math.floor(currentVirtualX / currentAtlas.width) * source.height;

			frame.current = currentFrame;

			if (!sourceReady) return;

			el.current.dataset["flipbookFrame"] = String(currentFrame);

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

	useLayoutEffect(() => {
		if (controlledFrame === undefined) {
			setFrame(0);
			return;
		}

		setFrame(controlledFrame);
	}, [controlledFrame, setFrame]);

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
		if (controlledStep === targetStep.current) return;
		if (typeof controlledStep !== typeof targetStep.current) {
			console.error(
				`Changing from step-controlled to frame-controlled after mount is not supported.`
			);
			return;
		}

		const oldTargetStep = targetStep.current;
		targetStep.current = controlledStep;

		const transitionStart = performance.now();
		let transitionStartFrame = frame.current;

		const targetFrame =
			controlledStep < 0
				? 0
				: controlledStep > steps.length - 1
					? source.totalFrames - 1
					: steps[controlledStep];

		if (
			oldTargetStep &&
			((oldTargetStep > steps.length - 1 && controlledStep < 0) ||
				(oldTargetStep < 0 && controlledStep > steps.length - 1))
		) {
			// jump between ends without animating
			setFrame(targetFrame);
			return;
		}

		// if (targetFrame < transitionStartFrame) {
		// 	transitionStartFrame = 0;
		// 	setFrame(0);
		// }
		const beginFrame =
			controlledStep - 1 < 0
				? 0
				: controlledStep - 1 > steps.length - 1
					? source.totalFrames - 1
					: steps[controlledStep - 1];
		setFrame(beginFrame);
		transitionStartFrame = beginFrame;

		function animateToTargetStep(ts: number) {
			const diff = ts - transitionStart;
			const newFrame = Math.min(
				transitionStartFrame + Math.floor(diff / source.frameDurationMs),
				source.totalFrames - 1,
				targetFrame
			);

			setFrame(newFrame);

			if (newFrame >= targetFrame) {
				// controlledStep is certainly not `undefined`, because if it were, `animateToTargetStep` would not be scheduled
				onStepCompleted?.({ step: controlledStep! });
				return;
			}

			animationFrameClb.current =
				window.requestAnimationFrame(animateToTargetStep);
		}

		if (animationFrameClb.current) {
			window.cancelAnimationFrame(animationFrameClb.current);
		}

		const requestedAnimation =
			window.requestAnimationFrame(animateToTargetStep);
		animationFrameClb.current = requestedAnimation;

		return () => {
			window.cancelAnimationFrame(requestedAnimation);
		};
	}, [controlledStep, source, steps, setFrame, onStepCompleted]);

	useLayoutEffect(() => {
		if (!el.current) return;

		setSourceReady(false);

		const allPromises: Promise<void>[] = []

		const allImages: HTMLImageElement[] = source.atlases.map((atlas) => {
			const image = new Image();
			image.src = atlas.src;
			allPromises.push(new Promise((resolve, reject) => {
				image.onerror = (e) => {
					reject(new Error(`Could not load ${atlas.src}: ${e}`))
				};
				image.onload = () => {
					resolve()
				};
			}))
			return image;
		});

		const abort = new AbortController()
		Promise.all(allPromises).then(() => {
			if (abort.signal.aborted) return;
			setAllAtlases(allImages);
			setSourceReady(true);
		});

		return () => {
			abort.abort()
		}
	}, [source]);

	useLayoutEffect(() => {
		if (!el.current) {
			ctx.current = null;
			return;	
		}

		const canvasCtx = el.current.getContext('2d')

		if (!canvasCtx) {
			ctx.current = null;
			console.error('Could not create a 2D rendering context');
			return;
		}

		canvasCtx.imageSmoothingEnabled = false;
		canvasCtx.globalCompositeOperation = 'copy';
		ctx.current = canvasCtx;

		return () => {
			ctx.current = null
		}
	}, [])

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
