A workflow for using Flipbook animations (frame-by-frame) in React applications
===

The suite of components and utilities consists of:

* `@jstarpl/react-flipbook` - a component for displaying flipbook animations, controlled either using a frame number or a `step` property, where the component will animate, at the given framerate, from the current frame to a frame as indicated by the `steps` property.
* `@jstarpl/flipb_conv` - a utility automating creation of Filmstrips/frame Atlases for these animations from a video source, using ffmpeg. These animations are assembled as a folder, containing as many PNG Filmstrips as neccessary and a TOC JSON file, binding them together and providing playback metadata (framerate, etc.)
* `@jstarpl/rollup-plugin-flipbook` - a Rollup/Vite plugin for importing folders produced by `flipb_conv`. Importing an Flipbook Animation folder results in an object being equivalent to the TOC file (which can be natively ingested by `react-flipbook`), with the Filmstrip image files being emitted into the bundle on build.