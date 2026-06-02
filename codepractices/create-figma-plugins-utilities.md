# @create-figma-plugin/utilities

## Overview

`@create-figma-plugin/utilities` is a library of utility functions for common Figma/FigJam plugin/widget operations. It is meant to complement the Figma/FigJam plugin API and widget API.

### Installation

```bash
npm install @create-figma-plugin/utilities
```

When used with the build-figma-plugin CLI, only the functions explicitly imported by your plugin/widget will be included in the generated JavaScript bundle(s).

---

## Color

```typescript
import {
  convertHexColorToRgbColor,
  convertNamedColorToHexColor,
  convertRgbColorToHexColor,
  isValidHexColor
} from '@create-figma-plugin/utilities'
```

### `convertHexColorToRgbColor(hexColor)`

Converts the given `hexColor` (eg. `000000`) to RGB format (eg. `{ r: 0, g: 0, b: 0 }`). Each value in the returned RGB plain object is between 0 and 1.

**Parameters:**
- `hexColor` (string)

**Returns:** `null | RGB` - Returns an RGB plain object, else null if hexColor was invalid.

### `convertNamedColorToHexColor(namedColor)`

Converts the given `namedColor` (eg. `black`) to hexadecimal format (eg. `000000`).

**Parameters:**
- `namedColor` (string)

**Returns:** `null | string` - Returns a hexadecimal color as an uppercase string, else null if namedColor was invalid.

### `convertRgbColorToHexColor(rgbColor)`

Converts the given `rgbColor` (eg. `{ r: 0, g: 0, b: 0 }`) to hexadecimal format (eg. `000000`). Each value in the given RGB plain object must be between 0 and 1.

**Parameters:**
- `rgbColor` (RGB)

**Returns:** `null | string` - Returns a hexadecimal color as an uppercase string, else null if rgbColor was invalid.

### `isValidHexColor(hexColor)`

Returns `true` if `hexColor` is a valid hexadecimal color.

**Parameters:**
- `hexColor` (string)

**Returns:** `boolean`

---

## Events

```typescript
import {
  emit,
  on,
  once
} from '@create-figma-plugin/utilities'
```

### `emit<Handler>(name, ...args)`

Calling `emit` in the main context invokes the event handler for the matching event name in your UI. Correspondingly, calling `emit` in your UI invokes the event handler for the matching event name in the main context.

All args passed after `name` will be directly applied on the event handler.

See the recipe for passing data between the main and UI contexts.

**Type Parameters:**
- `Handler` (EventHandler)

**Parameters:**
- `name` (Handler["name"])
- `args` (Parameters<Handler["handler"]>)

**Returns:** `void`

### `on<Handler>(name, handler)`

Registers an event handler for the given event name.

**Type Parameters:**
- `Handler` (EventHandler)

**Parameters:**
- `name` (Handler['name'])
- `handler` (Handler['handler'])

**Returns:** `() => void` - Returns a function for deregistering the handler.

### `once<Handler>(name, handler)`

Registers an event handler that will run at most once for the given event name.

**Type Parameters:**
- `Handler` (EventHandler)

**Parameters:**
- `name` (Handler['name'])
- `handler` (Handler['handler'])

**Returns:** `() => void` - Returns a function for deregistering the handler.

---

## Function

```typescript
import { ensureMinimumTime } from '@create-figma-plugin/utilities'
```

### `ensureMinimumTime<S, T>(minimumTime, callback)`

Creates an async function that will invoke the given callback and run for at least `minimumTime` (in milliseconds).

**Type Parameters:**
- `S`
- `T` (any[])

**Parameters:**
- `minimumTime` (number)
- `callback` ((...args: T) => Promise<S>)

**Returns:** `(...args: T) => Promise<S>`

---

## Image

```typescript
import {
  createCanvasElementFromBlobAsync,
  createCanvasElementFromBytesAsync,
  createCanvasElementFromImageElement,
  createImageElementFromBlobAsync,
  createImageElementFromBytesAsync,
  createImagePaint,
  readBytesFromCanvasElementAsync
} from '@create-figma-plugin/utilities'
```

