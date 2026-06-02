# Figma API Recipes

## Passing data between the plugin/widget's main and UI contexts

The `@create-figma-plugin/utilities` library includes 3 functions to facilitate data passing (in both directions) between the plugin/widget's main and UI contexts:

- `on(name, handler)` — Registers an event handler for the given event name.
- `once(name, handler)` — Ditto `on`, only that handler will run at most once.
- `emit(name, ...args)` — Calling `emit` in the main context invokes the event handler for the matching event name in your UI. Correspondingly, calling `emit` in your UI invokes the event handler for the matching event name in the main context. All args passed after `name` will be directly applied on the event handler.

Consider a toy Figma plugin:

```typescript
// src/main.ts

import {
  once,
  // ...
} from '@create-figma-plugin/utilities'

export default function () {
  function handleSubmit (data) {
    console.log(data) //=> { greeting: 'Hello, World!' }
  }
  once('SUBMIT', handleSubmit)
  // ...
}
```

```typescript
// src/ui.tsx

import { render, Button } from '@create-figma-plugin/ui'
import {
  emit,
  // ...
} from '@create-figma-plugin/utilities'
import { h } from 'preact'

function Plugin () {
  // ...
  function handleClick () {
    const data = { greeting: 'Hello, World!' }
    emit('SUBMIT', data)
  }
  return (
    // ...
    <Button onClick={handleClick}>Submit</Button>
    // ...
  )
}

export default render(Plugin)
```

See that:

- In the main context, we're using `once` to register the `handleSubmit` event handler for the event name `SUBMIT`.
- In the UI context, we're using `emit` to trigger the event handler in the main context for the event name `SUBMIT`.
- In the main context, the data received by the `handleSubmit` event handler is precisely the data object that was passed to `emit` in the UI context.

---

## Specifying multiple commands in the plugin sub-menu

This is applicable to plugins only.

Menu commands are specified on the "menu" key under "figma-plugin":

```json
{
  "figma-plugin": {
    "id": "837846252158418235",
    "name": "Flatten Selection to Bitmap",
    "menu": [
      {
        "name": "Flatten Selection to Bitmap",
        "main": "src/flatten-selection-to-bitmap/main.ts",
        "ui": "src/flatten-selection-to-bitmap/ui.ts"
      },
      "-",
      {
        "name": "Settings",
        "main": "src/settings/main.ts",
        "parameters": [
          {
            "key": "resolution",
            "description": "Enter a bitmap resolution"
          }
        ]
      }
    ]
  }
}
```

See that:

- "Flatten Selection to Bitmap" and "Settings" are the two commands in the plugin sub-menu.
- The "Flatten Selection to Bitmap" command has a UI implementation.
- "Settings" is a parameter command that receives a single resolution parameter via the Quick Actions search bar.
- A `"-"` is used to specify a separator between the two commands in the plugin sub-menu.

The above configuration would result in the following:

**"Flatten Selection to Bitmap" plugin sub-menu**

See the other configuration options.

---

## Configuring relaunch buttons

Relaunch buttons are applicable to Figma plugins only.

Relaunch buttons are configured on the "relaunchButtons" key under "figma-plugin":

```json
{
  "figma-plugin": {
    "id": "786286754606650597",
    "name": "Organize Layers",
    "menu": [
      {
        "name": "Organize Layers",
        "main": "src/organize-layers/main.ts",
        "ui": "src/organize-layers/ui.tsx"
      },
      "-",
      {
        "name": "Reset Plugin",
        "main": "src/reset-plugin/main.ts"
      }
    ],
    "relaunchButtons": {
      "organizeLayers": {
        "name": "Organize Layers",
        "main": "src/organize-layers/main.ts",
        "ui": "src/organize-layers/ui.tsx"
      }
    }
  }
}
```

See that:

- `"organizeLayers"` is the `relaunchButtonId`.
- The object corresponding to `"organizeLayers"` specifies the command that runs when the relaunch button is clicked.

