# Code Migration Reference: TypeScript/Electron to Rust/Tauri

## Overview
This document serves as a comprehensive reference for migrating code from TypeScript/Electron to Rust/Tauri. It provides detailed comparisons of various components and reuse strategies for AI agents in the Antigravity IDE.

## 1. Project Structure
### TypeScript/Electron
- **File Organization**  
  - `src/`  
    - `main.ts`  
    - `renderer.ts`  
    - `assets/`  
- **Build System**: Webpack, NPM Scripts, Electron Builder  

### Rust/Tauri
- **File Organization**  
  - `src/`  
    - `main.rs`  
    - `frontend/`  
      - `index.html`  
      - `assets/`  
- **Build System**: Cargo, Tauri CLI  

## 2. Syntax Comparisons
| Feature            | TypeScript/Electron          | Rust/Tauri               |
|--------------------|------------------------------|--------------------------|
| Variable Declaration | `let x: number = 5;`       | `let x: i32 = 5;`       |
| Function Definition  | `function add(a: number, b: number): number { return a + b; }` | `fn add(a: i32, b: i32) -> i32 { a + b }` |
| Importing Modules   | `import { Component } from 'some-lib';` | `use some_lib::Component;`  |

## 3. UI Components
### TypeScript/Electron
- Utilizes HTML and CSS for the frontend, with React for dynamic rendering.

### Rust/Tauri
- Leverages a web framework like Yew or Seed for frontend rendering, supporting components in Rust.

## 4. IPC Communication
### TypeScript/Electron
Uses `ipcMain` and `ipcRenderer` for inter-process communication.
### Rust/Tauri
Utilizes Tauri's built-in communication system, which handles messages between Rust and the frontend more securely.

## 5. Reuse Strategies for AI Agents
### AI Agent Design in TypeScript/Electron
- Built using classes and singletons.
- Dependencies injected through constructors.

### AI Agent Design in Rust/Tauri
- Utilize traits and structs for AI agent design.
- Implement dependency injection via trait objects.

## Conclusion
Migrating from TypeScript/Electron to Rust/Tauri presents an opportunity to improve performance and security. Focus on leveraging Rust's features to create safer and more efficient applications for AI agents in the Antigravity IDE.

---  
_Last Updated: 2026-04-18 18:32:23 UTC_