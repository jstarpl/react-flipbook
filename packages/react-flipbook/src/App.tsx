import { Flipbook } from "@components/Flipbook";
import React, { useState } from "react";

import test from "./test.flipb"

function StepControlledFlipbook(): React.ReactNode {
	const [step, setStep] = useState(-1);

	return (
		<>
			<Flipbook source={test} step={step} steps={[28]} className="absolute_test"></Flipbook>
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

function ShowHideFlipbook(): React.ReactNode {
	const [visible, setVisible] = useState(false);

	return (
		<>
			<button onClick={() => setVisible((visible) => !visible)}>Show/Hide</button>
			{visible ? <Flipbook source={test} step={1} steps={[28]}></Flipbook> : null}
		</>
	);
}

function FrameControlledFlipbook(): React.ReactNode {
	const [frame, setFrame] = useState(25);

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
			<details>
				<summary>Show-hide</summary>
				<ShowHideFlipbook />
			</details>
			<details>
				<summary>Frame-controlled</summary>
				<FrameControlledFlipbook />
			</details>
			<details>
				<summary>Step-controlled</summary>
				<StepControlledFlipbook />
			</details>
		</>
	);
}