Then, call `setRelaunchButton` in our plugin command's main entry point:

```typescript
// src/organize-layers/main.js

import {
  setRelaunchButton,
  // ...
} from '@create-figma-plugin/utilities'

export default async function () {
  setRelaunchButton(figma.currentPage, 'organizeLayers')
  // ...
}
```

The second argument passed to `setRelaunchButton` must be a particular `relaunchButtonId` as configured on the "relaunchButtons" key of our `package.json`. In the above example, we're associating `figma.currentPage` with the `organizeLayers` relaunch button command.

This would result in the following:

**"Organize Layers" relaunch button**

To show additional text below the relaunch button, pass a third argument to `setRelaunchButton`:

```typescript
setRelaunchButton(
  figma.currentPage,
  'organizeLayers',
  { description: 'Organizes all layers on the page based on layer name' }
)
```

---

## Using image assets in your plugin/widget UI

Image assets used in your plugin/widget UI must be "inlined" into the UI bundle. Consider the following example where a PNG image is used in the UI:

```typescript
// src/ui.tsx

import { render } from '@create-figma-plugin/ui'
import { h } from 'preact'

import image from './image.png'

function Plugin () {
  // ...
  return (
    // ...
    <img src={image} />
    // ...
  )
}

export default render(Plugin)
```

Note that `image` is a Base64-encoded data URL string of the imported `image.png` file, so it is set as the `src` attribute of the `img` HTML element.

If you're writing your plugin/widget in TypeScript, you'll also need to add a `.d.ts` typings file to your project's `src` directory containing the following:

```typescript
// src/image-assets.d.ts

declare module '*.gif' {
  const content: string
  export default content
}
declare module '*.jpg' {
  const content: string
  export default content
}
declare module '*.png' {
  const content: string
  export default content
}
declare module '*.svg' {
  const content: string
  export default content
}
```

---

## Making the plugin/widget UI window resizable

The plugin/widget UI window is not resizable by default; this must be implemented by the plugin/widget itself. In practice, this involves:

1. Listening to click-and-drag events in the UI window, and calculating an updated window size based on the mouse position.
2. Calling `figma.ui.resize` with the updated window size.

`@create-figma-plugin/ui` includes a `useWindowResize` hook that makes it easier to implement a resizable UI window:

```typescript
// src/ui.tsx

import { render, useWindowResize } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { h } from 'preact'

function Plugin () {
  // ...
  function onWindowResize(windowSize: { width: number; height: number }) {
    emit('RESIZE_WINDOW', windowSize)
  }
  useWindowResize(onWindowResize, {
    minWidth: 120,
    minHeight: 120,
    maxWidth: 320,
    maxHeight: 320
  })
  // ...
}

export default render(Plugin)
```

The hook takes two arguments:

1. The first argument is an `onWindowResize` callback that will be invoked with the updated `windowSize` in response to click-and-drag events on the bottom and right edges of the UI window. Within this callback, we emit the `RESIZE_WINDOW` event, and pass along the updated `windowSize`.
2. The second argument is an optional configuration object where we can set a minimum and maximum size for the resizable UI window.

In the main context, we register a handler for the `RESIZE_WINDOW` event, and invoke `figma.ui.resize` with the new window size:

```typescript
// src/main.ts

import { on, showUI } from '@create-figma-plugin/utilities'

export default function () {
  // ...
  on('RESIZE_WINDOW', function (windowSize: { width: number; height: number }) {
    const { width, height } = windowSize
    figma.ui.resize(width, height)
  })
  // ...
  showUI({
    width: 240,
    height: 240
  })
}
```

To restrict the resize direction, set `options.resizeDirection` to either `horizontal` or `vertical`:

```typescript
useWindowResize(onWindowResize, {
  minWidth: 120,
  maxWidth: 320,
  resizeDirection: 'horizontal'
})
```

The `useWindowResize` hook also supports toggling the UI window size on double-clicking the bottom and right edges of the UI window:

