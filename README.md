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

The [slides for the seminar](https://lit3nitride.github.io/kinesthetics/talk/)
I will be giving on 2018-06-28 is written with this programme,
and the source can be found in the
[gh-pages branch](https://github.com/Lit3Nitride/kinesthetics/tree/gh-pages).

Also, below are other examples that were not made using this programme in
particular, but are primitives to and illustrative of what this aims to
achieve. These slides were coded by hand, whereas Kinesthetics automate
much of the repetitive tasks.
1. [Electromagnetic Presentation Slides](https://zaw.li/!/em)
2. [Poetry and the Poetical Science](https://zaw.li/!/creative)
3. [Kristang Collaborative Online Dictionary - Opening Video](https://festa.2017.kristang.com/a/)
4. [The Promiscuous Nature of Graph Theory](https://zaw.li/!/scicom)


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
