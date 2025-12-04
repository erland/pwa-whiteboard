# Functional Specification – Digital Whiteboard Application

## 1. Purpose and Vision

The purpose of the application is to provide a digital whiteboard that can be used for visual work such as sketches, notes, flows, and simple diagrams.

The vision is:

- **First version:** A whiteboard for a single user on a single device, with the ability to create, save, open, and continue working on their own whiteboards.
- **Future versions:** Extend the solution with support for multiple simultaneous users on the same whiteboard, including real-time updates and collaboration features (e.g., cursors, chat/comments).

The application should be easy to use, work well on desktop, tablet, and mobile, and be usable even when the device is offline (with local storage and later synchronization).

---

## 2. Target Users and Roles

### 2.1 Target Users

- **Individual users** who want to:
  - Sketch ideas
  - Prepare meetings and presentations
  - Have a digital replacement for a physical whiteboard
- **Teams/workgroups** (future versions) who want to:
  - Collaborate visually at a distance
  - Use a shared visual workspace

### 2.2 Roles

In the first version, there is only **one role**:

- **User**
  - Creates, edits, and deletes their own whiteboards
  - Has full control over their local content

In future versions, the following roles may be introduced (described here to future-proof the design):

- **Whiteboard owner**
  - Creates a whiteboard and manages sharing and permissions
- **Collaborating user**
  - Can be granted permission to write/draw or only read
- **Observer / view-only**
  - Can only view the content and cannot make changes

---

## 3. High-Level Features

### 3.1 Whiteboard Management

- Create a new whiteboard  
- Rename a whiteboard  
- List existing whiteboards  
- Open an existing whiteboard  
- Delete a whiteboard (with confirmation)  
- Duplicate a whiteboard (“Save as…” / “Copy board”)  

### 3.2 Drawing and Editing Features

On a whiteboard, the user should be able to:

- Draw freehand strokes
- Create basic objects:
  - Rectangles
  - Circles/ellipses
  - Straight lines
  - Arrows
  - Text objects (e.g., short labels)
  - “Sticky note”-like boxes with text
- Adjust object properties:
  - Stroke width
  - Color (at least a basic set)
  - Fill color (for shapes/sticky notes)
  - Text size (at least a few levels)
- Select and edit objects:
  - Select one or multiple objects
  - Move objects
  - Resize objects (via handles)
  - Copy/paste objects
  - Delete objects
- Undo / redo at the board level

### 3.3 Whiteboard Navigation

- Pan (move the view) over an area larger than the visible screen  
- Zoom in/out:
  - Predefined zoom levels (e.g., 25%, 50%, 100%, 200%)
  - Fit-to-screen (auto zoom to fit)
- Quickly reset to a default view (e.g., centered board at 100% zoom)

### 3.4 Storage and Files

First version (single user, local storage):

- Automatic saving of whiteboards locally on the device
- Manual “Save” function with clear feedback that everything is saved
- Export a whiteboard to an image format (e.g., PNG) to use in presentations, documents, etc.
- Export a whiteboard to a file with structured content (e.g., JSON-like format) for backup and sharing via email or file sharing tools
- Import a previously exported whiteboard file

Future versions (collaboration):

- Store whiteboards in a central storage solution
- Automatic synchronization between devices and users
- Handling of conflicts between local changes and the central version

### 3.5 Sharing and Collaboration (Future Features)

In future versions, the application should support:

- Create a sharing link for a whiteboard
- Configure whether others can:
  - View only
  - View and edit
- Display which users are currently connected to a whiteboard
- Show other users’ cursors (e.g., initials near the pointer)
- Real-time updates for:
  - New objects
  - Changes to existing objects
  - Deletion of objects
- Simple chat or comment function linked to the whiteboard

These functions are not required in the first version, but the design should not make it difficult to add them later.

### 3.6 Offline Support and Synchronization

First version:

- The application should be fully usable without network connectivity
- All local whiteboards should be available offline
- All changes are saved locally

Future versions:

- If central storage is introduced, the solution should provide:
  - Automatic synchronization when the network is available
  - A disconnected mode where the user continues to work locally
  - Synchronization of changes once connectivity is restored

---

## 4. User Flows

### 4.1 Create and Work on a New Whiteboard (v1)

1. The user opens the application.  
2. The user selects “Create new board”.  
3. An empty whiteboard is displayed.  
4. The user draws, adds text, and creates objects.  
5. The application saves the board automatically on an ongoing basis.  
6. At any time the user can:
   - rename the board,
   - export the board as an image,
   - close the board and return to the list of boards.