```typescript
useWindowResize(onWindowResize, {
  minWidth: 120,
  minHeight: 120,
  maxWidth: 320,
  maxHeight: 320,
  resizeBehaviorOnDoubleClick: 'minimize'
})
```

Setting `options.resizeBehaviorOnDoubleClick` to `minimize` means that the UI window will be set to the minimum size on double-click. Correspondingly, setting it to `maximize` means that the UI window will be set to the maximum size on double-click.

For a runnable example, try the preact-resizable plugin template:

```bash
npx --yes create-figma-plugin --template plugin/preact-resizable
```

---

## Customizing the build

### Customizing the underlying esbuild configuration

The build-figma-plugin CLI is powered by the esbuild compiler. To customize the underlying build configuration for the main bundle, create a `build-figma-plugin.main.js` file:

```javascript
// build-figma-plugin.main.js

module.exports = function (buildOptions) {
  // ...
  return {
    ...buildOptions,
    // ...
  }
}
```

`buildOptions` is the original esbuild configuration object used internally by the build-figma-plugin CLI. The exported function must return the new configuration object to be used.

(Using `export default` in place of `module.exports =` is supported only if `"type": "module"` is specified in your `package.json` file.)

Correspondingly, use a `build-figma-plugin.ui.js` file to customize the build configuration for the UI bundle.

### Disabling automatic swapping of React imports

The build-figma-plugin CLI will detect and automatically swap out all `react` and `react-dom` imports with `preact/compat`. To disable this behaviour, create a `build-figma-plugin.ui.js` file:

```javascript
// build-figma-plugin.ui.js

module.exports = function (buildOptions) {
  return {
    ...buildOptions,
    plugins: buildOptions.plugins.filter(function (plugin) {
      return plugin.name !== 'preact-compat'
    })
  }
}
```

### Customizing the manifest.json file

To modify the `manifest.json` file just before it gets output by the build-figma-plugin CLI, create a `build-figma-plugin.manifest.js` file:

```javascript
// build-figma-plugin.manifest.js

module.exports = function (manifest) {
  // ...
  return {
    ...manifest,
    // ...
  }
}
```

The exported function receives the original `manifest.json` that's created by the build-figma-plugin CLI, and must return the new `manifest.json` plain object to be output.

---

## Utilities

> **Note:** The utilities section below provides a quick reference. For complete documentation with detailed examples, see [`create-figma-plugins-utilities.md`](./create-figma-plugins-utilities.md).

### Overview

`@create-figma-plugin/utilities` is a library of utility functions for common Figma/FigJam plugin/widget operations. It is meant to complement the Figma/FigJam plugin API and widget API.

**Installation:**

```bash
npm install @create-figma-plugin/utilities
```

When used with the build-figma-plugin CLI, only the functions explicitly imported by your plugin/widget will be included in the generated JavaScript bundle(s).

Color
import {
convertHexColorToRgbColor,
convertNamedColorToHexColor,
convertRgbColorToHexColor,
isValidHexColor
} from '@create-figma-plugin/utilities'
convertHexColorToRgbColor(hexColor)
Converts the given hexColor (eg. 000000) to RGB format (eg. { r: 0, g: 0, b: 0 }). Each value in the returned RGB plain object is between 0 and 1.

Parameters

hexColor (string)
Return type

Returns an RGB plain object, else null if hexColor was invalid.

null | RGB
convertNamedColorToHexColor(namedColor)
Converts the given namedColor (eg. black) to hexadecimal format (eg. 000000).

Parameters

namedColor (string)
Return type

Returns a hexadecimal color as an uppercase string, else null if namedColor was invalid.

null | string
convertRgbColorToHexColor(rgbColor)
Converts the given rgbColor (eg. { r: 0, g: 0, b: 0 }) to hexadecimal format (eg. 000000). Each value in the given RGB plain object must be between 0 and 1.

Parameters

rgbColor (RGB)
Return type

Returns a hexadecimal color as an uppercase string, else null if rgbColor was invalid.

null | string
isValidHexColor(hexColor)
Returns true if hexColor is a valid hexadecimal color.

