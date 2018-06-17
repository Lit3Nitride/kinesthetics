# kinesthetics
Kinematic Presentation Slides.

Cleanup in progress. Although the render function works (the code below should
give slides that work to a certain extent), the traversing has some issues.

```javascript
const {render} = require("./kinesthetics")
render("examples/talk/talk.kst", (err, html) => console.log(html))
```
