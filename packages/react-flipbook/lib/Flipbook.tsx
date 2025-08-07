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
	const el = useRef<HTMLDivElement>(null);

	const targetStep = useRef(controlledStep);
	const animationFrameClb = useRef<number | undefined>(undefined);

	const [allAtlases, setAllAtlases] = useState<HTMLImageElement[]>([]);
	const lastAtlasIndex = useRef<number | undefined>(undefined);

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

			if (!el.current) return;

			const imageElement = allAtlases[currentAtlasIndex];
			if (!imageElement) return;

			const currentFrameInAtlas = currentFrame % source.framesPerAtlas;

			const currentVirtualX = currentFrameInAtlas * source.width;
			const currentX = currentVirtualX % currentAtlas.width;
			const currentY =
				Math.floor(currentVirtualX / currentAtlas.width) * source.height;

			frame.current = currentFrame;

			if (
				lastAtlasIndex.current !== undefined &&
				currentAtlasIndex !== lastAtlasIndex.current
			) {
				const previousImageElement = allAtlases[lastAtlasIndex.current];
				if (previousImageElement) {
					previousImageElement.style.left = `${source.width + 10}px`;
					previousImageElement.style.top = `${source.height + 10}px`;
				}
			}

			imageElement.style.left = `${currentX * -1}px`;
			imageElement.style.top = `${currentY * -1}px`;
			el.current.dataset["flipbookFrame"] = String(currentFrame);

			lastAtlasIndex.current = currentAtlasIndex;
		},
		[source, allAtlases]
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

		const allImages: HTMLImageElement[] = source.atlases.map((atlas, index) => {
			const image = new Image(atlas.width, atlas.height);
			image.dataset["flipbookAtlas"] = String(index);
			image.decoding = "sync";
			image.src = atlas.src;
			image.width = atlas.width;
			image.style.position = "absolute";
			image.style.left = `0px`;
			image.style.top = `0px`;
			return image;
		});
		el.current.replaceChildren(...allImages);
		setAllAtlases(allImages);
	}, [source]);

	const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({
		width: `${source.width}px`,
		height: `${source.height}px`,
		contain: `strict`,
		overflow: "hidden",
	});

	useEffect(() => {
		setContainerStyle((style) => ({
			...style,
			width: `${source.width}px`,
			height: `${source.height}px`,
		}));
	}, [source]);

	useLayoutEffect(() => {
		if (!el.current) return;

		const style = el.current.computedStyleMap();
		if (style.get("position")?.toString() === "absolute") return;
		setContainerStyle((style) => ({
			...style,
			position: "relative",
		}));
	}, []);

	return (
		<div
			ref={el}
			data-flipbook
			className={className}
			style={containerStyle}
		></div>
	);
}