Parameters

hexColor (string)
Return type

boolean
Events
import {
emit,
on,
once
} from '@create-figma-plugin/utilities'
emit<Handler>(name, ...args)
Calling emit in the main context invokes the event handler for the matching event name in your UI. Correspondingly, calling emit in your UI invokes the event handler for the matching event name in the main context.

All args passed after name will be directly applied on the event handler.

See the recipe for passing data between the main and UI contexts.

Type parameters

Handler (EventHandler)
Parameters

name (Handler["name"])
args (Parameters<Handler["handler"]>)
Return type

void
on<Handler>(name, handler)
Registers an event handler for the given event name.

Type parameters

Handler (EventHandler)
Parameters

name (Handler['name'])
handler (Handler['handler'])
Return type

Returns a function for deregistering the handler.

() => void
once<Handler>(name, handler)
Registers an event handler that will run at most once for the given event name.

Type parameters

Handler (EventHandler)
Parameters

name (Handler['name'])
handler (Handler['handler'])
Return type

Returns a function for deregistering the handler.

() => void
Function
import { ensureMinimumTime } from '@create-figma-plugin/utilities'
ensureMinimumTime<S, T>(minimumTime, callback)
Creates an async function that will invoke the given callback and run for at least minimumTime (in milliseconds).

Type parameters

S
T (any[])
Parameters

minimumTime (number)
callback ((...args: T) => Promise<S>)
Return type

(...args: T) => Promise<S>
Image
import {
createCanvasElementFromBlobAsync,
createCanvasElementFromBytesAsync,
createCanvasElementFromImageElement,
createImageElementFromBlobAsync,
createImageElementFromBytesAsync,
createImagePaint,
readBytesFromCanvasElementAsync
} from '@create-figma-plugin/utilities'
createCanvasElementFromBlobAsync(blob)
Creates an HTMLCanvasElement from a blob representing an image.

Parameters

blob (Blob)
Return type

Promise<HTMLCanvasElement>
createCanvasElementFromBytesAsync(bytes)
Creates an HTMLCanvasElement from the bytes of an image.

Parameters

bytes (Uint8Array)
Return type

Promise<HTMLCanvasElement>
createCanvasElementFromImageElement(imageElement)
Creates an HTMLCanvasElement from an HTMLImageElement.

Parameters

imageElement (HTMLImageElement)
Return type

Promise<HTMLCanvasElement>
createImageElementFromBlobAsync(blob)
Creates an HTMLImageElement from a blob representing an image.

Parameters

blob (Blob)
Return type

Promise<HTMLImageElement>
createImageElementFromBytesAsync(bytes)
Creates an HTMLImageElement from the bytes of an image.

Parameters

bytes (Uint8Array)
Return type

Promise<HTMLImageElement>
createImagePaint(bytes)
Creates an ImagePaint object from the bytes of an image.

Parameters

bytes (Uint8Array)
Return type

ImagePaint
readBytesFromCanvasElementAsync(canvasElement)
Read the bytes off an HTMLCanvasElement.

Parameters

canvasElement (HTMLCanvasElement)
Return type

Promise<Uint8Array>
Monetization
import {
getDocumentUseCount,
getTotalUseCountAsync,
incrementDocumentUseCount,
incrementTotalUseCountAsync,
resetDocumentUseCount,
resetTotalUseCountAsync
} from '@create-figma-plugin/utilities'
getDocumentUseCount([key])
Returns the plugin’s use count for the current document.

Parameters

key (string) – Optional. The key on the current document on which to store the use count. Defaults to 'documentUseCount'.
Return type

number
getTotalUseCountAsync([key])
Returns the plugin’s total use count.

Parameters

key (string) – Optional. The key in figma.clientStorage on which to store the use count. Defaults to 'totalUseCount'.
Return type

Promise<number>
incrementDocumentUseCount([key])
Increments the plugin’s use count for the current document.

Parameters

