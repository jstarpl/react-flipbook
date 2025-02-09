import { Flipbook } from "@components/Flipbook";
import React, { useState } from "react";

import test from "./test.flipb"

function StepControlledFlipbook(): React.ReactNode {
	const [step, setStep] = useState(-1);

	return (
		<>
			<Flipbook source={test} step={step} steps={[33]}></Flipbook>
			<input
				type="range"
				value={step}
				max={1}
				min={-1}
				onChange={(e) => setStep(Number(e.target.value))}
			/>
			<>Current target step: {step}</>
		</>
	);
}

function FrameControlledFlipbook(): React.ReactNode {
	const [frame, setFrame] = useState(0);

	return (
		<>
			<Flipbook source={test} frame={frame}></Flipbook>
			<input
				type="range"
				value={frame}
				max={test.totalFrames - 1}
				min={0}
				onChange={(e) => setFrame(Number(e.target.value))}
			/>
			<>Current frame: {frame}</>
		</>
	);
}

export default function App(): React.ReactNode {

	return (
		<>
			<section>
				<h2>Frame-controlled</h2>
				<FrameControlledFlipbook />
			</section>
			<section>
				<h2>Step-controlled</h2>
				<StepControlledFlipbook />
			</section>
		</>
	);
}
