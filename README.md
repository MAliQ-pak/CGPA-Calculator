# CGPA-Calculator
Aspiring student developer | Python enthusiast

**Live app:** https://maliq-pak.github.io/CGPA-Calculator/

## Project Overview
The "Personal CGPA per Semester Calculator" started as a Python script I wrote in my first semester to calculate my GPA and CGPA. It has grown into a web app that runs in any browser, with nothing to install.

## Web app features
- **Semester GPA and cumulative CGPA**, updated live as you type, using the credit-hour weighted average.
- **Marks or grades:** enter marks out of 100, or pick a letter grade directly when you only know the grade.
- **BSCS presets:** load any of semesters 1–8 with their courses and credit hours already filled in, or start a blank semester with your own courses.
- **Earlier record:** enter your CGPA and credit hours so far instead of typing in every past semester.
- **Target planner:** shows the GPA you need over your next credit hours to reach a target CGPA, and tells you when a target is out of reach.
- **Editable grading scale** to match any university.
- **Saved automatically** in your browser, with JSON backup export and import to move data between devices.
- Works on phones and supports dark mode.

## Files
| File | What it is |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The web app (plain HTML, CSS and JavaScript, no build step) |
| `modified_CGPA.py` | The original command-line calculator |

## Running it
- **Web app:** open `index.html` in a browser, or visit the live link above.
- **Python script:** `python3 modified_CGPA.py`

## Publishing on GitHub Pages
In the repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, then save. The site appears at the live link above within a minute or two, and every push to `main` updates it.

## Technologies Used
HTML, CSS, JavaScript, Python