key (string) – Optional. The key on the current document on which to store the use count. Defaults to 'documentUseCount'.
Return type

Returns the plugin’s new use count for the current document.

number
incrementTotalUseCountAsync([key])
Increments the plugin’s total use count.

Parameters

key (string) – Optional. The key in figma.clientStorage on which to store the use count. Defaults to 'totalUseCount'.
Return type

Returns the plugin’s new total use count.

Promise<number>
resetDocumentUseCount([key])
Resets the plugin’s use count for the current document to 0.

Parameters

key (string) – Optional. The key on the current document on which to store the use count. Defaults to 'documentUseCount'.
Return type

void
resetTotalUseCountAsync([key])
Resets the plugin’s total use count to 0.

Parameters

key (string) – Optional. The key in figma.clientStorage on which to store the use count. Defaults to 'totalUseCount'.
Return type

Promise<void>
Node
import {
areSiblingNodes,
collapseLayer,
computeBoundingBox,
computeMaximumBounds,
computeSiblingNodes,
deduplicateNodes,
getAbsolutePosition,
getDocumentComponents,
getNodeIndexPath,
getParentNode,
getSceneNodeById,
getSelectedNodesOrAllNodes,
insertAfterNode,
insertBeforeNode,
isLocked,
isVisible,
isWithinInstanceNode,
loadFontsAsync,
setAbsolutePosition,
setRelaunchButton,
sortNodesByCanonicalOrder,
sortNodesByName,
traverseNode,
traverseNodeAsync,
unsetRelaunchButton,
updateNodesSortOrder
} from '@create-figma-plugin/utilities'
areSiblingNodes(nodes)
Checks if all nodes in nodes are sibling nodes.

Parameters

nodes (Array<SceneNode>)
Return type

Returns true if all nodes in nodes are sibling nodes, else false.

boolean
collapseLayer(node)
Collapses node and all its child nodes in the layer list.

Parameters

node (SceneNode)
Return type

Returns true if at least one layer in the layer list was collapsed by the function, else false.

boolean
computeBoundingBox(node)
Computes the coordinates (x, y) and dimensions (width, height) of the smallest bounding box that contains the given node. (Does not account for strokes or effects that could extend beyond the node’s bounding box.)

Parameters

node (SceneNode)
Return type

Returns the bounding box as a Rect.

Rect
computeMaximumBounds(nodes)
Computes the absolute coordinates of the top-left and bottom-right corners of the smallest bounding box that contains the given nodes. (Does not account for strokes or effects that could extend beyond the nodes’ bounding box.)

Parameters

nodes (Array<SceneNode>)
Return type

Returns an array of two Vector objects, one for the top-left corner and another for the bottom-right corner.

[Vector, Vector]
computeSiblingNodes<Node>(nodes)
Splits nodes into groups of sibling nodes.

Type parameters

Node (SceneNode)
Parameters

nodes (Array<Node>)
Return type

Returns an array of array of sibling SceneNode objects.

Array<Array<Node>>
deduplicateNodes<Node>(nodes)
Returns the result of deduplicating the nodes in nodes. Does not modify the original nodes array.

Type parameters

Node (SceneNode)
Parameters

nodes (Array<Node>)
Return type

Returns a new array of unique SceneNode objects.

Array<Node>
getAbsolutePosition(node)
Returns the x and y position of the given node relative to the page.

Parameters

node (SceneNode)
Return type

Returns a Vector.

Vector
getDocumentComponents()
Returns all the local Components in the current document.

Return type

Array<ComponentNode>
getNodeIndexPath(node)
Gets the index path to the node.

Parameters

node (SceneNode)
Return type

Returns an array representing the index path to the given node, starting from figma.root

Array<number>
getParentNode(node)
Returns the parent node of the given node.

Parameters

node (BaseNode)
Return type

Throws an error if node.parent is null, else returns node.parent.

BaseNode & ChildrenMixin
getSceneNodeById<Node>(id)
Returns the SceneNode in the current document with the given id. This is a convenience function that wraps the figma.getNodeById function.