### 4.2 Resume Work on an Existing Whiteboard (v1)

1. The user opens the application.  
2. A list of previous boards is shown.  
3. The user selects a board to open.  
4. The board is opened in the same state as at the last save.  
5. The user continues editing.  

### 4.3 Export and Import of a Whiteboard (v1)

**Export:**  
1. The user has a board open.  
2. The user selects “Export”.  
3. The user can choose to:
   - Export as an image  
   - Export as a file (structured data)  
4. The file is downloaded using the browser’s download functionality.  

**Import:**  
1. The user goes to the board list and selects “Import board”.  
2. The user selects a previously exported file.  
3. The application creates a new board based on the file content.  
4. The imported board is added to the list of boards.  

### 4.4 Collaboration in a Future Version (High-Level Flow)

1. The owner creates a board and selects “Share”.  
2. A share link is generated.  
3. Other users open the link in their browsers.  
4. All users with edit rights see:
   - the same whiteboard,
   - changes occurring in real time.  
5. The application handles multiple users drawing and editing at the same time.  

This flow is not part of the first version but is specified because it affects the overall design.

---

## 5. Functional Requirements

### 5.1 Whiteboard Objects and State

- The application must internally represent the whiteboard content as a set of objects with:
  - unique identity,
  - type (e.g., line, rectangle, text, sticky note),
  - position,
  - size (where relevant),
  - style attributes (color, stroke style, text size, etc.).
- All changes to the whiteboard must be expressible as discrete events, for example:
  - “object created”
  - “object updated”
  - “object deleted”
- It must be possible, in the future, to store and replay a sequence of events (for undo/redo and for collaboration).

### 5.2 Undo/Redo

- The user must be able to undo the most recent change.  
- The user must be able to redo a previously undone change.  
- The number of undo steps should be defined (at least a practical number, e.g., 20 steps).  

### 5.3 Responsiveness

- The application should adapt to different screen sizes:
  - Desktop
  - Laptop
  - Tablet
  - Mobile phone
- Core functionality (drawing, zooming, saving, opening) should be fully usable on all form factors.

### 5.4 Error Handling

- If a board cannot be saved locally, the user should receive a clear error message.
- If file import fails (e.g., invalid format), the application should:
  - inform the user,
  - not crash,
  - not corrupt or remove existing boards.
- If there is insufficient storage space, the application should ask the user what to do (e.g., delete older boards).

---

## 6. Non-Functional Requirements (High-Level)

Even though the focus is on functional requirements, the following high-level non-functional requirements are relevant:

- **Performance**
  - Drawing and interaction should feel responsive even on relatively large boards.
  - Zooming and panning should be smooth and without noticeable delays on modern devices.

- **Accessibility**
  - Core features should be usable with both keyboard and touch input.
  - Important contrasts and text sizes must be readable.

- **Robustness**
  - The application should not lose data in normal situations such as:
    - temporary network loss,
    - the browser window being closed unexpectedly,
    - the device going to sleep.

- **Extensibility**
  - The internal representation of the whiteboard, objects, and events should be designed so that it is possible to:
    - connect the whiteboard to central storage in the future,
    - send events between clients for collaboration,
    - add new object types (e.g., images, icons, containers) without extensive rewrites.

---

## 7. Versioning

### Version 1 – Single User, Local Whiteboard

Includes:

- Create, open, list, delete, and duplicate whiteboards  
- Draw basic objects (freehand, shapes, text, sticky notes)  
- Move and edit objects  
- Undo/redo  
- Zoom and pan  
- Local automatic saving  
- Export/import of boards  
- Export as image  

### Version 2 – Preparatory Steps for Collaboration

Examples of new features/changes that build on v1:

- A clearer event model with IDs and timestamps  
- Ability to export/import a board including its event log  
- A separate abstraction for storage (local vs. central)  

### Version 3 – Collaboration Features

Examples of extensions:

- Central storage of whiteboards  
- Share links and permission settings  
- Real-time updates between multiple users  
- Display of other users’ cursors  
- Simple chat/comments linked to the board  

---

## 8. Summary

This functional specification describes a digital whiteboard where the first version focuses on a single user and local storage, but where the internal model for the whiteboard, objects, and events is designed so that it will be possible in later versions to add central storage and real-time collaboration between multiple simultaneous users without extensive rewrites of the core logic.