### `createCanvasElementFromBlobAsync(blob)`

Creates an `HTMLCanvasElement` from a blob representing an image.

**Parameters:**
- `blob` (Blob)

**Returns:** `Promise<HTMLCanvasElement>`

### `createCanvasElementFromBytesAsync(bytes)`

Creates an `HTMLCanvasElement` from the bytes of an image.

**Parameters:**
- `bytes` (Uint8Array)

**Returns:** `Promise<HTMLCanvasElement>`

### `createCanvasElementFromImageElement(imageElement)`

Creates an `HTMLCanvasElement` from an `HTMLImageElement`.

**Parameters:**
- `imageElement` (HTMLImageElement)

**Returns:** `Promise<HTMLCanvasElement>`

### `createImageElementFromBlobAsync(blob)`

Creates an `HTMLImageElement` from a blob representing an image.

**Parameters:**
- `blob` (Blob)

**Returns:** `Promise<HTMLImageElement>`

### `createImageElementFromBytesAsync(bytes)`

Creates an `HTMLImageElement` from the bytes of an image.

**Parameters:**
- `bytes` (Uint8Array)

**Returns:** `Promise<HTMLImageElement>`

### `createImagePaint(bytes)`

Creates an `ImagePaint` object from the bytes of an image.

**Parameters:**
- `bytes` (Uint8Array)

**Returns:** `ImagePaint`

### `readBytesFromCanvasElementAsync(canvasElement)`

Read the bytes off an `HTMLCanvasElement`.

**Parameters:**
- `canvasElement` (HTMLCanvasElement)

**Returns:** `Promise<Uint8Array>`

---

## Monetization

```typescript
import {
  getDocumentUseCount,
  getTotalUseCountAsync,
  incrementDocumentUseCount,
  incrementTotalUseCountAsync,
  resetDocumentUseCount,
  resetTotalUseCountAsync
} from '@create-figma-plugin/utilities'
```

### `getDocumentUseCount([key])`

Returns the plugin's use count for the current document.

**Parameters:**
- `key` (string) - Optional. The key on the current document on which to store the use count. Defaults to `'documentUseCount'`.

**Returns:** `number`

### `getTotalUseCountAsync([key])`

Returns the plugin's total use count.

**Parameters:**
- `key` (string) - Optional. The key in `figma.clientStorage` on which to store the use count. Defaults to `'totalUseCount'`.

**Returns:** `Promise<number>`

### `incrementDocumentUseCount([key])`

Increments the plugin's use count for the current document.

**Parameters:**
- `key` (string) - Optional. The key on the current document on which to store the use count. Defaults to `'documentUseCount'`.

**Returns:** `number` - Returns the plugin's new use count for the current document.

### `incrementTotalUseCountAsync([key])`

Increments the plugin's total use count.

**Parameters:**
- `key` (string) - Optional. The key in `figma.clientStorage` on which to store the use count. Defaults to `'totalUseCount'`.

**Returns:** `Promise<number>` - Returns the plugin's new total use count.

### `resetDocumentUseCount([key])`

Resets the plugin's use count for the current document to 0.

**Parameters:**
- `key` (string) - Optional. The key on the current document on which to store the use count. Defaults to `'documentUseCount'`.

**Returns:** `void`

### `resetTotalUseCountAsync([key])`

Resets the plugin's total use count to 0.

**Parameters:**
- `key` (string) - Optional. The key in `figma.clientStorage` on which to store the use count. Defaults to `'totalUseCount'`.

**Returns:** `Promise<void>`

---

## Node

```typescript
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
```

### `areSiblingNodes(nodes)`

Checks if all nodes in `nodes` are sibling nodes.

**Parameters:**
- `nodes` (Array<SceneNode>)

**Returns:** `boolean` - Returns true if all nodes in nodes are sibling nodes, else false.

### `collapseLayer(node)`

Collapses `node` and all its child nodes in the layer list.

