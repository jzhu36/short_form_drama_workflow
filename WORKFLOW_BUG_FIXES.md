# Workflow Builder Bug Fixes

## Summary

Fixed three critical bugs in the Workflow Builder and added comprehensive test coverage. All 19 tests pass successfully.

## Bugs Fixed

### Bug #1: Cannot Drag Components to Move Position on Canvas

**Issue**: The drag offset calculation was incorrect, causing components to jump to unexpected positions when dragging.

**Root Cause**:
- In `WorkflowCanvas.js` line 156-158, the drag offset calculation used the node element's bounding rect incorrectly
- Formula was: `event.clientX - rect.left + canvasRect.left` (WRONG)

**Fix**:
- Updated drag offset calculation to: `event.clientX - canvasRect.left - node.position.x`
- This correctly calculates the mouse position relative to the node's top-left corner

**Files Modified**:
- `src/components/workflow/WorkflowCanvas.js:145-159`

**Verification**:
- ✅ Nodes now drag smoothly from any point on their surface
- ✅ Drag offset remains constant during drag operation
- ✅ Tests cover drag start, move, and end scenarios

---

### Bug #2: Components Removed on Click Instead of Requiring Bin Icon

**Issue**: No delete mechanism existed; components couldn't be removed from canvas.

**Solution**: Added delete button (×) to each node's header.

**Implementation**:
1. Added delete button to node header HTML (`BaseNode.js:85-88`)
2. Added event listener for delete button click (`BaseNode.js:156-165`)
3. Added `onNodeDelete` callback to node rendering
4. Implemented `handleNodeDelete` method with confirmation dialog
5. Added CSS styling for delete button

**Features**:
- Delete button appears in top-right of each node header
- Confirmation dialog before deletion
- Automatically removes all connections to/from deleted node
- Delete button click doesn't trigger drag or selection

**Files Modified**:
- `src/components/workflow/nodes/BaseNode.js:85-88, 141-165`
- `src/components/workflow/WorkflowCanvas.js:109, 174-179, 421`
- `styles/workflow.css:217-236`

**Verification**:
- ✅ Delete button visible on all nodes
- ✅ Confirmation dialog prevents accidental deletion
- ✅ Node and all connections removed correctly
- ✅ Tests cover deletion with/without confirmation

---

### Bug #3: Cannot Drag to Link Components with Arrows

**Issue**: Connection drawing didn't work properly due to port detection failures.

**Root Causes**:
1. Port mousedown events not properly captured from child elements (dot, label)
2. handleMouseUp didn't detect port elements when releasing mouse over them

**Fixes**:

**Fix 3a - Port Click Detection** (`BaseNode.js:167-184`):
- Added mousedown listeners to both port element AND port dot
- Added `preventDefault()` to prevent interference
- Ensured event bubbling stops at port level

**Fix 3b - Port Hover Detection** (`WorkflowCanvas.js:248-277`):
- Updated `handleMouseUp` to use `closest('.workflow-node-port')`
- Handles cases where mouse is over port dot, label, or port itself
- Properly detects target port regardless of which child element is under cursor

**Fix 3c - Improved Port Clickability** (`workflow.css:265-287`):
- Increased port dot size from 12px to 14px
- Added padding to port elements for larger click area
- Improved hover effects with scale transform

**Files Modified**:
- `src/components/workflow/nodes/BaseNode.js:167-184`
- `src/components/workflow/WorkflowCanvas.js:248-277`
- `styles/workflow.css:265-287`

**Verification**:
- ✅ Click and drag from output port starts connection
- ✅ Temporary line follows mouse cursor
- ✅ Release on input port completes connection
- ✅ SVG path drawn with bezier curve
- ✅ Connection updates when nodes move
- ✅ Tests cover connection creation, drawing, and updates

---

## Test Coverage

Created comprehensive test suite in `tests/workflow/WorkflowCanvas.test.js`:

### Test Results: ✅ 19/19 PASSED