Type parameters

Node (SceneNode)
Parameters

id (string)
Return type

Throws an error if no SceneNode with the given id exists, else returns the node cast to the specified Node type parameter.

Node
getSelectedNodesOrAllNodes()
Returns the selected nodes, or all the top-level nodes on the current page if no nodes are selected.

Return type

Array<SceneNode>
insertAfterNode(node, referenceNode)
Inserts node after the referenceNode in the layer list.

Parameters

node (SceneNode)
referenceNode (SceneNode)
Return type

void
insertBeforeNode(node, referenceNode)
Inserts node before the referenceNode in the layer list.

Parameters

node (SceneNode)
referenceNode (SceneNode)
Return type

void
isLocked(node)
Checks if the given node is locked.

Parameters

node (SceneNode)
Return type

Returns true if the node or one of its parent nodes is locked, else false.

boolean
isVisible(node)
Checks if the given node is visible.

Parameters

node (SceneNode)
Return type

Returns true if the node and all its parent nodes are visible, else false.

boolean
isWithinInstanceNode(node)
Checks if the given node is within an Instance node.

Parameters

node (SceneNode)
Return type

Returns true if the node is within an Instance node, else false.

boolean
loadFontsAsync(nodes)
Loads the fonts used in all the text nodes within the nodes array. This function must be called before modifying any property of a text node that may cause the rendered text to change.

Parameters

nodes (Array<SceneNode>)
Return type

Promise<void>
setAbsolutePosition(node, vector)
Moves the node to the given x and y position relative to the page. At least one of x or y of vector must be specified.

Parameters

node (SceneNode)
vector (Partial<Vector>)
Return type

void
setRelaunchButton(node, relaunchButtonId [, options])
Sets a relaunch button on node for the command with the given relaunchButtonId as configured under the "relaunchButtons" key in package.json. Any relaunch buttons set previously will be retained.

See the recipe for configuring relaunch buttons.

Parameters

node (BaseNode)
relaunchButtonId (string)
options (object) – Optional.
description (string) – The text to display below the relaunch button in the Figma UI.
Return type

void
sortNodesByCanonicalOrder<Node>(siblingNodes)
Returns the result of sorting the nodes in siblingNodes by their layer list order. Does not modify the original siblingNodes array.

Type parameters

Node (SceneNode)
Parameters

siblingNodes (Array<Node>)
Return type

Returns a new array of SceneNode objects.

Array<Node>
sortNodesByName<Node>(nodes)
Returns the result of sorting nodes in alphabetical order. Does not modify the original nodes array.

Type parameters

Node (SceneNode)
Parameters

nodes (Array<Node>)
Return type

Returns a new array of SceneNode objects.

Array<Node>
traverseNode(node, processNode [, stopTraversal])
Traverses node and its child nodes recursively in a depth-first manner, passing each node to the specified processNode callback.

Each node is also passed to a stopTraversal function. If you return true in stopTraversal for a particular node, then its child nodes will not be traversed.

Parameters

node (SceneNode)
processNode ((node: SceneNode) => void)
stopTraversal ((node: SceneNode) => boolean) – Optional.
Return type

void
traverseNodeAsync(node, processNodeAsync [, stopTraversalAsync])
An async version of traverseNode, in which both callbacks are async.

Parameters

node (SceneNode)
processNodeAsync ((node: SceneNode) => Promise<void>)
stopTraversalAsync ((node: SceneNode) => Promise<boolean>) – Optional.
Return type

Promise<void>
unsetRelaunchButton(node [, relaunchButtonId])
Unsets the relaunch button on node for the command with the given relaunchButtonId. If relaunchButtonId is not specified, unsets all relaunch buttons on node.

Parameters

node (BaseNode)
relaunchButtonId (string) – Optional.
Return type

void
updateNodesSortOrder(siblingNodes)
Updates the layer list sort order to follow the sort order of the nodes in the siblingNodes array. Does not modify the original siblingNodes array.

Parameters

