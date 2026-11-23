# Handwriting Annotation Tool

A browser-based TypeScript tool for annotating handwritten symbols and preparing datasets for deep learning.

## Run locally

Download or clone this repository and open `index.html` in a desktop browser. The compiled JavaScript is included, so no build step is required.

## Annotate a sample

1. Select an InkML file to load the handwritten strokes.
2. Position and rotate reference lines, and use the local maximum and minimum controls to select points on a stroke.
3. Click **Save** to download the annotations as `curves_data.json`.
