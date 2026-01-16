# Your Digital Twin Already Exists

This repository contains a simple, self‑contained web application used in the “Your Digital Twin Already Exists” workshop. The site demonstrates how everyday digital behaviours can be combined and interpreted by data‑driven systems to create a fictional **digital twin**. Participants adjust sliders representing various online activities (device usage, social media activity, location sharing, shopping behaviour and search habits) and observe how a risk score, confidence level and descriptive profile change in real time.

## File Structure

```
digital-twin/
├── index.html     # main page for the workshop
├── styles.css     # styling for the site
├── script.js      # JavaScript logic for the simulator
├── README.md      # this file
└── assets/
    └── images/
        └── hero.png  # banner image for the hero section
```

## How to Use

1. Place all files in the root of your GitHub Pages repository (for example, `https://github.com/yourname/digital-twin`).
2. Push the repository to the `main` branch.
3. Enable GitHub Pages under your repository settings:
   - Choose **Deploy from a branch**
   - Set **Branch** to `main` and **Folder** to `/root`
   - Save your changes and wait a minute for the site to build.
4. Visit the published URL (e.g. `https://yourname.github.io/digital-twin/`) to explore the simulator.

The site runs entirely in the browser and does not collect any data. It is intended for educational purposes to encourage discussion around algorithmic profiling, privacy and digital literacy.