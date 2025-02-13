import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

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
	onStepCompleted?: (e: {step: number}) => void
}

type IFrameControlledProps = IBase & IFrameControl;
type IStepControlledProps = IBase & IStepControl;

export function Flipbook(props: IFrameControlledProps): React.JSX.Element;
export function Flipbook(props: IStepControlledProps): React.JSX.Element;
export function Flipbook(
	props: IFrameControlledProps | IStepControlledProps
): React.JSX.Element {
	const { source: incomingSource, className } = props;

	// source musn't change after mount
	const [source] = useState(incomingSource);

	const controlledFrame = "frame" in props ? props.frame : undefined;
	const controlledStep = "step" in props ? props.step : undefined;
	const incomingSteps = "steps" in props ? props.steps : undefined;
	const onStepCompleted = "onStepCompleted" in props ? props.onStepCompleted : undefined;

	// steps musn't change after mount
	const [steps] = useState(incomingSteps);

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
				if (!el.current) return;

				el.current.style.width = `${source.width}px`;
				el.current.style.height = `${source.height}px`;
				return;
			}

			const currentFrameInAtlas = currentFrame % source.framesPerAtlas;

			const currentVirtualX = currentFrameInAtlas * source.width;
			const currentX = currentVirtualX % currentAtlas.width;
			const currentY =
				Math.floor(currentVirtualX / currentAtlas.width) * source.height;

			frame.current = currentFrame;

			if (!el.current) return;
			el.current.style.backgroundImage = `url("${currentAtlas.src}")`;
			el.current.style.backgroundSize = `${currentAtlas.width}px ${currentAtlas.height}px`;
			el.current.style.backgroundPosition = `${currentX * -1}px ${currentY * -1}px`;
			el.current.style.width = `${source.width}px`;
			el.current.style.height = `${source.height}px`;
			el.current.dataset["flipbookFrame"] = String(currentFrame);
		},
		[source]
	);

	useLayoutEffect(() => {
		if (controlledFrame === undefined) {
			setFrame(0);
			return;
		}

		setFrame(controlledFrame);
	}, [controlledFrame, setFrame]);

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
			oldTargetStep && (
				(oldTargetStep > steps.length - 1 && controlledStep < 0) ||
					(oldTargetStep < 0 && controlledStep > steps.length - 1)
			)
		) {
			// jump between ends without animating
			setFrame(targetFrame)
			return
		}

		if (targetFrame < transitionStartFrame) {
			transitionStartFrame = 0;
			setFrame(0);
		}

		function animateToTargetStep(ts: number) {
			const diff = ts - transitionStart;
			const newFrame = Math.min(
				transitionStartFrame + Math.floor(diff / source.frameDurationMs),
				source.totalFrames - 1,
				targetFrame
			);

			setFrame(newFrame);

			if (newFrame >= targetFrame) {
				console.log("Finished animating");
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

		const requestedAnimation = window.requestAnimationFrame(animateToTargetStep);
		animationFrameClb.current = requestedAnimation

		return () => {
			window.cancelAnimationFrame(requestedAnimation)
		}
	}, [controlledStep, source, steps, setFrame, onStepCompleted]);

	useEffect(() => {
		const cache: Promise<void>[] = [];

		for (const atlas of source.atlases) {
			const image = new Image();
			image.src = atlas.src;

			cache.push(image.decode());
		}

		Promise.allSettled(cache).then((results) => {
			const rejected = results.filter((result) => result.status === "rejected");
			if (rejected.length === 0) return;

			console.error(
				`Errors while loading assets: ` +
					rejected.map((result) => result.reason).join(", ")
			);
		});
	}, [source]);

	return <div ref={el} data-flipbook className={className}></div>;
}