**Parameters:**
- `node` (SceneNode)

**Returns:** `boolean` - Returns true if at least one layer in the layer list was collapsed by the function, else false.

### `computeBoundingBox(node)`

Computes the coordinates (x, y) and dimensions (width, height) of the smallest bounding box that contains the given node. (Does not account for strokes or effects that could extend beyond the node's bounding box.)

**Parameters:**
- `node` (SceneNode)

**Returns:** `Rect` - Returns the bounding box as a Rect.

### `computeMaximumBounds(nodes)`

Computes the absolute coordinates of the top-left and bottom-right corners of the smallest bounding box that contains the given nodes. (Does not account for strokes or effects that could extend beyond the nodes' bounding box.)

**Parameters:**
- `nodes` (Array<SceneNode>)

**Returns:** `[Vector, Vector]` - Returns an array of two Vector objects, one for the top-left corner and another for the bottom-right corner.

### `computeSiblingNodes<Node>(nodes)`

Splits nodes into groups of sibling nodes.

**Type Parameters:**
- `Node` (SceneNode)

**Parameters:**
- `nodes` (Array<Node>)

**Returns:** `Array<Array<Node>>` - Returns an array of array of sibling SceneNode objects.

### `deduplicateNodes<Node>(nodes)`

Returns the result of deduplicating the nodes in `nodes`. Does not modify the original nodes array.

**Type Parameters:**
- `Node` (SceneNode)

**Parameters:**
- `nodes` (Array<Node>)

**Returns:** `Array<Node>` - Returns a new array of unique SceneNode objects.

### `getAbsolutePosition(node)`

Returns the x and y position of the given node relative to the page.

**Parameters:**
- `node` (SceneNode)

**Returns:** `Vector` - Returns a Vector.

### `getDocumentComponents()`

Returns all the local Components in the current document.

**Returns:** `Array<ComponentNode>`

### `getNodeIndexPath(node)`

Gets the index path to the node.

**Parameters:**
- `node` (SceneNode)

**Returns:** `Array<number>` - Returns an array representing the index path to the given node, starting from `figma.root`

### `getParentNode(node)`

Returns the parent node of the given node.

**Parameters:**
- `node` (BaseNode)

**Returns:** `BaseNode & ChildrenMixin` - Throws an error if `node.parent` is null, else returns `node.parent`.

### `getSceneNodeById<Node>(id)`

Returns the SceneNode in the current document with the given id. This is a convenience function that wraps the `figma.getNodeById` function.

**Type Parameters:**
- `Node` (SceneNode)

**Parameters:**
- `id` (string)

**Returns:** `Node` - Throws an error if no SceneNode with the given id exists, else returns the node cast to the specified Node type parameter.

### `getSelectedNodesOrAllNodes()`

Returns the selected nodes, or all the top-level nodes on the current page if no nodes are selected.

**Returns:** `Array<SceneNode>`

### `insertAfterNode(node, referenceNode)`

Inserts `node` after the `referenceNode` in the layer list.

**Parameters:**
- `node` (SceneNode)
- `referenceNode` (SceneNode)

**Returns:** `void`

### `insertBeforeNode(node, referenceNode)`

Inserts `node` before the `referenceNode` in the layer list.

**Parameters:**
- `node` (SceneNode)
- `referenceNode` (SceneNode)

**Returns:** `void`

### `isLocked(node)`

Checks if the given node is locked.

**Parameters:**
- `node` (SceneNode)

**Returns:** `boolean` - Returns true if the node or one of its parent nodes is locked, else false.

### `isVisible(node)`

Checks if the given node is visible.

**Parameters:**
- `node` (SceneNode)

**Returns:** `boolean` - Returns true if the node and all its parent nodes are visible, else false.

### `isWithinInstanceNode(node)`

Checks if the given node is within an Instance node.

**Parameters:**
- `node` (SceneNode)

**Returns:** `boolean` - Returns true if the node is within an Instance node, else false.

### `loadFontsAsync(nodes)`

Loads the fonts used in all the text nodes within the nodes array. This function must be called before modifying any property of a text node that may cause the rendered text to change.

**Parameters:**
- `nodes` (Array<SceneNode>)

**Returns:** `Promise<void>`

### `setAbsolutePosition(node, vector)`

Moves the node to the given x and y position relative to the page. At least one of x or y of vector must be specified.

**Parameters:**
- `node` (SceneNode)
- `vector` (Partial<Vector>)

**Returns:** `void`

### `setRelaunchButton(node, relaunchButtonId [, options])`

Sets a relaunch button on `node` for the command with the given `relaunchButtonId` as configured under the "relaunchButtons" key in `package.json`. Any relaunch buttons set previously will be retained.

See the recipe for configuring relaunch buttons.

**Parameters:**
- `node` (BaseNode)
- `relaunchButtonId` (string)
- `options` (object) - Optional.
  - `description` (string) - The text to display below the relaunch button in the Figma UI.

**Returns:** `void`

### `sortNodesByCanonicalOrder<Node>(siblingNodes)`

Returns the result of sorting the nodes in `siblingNodes` by their layer list order. Does not modify the original `siblingNodes` array.

**Type Parameters:**
- `Node` (SceneNode)

**Parameters:**
- `siblingNodes` (Array<Node>)

**Returns:** `Array<Node>` - Returns a new array of SceneNode objects.

### `sortNodesByName<Node>(nodes)`

Returns the result of sorting nodes in alphabetical order. Does not modify the original nodes array.

**Type Parameters:**
- `Node` (SceneNode)

**Parameters:**
- `nodes` (Array<Node>)

**Returns:** `Array<Node>` - Returns a new array of SceneNode objects.

### `traverseNode(node, processNode [, stopTraversal])`

Traverses `node` and its child nodes recursively in a depth-first manner, passing each node to the specified `processNode` callback.

Each node is also passed to a `stopTraversal` function. If you return `true` in `stopTraversal` for a particular node, then its child nodes will not be traversed.

**Parameters:**
- `node` (SceneNode)
- `processNode` ((node: SceneNode) => void)
- `stopTraversal` ((node: SceneNode) => boolean) - Optional.

**Returns:** `void`

### `traverseNodeAsync(node, processNodeAsync [, stopTraversalAsync])`

An async version of `traverseNode`, in which both callbacks are async.

**Parameters:**
- `node` (SceneNode)
- `processNodeAsync` ((node: SceneNode) => Promise<void>)
- `stopTraversalAsync` ((node: SceneNode) => Promise<boolean>) - Optional.

**Returns:** `Promise<void>`

### `unsetRelaunchButton(node [, relaunchButtonId])`

Unsets the relaunch button on `node` for the command with the given `relaunchButtonId`. If `relaunchButtonId` is not specified, unsets all relaunch buttons on `node`.

**Parameters:**
- `node` (BaseNode)
- `relaunchButtonId` (string) - Optional.

**Returns:** `void`

### `updateNodesSortOrder(siblingNodes)`

Updates the layer list sort order to follow the sort order of the nodes in the `siblingNodes` array. Does not modify the original `siblingNodes` array.

**Parameters:**
- `siblingNodes` (Array<SceneNode>)

**Returns:** `boolean` - Returns true if the layer list sort order was changed by the function, else false.

---

## Number

```typescript
import {
  evaluateNumericExpression,
  isValidNumericInput
} from '@create-figma-plugin/utilities'
```

### `evaluateNumericExpression(value)`

Evaluates the given numeric expression.

**Parameters:**
- `value` (string)

**Returns:** `null | number` - Returns the result of evaluating the given numeric expression, else null for an invalid expression.

### `isValidNumericInput(value [, options])`

Checks if `value` is a numeric expression, as input by a user. "Partial" inputs are considered valid.

**Parameters:**
- `value` (string)
- `options` (object) - Optional.
  - `integersOnly` (boolean) - Set to true to check that the expression contains only integers. Defaults to false.

**Returns:** `boolean` - Returns true if value is a valid numeric expression, else false.

---

## Object

```typescript
import {
  cloneObject,
  compareObjects,
  compareStringArrays,
  deduplicateArray,
  extractAttributes
} from '@create-figma-plugin/utilities'
```

### `cloneObject<T>(object)`

Creates a deep copy of the given object.

**Type Parameters:**
- `T`

**Parameters:**
- `object` (T)

**Returns:** `T`

### `compareObjects(a, b)`

Performs a deep equality comparison of objects `a` and `b`.

**Parameters:**
- `a` (any)
- `b` (any)

**Returns:** `boolean` - Returns true if a and b are the same, else false.

### `compareStringArrays(a, b)`

Compares the string arrays `a` and `b`.

**Parameters:**
- `a` (Array<string>)
- `b` (Array<string>)

**Returns:** `boolean` - Returns true if a and b are the same, else false.

### `deduplicateArray<T>(array)`

Returns the result of deduplicating the given array. Does not modify the original array.

**Type Parameters:**
- `T` (boolean | number | string)

**Parameters:**
- `array` (Array<T>)

**Returns:** `Array<T>` - Returns a new array with unique values.

### `extractAttributes<PlainObject, Key>(array, attributes)`

Extracts the specified list of attributes from the given array of plain objects.

**Type Parameters:**
- `PlainObject`
- `Key` (keyof PlainObject)

**Parameters:**
- `array` (Array<PlainObject>)
- `attributes` (Key[])

**Returns:** `Array<Pick<PlainObject, Key>>` - Returns an array of plain objects.

---

## Settings

```typescript
import {
  loadSettingsAsync,
  saveSettingsAsync
} from '@create-figma-plugin/utilities'
```

### `loadSettingsAsync<Settings>(defaultSettings [, settingsKey])`

Loads your plugin/widget's settings (stored locally on the user's computer under the given `settingsKey`).

**Type Parameters:**
- `Settings`

**Parameters:**
- `defaultSettings` (Settings)
- `settingsKey` (string) - Optional. The key in `figma.clientStorage` on which to store the settings. Defaults to `'settings'`.

**Returns:** `Promise<Settings>`

### `saveSettingsAsync<Settings>(settings [, settingsKey])`

Saves the given settings for your plugin/widget (stored locally on the user's computer under the given `settingsKey`).

**Type Parameters:**
- `Settings`

**Parameters:**
- `settings` (Settings)
- `settingsKey` (string) - Optional. The key in `figma.clientStorage` on which to store the settings. Defaults to `'settings'`.

**Returns:** `Promise<void>`

---

## String

```typescript
import {
  formatErrorMessage,
  formatSuccessMessage,
  formatWarningMessage,
  pluralize
} from '@create-figma-plugin/utilities'
```

### `formatErrorMessage(message)`

Adds a ✘ prefix to the given message.

**Parameters:**
- `message` (string)

**Returns:** `string`

### `formatSuccessMessage(message)`

Adds a ✔ prefix to the given message.

**Parameters:**
- `message` (string)

**Returns:** `string`

### `formatWarningMessage(message)`

Adds a ⚠ prefix to the given message.

**Parameters:**
- `message` (string)

**Returns:** `string`

### `pluralize(number, singular [, plural])`

Returns `singular` if `number` is exactly 1, else returns `plural`. `plural` defaults to `` `${singular}s` `` if not specified.

**Parameters:**
- `number` (number)
- `singular` (string)
- `plural` (string) - Optional.

**Returns:** `string`

---

## UI

```typescript
import { showUI } from '@create-figma-plugin/utilities'
```

### `showUI<Data>(options [, data])`

Renders the UI corresponding to the command in a modal within the Figma UI. Specify the modal's width, height, title, and whether it is visible via `options`. Optionally pass on some initialising data from the command to the UI.

Learn how to add a UI to your plugin/widget.

**Type Parameters:**
- `Data` (Record<string, unknown>)

**Parameters:**
- `options` (ShowUIOptions)
- `data` (Data) - Optional.

**Returns:** `void`
