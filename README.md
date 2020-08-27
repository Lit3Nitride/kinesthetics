# Kinesthetics
A software that creates kinematic presentation slides.
_Note that this is still in a very early alpha stage_,
and so many of the general interface is not yet finalised, nor is it
guaranteed to be stable. A rewrite is in (eventual) order, mostly to utilise
promises and clean up the code in general.

## Background
Kinesthetics is a script that allows one to easily create kinematic
presentation slides with state-based (keyframe-based) animation.

### Examples

The [slides for the seminar](https://not-fred.github.io/kinesthetics/talk.html)
I gave is written with this programme,
and the source can be found in the `examples` folder.

Some examples you can play around with in the sandbox are
1. [Integration Graphs](https://not-fred.github.io/kinesthetics/sandbox.html#integration)
2. [2 Vibrational Modes of Water](https://not-fred.github.io/kinesthetics/sandbox.html#water)
3. [Projectile Motion](https://not-fred.github.io/kinesthetics/sandbox.html#projectile)


Also, below are other examples of presentation slides that have been
1. [Randomised Benchmarking](https://zaw.li/!/kinesthetics/fyp)
2. [The Stern–Gerlach Experiment](https://zaw.li/!/kinesthetics/ep2)
3. [Liquid Crystal Lenses](https://zaw.li/!/kinesthetics/em)
4. [Poetry and the Poetical Science](https://zaw.li/!/kinesthetics/creative)
5. [Kristang Collaborative Online Dictionary - Opening Video](https://festa.2017.kristang.com/a/)
6. [The Promiscuous Nature of Graph Theory](https://zaw.li/!/kinesthetics/scicom)

### "Documentation"
```
/* ========================= */
/*    Presentation config    */
/* ========================= */

title: Kinesthetics
// Title of the presentation, appears in the browser titlebar

aspect: 16/9
// Aspect ratio of slides, given as width/height

scripts: [/three.js]
// Javascript files to be included.
// If three.js is attached, the three.js plugin for
// kinesthetics will be included automatically.

background: #f0f0f0
// Background colour of slides
// Given in hex colour


/* ========================= */
/*           Slides          */
/* ========================= */


/* ======== nesting ======== */

slide
    slide
// A slide inside a slide.
// Make sure to use 4 spaces (or 1 tab)

slide
    slide
        slide
            slide
                slide
                    slide
    slide
// You can nest multiple levels.
// The root slide contains two slides, where the
// first contains a slide containing a slide...
// while the second is by itself


/* ======== types ======== */

img=slides/ball-0.svg
// An image slide, where the image file is
// relative to the location of the kst file

import=example0.kst
// Link to another kst file, that presentation
// would be concatenated into this kst file
//
// This allows you to break the presentation down
// into tiny parts, then bring them together after

slide#id0.class0.class1
// This assigns the id "id0" and the classes
// "class0", "class1" to the slide. Useful
// particularly to communicate with javascript.


/* ======= options ======= */

slide sweep=top
{
default: {sweep: 0.2}
}
/* ------------------------------------- */
/*  sweep = top | bottom | left | right  */
/* ------------------------------------- */
// Sweep "top" hides the entire slide from the top.
// Setting the value of "sweep" within the state
// reveals that amount, intepretated as a ratio
// of the slide dimension.

import=example.kst offset=1.23
/* ----------------- */
/*  offset = NUMBER  */
/* ----------------- */
// Adds the offset to every state time
// e.g. if "a.kst" has the states 0.1, 0.2, 0.3,
// they will become 1.33, 1.43, 1.53 when
// imported into this file.
//
// Useful for working with presentation parts
// then forcing a certain order when bringing
// them together


/* ======= states ======= */

// In general, each object is of the form
slide
{
0.1: {a: 1, b: 0},
1: {a: 3, T: [1, 2, 3]},
3000: {a: 0}
}
// The numbers 0.1, 1, 3000 are the state
// labels/identifiers. The numbering is up
// to the user: the numbers themselves do
// not matter, except for their relative
// positions. Each distinct number is
// treated as a distinct state (so if the
// entire file only contained the above
// there will be 3 slides/stops excluding
// the default view)

img=slides/ball-1.svg
{
    default, 1: {
        // Transform origin (useful for rotations)
        O: 0,

        // Translate
        T: 0.5,
        T: [0.5],
        T: [0.2, 0.3],

        // Rotate
        R: 1.57,
        R: 90deg,

        // Scale
        S: 0.2,

        // Easing
        ease: linear,

        // Transition duration
        dt: 0.5s,

        // Transition delay
        t0: 0.1s,

        opacity: 0
    },
    0.1: {opacity: 1, T: 0}
}
```

## Usage
Documentation is in process. Meanwhile, `.kst` files can be either rendered by
running `node kinesthetics.js examples/talk/talk.kst`, which will create the
file `talk.html` in the directory `examples/talk`.

Alternatively, a basic server is also packaged, and can be started by running
`node server/server.js` (or `npm start`). The slides can be accessed according
to their directory names: so, the same presentation above has the url
http://localhost:3000/examples/talk/.

Individual parts of the entire presentation can also be accessed, given that
they are in their own directories. For example, the content page
by itself would be accessed at http://localhost:3000/examples/talk/content/.

The changes hold immediately after the file updates, so using
the server is a quick way to work with `kst` file. However, the packaged
server is not intended to be used in a production environment.

## Miscellaneous Tools
The slides themselves, which are all fixed-aspect transparent images,
are first made in some other software before
being brought here to be animated.

Personally, I use [Inkscape](https://inkscape.org/) to make the SVG
images, where each layer forms a moving part of the presentation.
After that, the layers are split into individual files using the
[SVG Deconstruct](https://github.com/Lit3Nitride/svg-deconstruct) tool that I
wrote for this purpose.

### On-screen Helpers
Pressing `r` during the presentation brings up an on-screen ruler that
gives a measurement in proportion to the presentation screen dimensions.

Pressing `t` brings up the timeline.
