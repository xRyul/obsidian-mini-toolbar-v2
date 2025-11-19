<h1 align="center">Obsidian Mini Toolbar V2</h1>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/xRyul/obsidian-mini-toolbar-v2?color=6E56CF&style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/github/license/xRyul/obsidian-mini-toolbar-v2?style=for-the-badge" alt="License">
</p>

<p align="center">
  <em>A context-aware toolbar for text manipulation in Obsidian.</em>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/31c42842-d0ea-4990-b8ec-0bb6236dedac" alt="Demo Screenshot" width="600">
</p>

This plugin adds toolbar that appears when you select text, offering quick access to formatting options.


## Features:

- 🎨 Change the color of your $$\textcolor{yellow}{\text{selected}}$$ text.
- 🖌️ Highlight text with <img src="assets/highlight-example.svg" height="24" style="vertical-align: middle;"/> colors.

- <details>
  <summary><strong>Limitations / Known Behaviors</strong></summary>
  - No Reading Mode support  </br>
  - Styles are plugin‑local, not markdown. Colors and underline are not written into the markdown file. If you open the note in another application or disable this plugin, the text will appear unstyled. This is intentional to keep files clean.  </br>
  - Embedded / fragment editors (tables, etc.). The mini toolbar is suppressed. </br>
  -  Multi-line highlighter removed.
</details>

## Credits:
Forked from [Quorafind/Obsidian-Mini-Toolbar](https://github.com/Quorafind/Obsidian-Mini-Toolbar).
