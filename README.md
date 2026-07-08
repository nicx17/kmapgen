<div align="center">
  <img src="public/icon.svg" width="128" height="128" alt="KMapGen Icon" />

  <h1>KMapGen</h1>

  <p><strong>A fast, fully client-side Karnaugh Map Generator and Logic Gate Visualizer.</strong></p>

  <p>
    <img alt="TypeScript" src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white">
    <img alt="Vite" src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white">
    <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white">
    <a href="LICENSE">
      <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge">
    </a>
  </p>

</div>

---

## Features

- **Karnaugh Maps:** Automatically generates and solves K-Maps for up to 4 variables. Supports both Minterms (SOP) and Maxterms (POS).
- **Quine-McCluskey Algorithm:** Implements Boolean expression minimization under the hood, natively handling "Don't Cares".
- **Logic Gate Visualization:** Instantly visualizes the minimized expression as a logic circuit.
  - Generates standard circuits (AND, OR, NOT).
  - Automatically converts circuits to **NAND-only** and **NOR-only** universal gate variants.

## Development

KMapGen uses a lightweight, modern web stack with zero UI frameworks, resulting in an exceptionally small footprint and fast execution.

## License

This project is licensed under the [MIT License](LICENSE).
&copy; 2026 Nick Cardoso.