1. **Node Creation** (3 tests)
   - ✅ Create TextInput node
   - ✅ Create Sora2Video node
   - ✅ Render node element in DOM

2. **Node Dragging** (2 tests)
   - ✅ Update position when dragged
   - ✅ Maintain correct drag offset

3. **Node Deletion** (4 tests)
   - ✅ Delete button exists in header
   - ✅ Remove node on button click
   - ✅ Cancel deletion dialog works
   - ✅ Remove connections when node deleted

4. **Connection Drawing** (5 tests)
   - ✅ Start connection from output port
   - ✅ Create connection between ports
   - ✅ Prevent duplicate connections
   - ✅ Draw SVG path for connection
   - ✅ Update connection when node dragged

5. **Connection Deletion** (1 test)
   - ✅ Delete connection when clicked

6. **Serialization** (2 tests)
   - ✅ Serialize workflow to JSON
   - ✅ Deserialize workflow from JSON

7. **Node Selection** (2 tests)
   - ✅ Select node on mousedown
   - ✅ Deselect previous when selecting new

### Running Tests

```bash
npm test -- tests/workflow/WorkflowCanvas.test.js
```

**Output**:
```
✓ tests/workflow/WorkflowCanvas.test.js  (19 tests) 100ms

Test Files  1 passed (1)
     Tests  19 passed (19)
  Duration  1.46s
```

---

## User Testing Guide

### Test Drag-to-Move:
1. Open Workflow Builder tab
2. Add a Text Input component to canvas
3. Click and hold anywhere on the node (not on ports or delete button)
4. Drag to new position
5. ✅ Node should move smoothly following cursor

### Test Delete:
1. Add a node to canvas
2. Look for × button in top-right of node header
3. Click the × button
4. Confirm deletion in dialog
5. ✅ Node and all its connections should be removed

### Test Connection Drawing:
1. Add Text Input node
2. Add Sora2 Video node
3. Click and hold on the circular port on RIGHT side of Text Input
4. Drag toward Sora2 Video node
5. ✅ You should see a temporary line following your cursor
6. Release mouse over the circular port on LEFT side of Sora2 Video
7. ✅ A solid connection line should appear between the two ports

---

## Technical Details

### Drag Algorithm:
```javascript
// On mousedown: Calculate offset from node origin
dragOffset = {
  x: event.clientX - canvasRect.left - node.position.x,
  y: event.clientY - canvasRect.top - node.position.y
}

// On mousemove: Update position maintaining offset
newX = event.clientX - canvasRect.left - dragOffset.x
newY = event.clientY - canvasRect.top - dragOffset.y
```

### Connection Algorithm:
```javascript
// Phase 1: Start (mousedown on output port)
- Store source node and port
- Create temporary SVG path

// Phase 2: Drag (mousemove)
- Update temporary path endpoint to cursor position
- Draw bezier curve from source to cursor

// Phase 3: Complete (mouseup)
- Find element under cursor
- If it's an input port → create connection
- Remove temporary path
```

### Event Handling:
- **Node drag**: mousedown on node body (excluding ports/buttons)
- **Port connection**: mousedown on port element (including dot/label)
- **Node delete**: click on delete button
- **Connection delete**: click on connection path

All event handlers use proper `stopPropagation()` and `preventDefault()` to avoid conflicts.

---

## Known Limitations

- Delete button requires confirmation dialog (no undo)
- Cannot connect input-to-input or output-to-output
- One input port can only have one incoming connection
- Connections must start from output ports (can't drag backwards)

---

## Future Enhancements

- [ ] Undo/redo for node deletion and position changes
- [ ] Multi-select for batch operations
- [ ] Drag to select multiple nodes
- [ ] Keyboard shortcuts (Delete key, Ctrl+Z, etc.)
- [ ] Connection validation by data type
- [ ] Visual feedback during invalid connection attempts
- [ ] Snap-to-grid for node positioning
- [ ] Trash bin area for drag-to-delete