siblingNodes (Array<SceneNode>)
Return type

Returns true if the layer list sort order was changed by the function, else false.

boolean
Number
import {
evaluateNumericExpression,
isValidNumericInput
} from '@create-figma-plugin/utilities'
evaluateNumericExpression(value)
Evaluates the given numeric expression.

Parameters

value (string)
Return type

Returns the result of evaluating the given numeric expression, else null for an invalid expression.

null | number
isValidNumericInput(value [, options])
Checks if value is a numeric expression, as input by a user. “Partial” inputs are considered valid.

Parameters

value (string)
options (object) – Optional.
integersOnly (boolean) – Set to true to check that the expression contains only integers. Defaults to false.
Return type

Returns true if value is a valid numeric expression, else false.

boolean
Object
import {
cloneObject,
compareObjects,
compareStringArrays,
deduplicateArray,
extractAttributes
} from '@create-figma-plugin/utilities'
cloneObject<T>(object)
Creates a deep copy of the given object.

Type parameters

T
Parameters

object (T)
Return type

T
compareObjects(a, b)
Performs a deep equality comparison of objects a and b.

Parameters

a (any)
b (any)
Return type

Returns true if a and b are the same, else false.

boolean
compareStringArrays(a, b)
Compares the string arrays a and b.

Parameters

a (Array<string>)
b (Array<string>)
Return type

Returns true if a and b are the same, else false.

boolean
deduplicateArray<T>(array)
Returns the result of deduplicating the given array. Does not modify the original array.

Type parameters

T (boolean | number | string)
Parameters

array (Array<T>)
Return type

Returns a new array with unique values.

Array<T>
extractAttributes<PlainObject, Key>(array, attributes)
Extracts the specified list of attributes from the given array of plain objects.

Type parameters

PlainObject
Key (keyof PlainObject)
Parameters

array (Array<PlainObject>)
attributes (Key[])
Return type

Returns an array of plain objects.

Array<Pick<PlainObject, Key>>
Settings
import {
loadSettingsAsync,
saveSettingsAsync
} from '@create-figma-plugin/utilities'
loadSettingsAsync<Settings>(defaultSettings [, settingsKey])
Loads your plugin/widget’s settings (stored locally on the user’s computer under the given settingsKey).

Type parameters

Settings
Parameters

defaultSettings (Settings)
settingsKey (string) – Optional. The key in figma.clientStorage on which to store the settings. Defaults to 'settings'.
Return type

Promise<Settings>
saveSettingsAsync<Settings>(settings [, settingsKey])
Saves the given settings for your plugin/widget (stored locally on the user’s computer under the given settingsKey).

Type parameters

Settings
Parameters

settings (Settings)
settingsKey (string) – Optional. The key in figma.clientStorage on which to store the settings. Defaults to 'settings'.
Return type

Promise<void>
String
import {
formatErrorMessage,
formatSuccessMessage,
formatWarningMessage,
pluralize
} from '@create-figma-plugin/utilities'
formatErrorMessage(message)
Adds a ✘ prefix to the given message.

Parameters

message (string)
Return type

string
formatSuccessMessage(message)
Adds a ✔ prefix to the given message.

Parameters

message (string)
Return type

string
formatWarningMessage(message)
Adds a ⚠ prefix to the given message.

Parameters

message (string)
Return type

string
pluralize(number, singular [, plural])
Returns singular if number is exactly 1, else returns plural. plural defaults to `${singular}s` if not specified.

Parameters

number (number)
singular (string)
plural (string) – Optional.
Return type

string
UI
import { showUI } from '@create-figma-plugin/utilities'
showUI<Data>(options [, data])
Renders the UI correponding to the command in a modal within the Figma UI. Specify the modal’s width, height, title, and whether it is visible via options. Optionally pass on some initialising data from the command to the UI.

Learn how to add a UI to your plugin/widget.

Type parameters

Data (Record<string, unknown>)
Parameters

options (ShowUIOptions)
data (Data) – Optional.
Return type

void
